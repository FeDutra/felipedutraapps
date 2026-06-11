# Contrato de Handoff: Lótus Live → OpenClaw v1.4

Este documento define o protocolo canônico de handoff entre a superfície conversacional
**Lótus Live** (`/pulso/live`) e a camada de execução autônoma **OpenClaw/Lótus**.

> **Princípio-mãe:** A Lótus Live não executa. Ela lê, interpreta, e entrega pacotes.
> A OpenClaw lê, decide, propõe e — com aprovação — executa.

---

## 1. Fluxo de Dados

```
Usuário (Fê)
    │ digita comando em /pulso/live
    ▼
LivePage.tsx [handleSendMessage]
    │ interpretLiveIntent(rawText, context) → LiveInterpretation + LiveHandoff
    ▼
pulso_requests (Firestore)
    │ documento gravado com status: "requested"
    │ contém campos: interpretation + handoff
    ▼
OpenClaw (leitura via GET /pending ou Firestore SDK)
    │ filtra requestType === "conversation_command"
    │ lê handoff.executionPrompt
    │ executa em modo assistido / proposta
    ▼
Resposta da OpenClaw
    │ grava em pulso_requests[id].openclawResult
    │ atualiza status conforme lifecycle
    ▼
Lótus Live (próxima carga / refresh / realtime)
    │ exibe resultado no feed ou na bolha de resposta
```

---

## 2. Schema Canônico do Documento em pulso_requests

### 2.1 Campos Obrigatórios (já implementados na v1.3)

```typescript
{
  id: string;                        // req_<timestamp>
  requestType: "conversation_command";
  status: RequestStatus;             // ver lifecycle abaixo
  title: string;                     // comando original (truncado a 80 chars)
  summary: string;                   // comando original completo
  origin: "lotus_live";
  source: "pulso_live";
  requestedBy: string;               // email ou displayName do usuário
  requestedAt: Timestamp;
  updatedAt: Timestamp;
  archived: false;

  interpretation: {
    intent: string;                  // ex: "consulta_tarefas"
    domain: string;                  // ex: "tarefas"
    riskLevel: "low" | "medium" | "high";
    requiresConfirmation: boolean;
    canExecuteNow: boolean;
    sourcesNeeded: string[];
    suggestedReply: string;
  };

  handoff: {
    target: "openclaw";
    mode: "proposal_only";           // v1.4: apenas proposta, nunca auto-execute
    canExecuteNow: boolean;
    requiresHumanConfirmation: boolean;
    intent: string;
    domain: string;
    riskLevel: "low" | "medium" | "high";
    actionType: ActionType;          // ver 2.2
    entitiesMentioned: string[];
    suggestedNextStep: string;
    executionPrompt: string;         // ← prompt pronto para a OpenClaw
  };
}
```

### 2.2 ActionType Canônico

| actionType                  | Descrição                                      | Execução Imediata |
|-----------------------------|------------------------------------------------|-------------------|
| `read`                      | Consulta de dados — sem mutação                | Sim (safe)        |
| `create_proposal`           | Proposta de criação de entidade                | Não — needs_approval |
| `update_proposal`           | Proposta de atualização de entidade            | Não — needs_approval |
| `external_message_proposal` | Proposta de envio de mensagem externa          | Nunca             |
| `undefined`                 | Intenção não reconhecida                       | Nunca             |

### 2.3 Campos de Retorno da OpenClaw (v1.4 — a adicionar)

```typescript
  openclawResult?: {
    processedBy: "openclaw";
    processedAt: Timestamp;
    responseText: string;            // resposta em linguagem natural
    actionPlan?: {
      steps: string[];               // passos propostos
      estimatedRisk: "low" | "medium" | "high";
      requiresConfirmation: boolean;
    };
    sourcesConsulted?: string[];     // coleções/fontes lidas
    proposedMutation?: {             // apenas para create/update proposals
      type: string;                  // ex: "create_task"
      payload: Record<string, any>;  // dados do que seria criado
      previewLabel: string;          // label humano para exibir na UI
    };
    statusTransition: RequestStatus; // status que a OpenClaw propõe
    auditLog: {
      model?: string;
      skillUsed?: string;
      confidence: "high" | "medium" | "low";
      notes?: string;
    };
  };
```

---

## 3. Lifecycle de Status — conversation_command

```
requested
    │ OpenClaw detecta o documento
    ▼
queued_for_openclaw         ← OpenClaw faz claim (POST /claim ou update direto)
    │
    ▼
picked_by_openclaw          ← OpenClaw leu e está processando
    │
    ▼
proposal_ready              ← OpenClaw gravou openclawResult (proposta pronta)
    │
    ├─► [requiresHumanConfirmation = false] ─► completed
    │
    └─► [requiresHumanConfirmation = true] ─► waiting_user_approval
                                                    │
                                          ┌─── approved ───► completed
                                          └─── rejected ───► failed
```

### Mapeamento nos Status Existentes do PulsoRequest

| lifecycle v1.4          | RequestStatus existente |
|-------------------------|-------------------------|
| `requested`             | `requested`             |
| `queued_for_openclaw`   | `accepted`              |
| `picked_by_openclaw`    | `running`               |
| `proposal_ready`        | `needs_approval`* ou novo campo |
| `waiting_user_approval` | `needs_approval`        |
| `completed`             | `completed`             |
| `failed`                | `failed`                |
| `archived`              | `archived`              |

*`needs_approval` já existe e o Cockpit já lê e processa. Reutilizável.

> **Decisão de design v1.4:** Não criar novo campo de status. Usar `requestStatus`
> existente + o campo `handoff.mode` + `openclawResult.statusTransition` para
> comunicar estado. Adicionar apenas `openclawResult` como campo novo opcional.

---

## 4. Como a OpenClaw deve ler os handoffs

### 4.1 Endpoint de leitura (já existente)

```http
GET https://felipedutraapps.web.app/api/pulso/requests?status=requested&requestType=conversation_command
Authorization: Bearer $PULSO_INGEST_TOKEN
```

Ou via Firestore SDK direto (recomendado para polling eficiente):

```javascript
// Firestore query
db.collection('workspaces/felipe_dutra/pulso_requests')
  .where('requestType', '==', 'conversation_command')
  .where('status', '==', 'requested')
  .where('archived', '==', false)
  .orderBy('requestedAt', 'desc')
  .limit(10)
```

### 4.2 Fluxo de consumo da OpenClaw (pseudo-código)

```python
# 1. Ler handoffs pendentes
requests = firestore.query(
  collection='pulso_requests',
  filters=[
    ('requestType', '==', 'conversation_command'),
    ('status', '==', 'requested')
  ]
)

for req in requests:
  handoff = req['handoff']
  
  # 2. Claim — marcar como em processamento
  update(req.id, { 'status': 'running', 'processedBy': 'openclaw' })
  
  # 3. Executar conforme actionType
  if handoff['actionType'] == 'read':
    result = execute_read(handoff['executionPrompt'])
    # 4a. Gravar resultado e marcar concluído
    update(req.id, {
      'status': 'completed',
      'openclawResult': {
        'processedBy': 'openclaw',
        'responseText': result,
        'statusTransition': 'completed',
        'auditLog': { 'confidence': 'high' }
      }
    })
  
  elif handoff['actionType'] in ['create_proposal', 'external_message_proposal']:
    proposal = generate_proposal(handoff['executionPrompt'])
    # 4b. Gravar proposta e aguardar aprovação
    update(req.id, {
      'status': 'needs_approval',
      'openclawResult': {
        'processedBy': 'openclaw',
        'responseText': proposal['summary'],
        'proposedMutation': proposal['mutation'],
        'requiresConfirmation': True,
        'statusTransition': 'needs_approval',
        'auditLog': { 'confidence': 'medium' }
      }
    })
```

### 4.3 Como a OpenClaw deve responder

```json
{
  "openclawResult": {
    "processedBy": "openclaw",
    "processedAt": "2026-06-11T23:00:00Z",
    "responseText": "Você tem 12 tarefas abertas, sendo 4 atribuídas a você. 2 estão atrasadas: 'Revisar contrato OPC' e 'Fechar reunião Murilo'. Prioridade imediata: tarefas atrasadas.",
    "sourcesConsulted": ["pulso_tasks", "pulso_projects"],
    "actionPlan": null,
    "proposedMutation": null,
    "statusTransition": "completed",
    "auditLog": {
      "model": "gemini-2.0-flash",
      "skillUsed": "pulso/query_tasks",
      "confidence": "high",
      "notes": "Consultou 24 tarefas ativas. Filtrou por ownerRefs."
    }
  }
}
```

---

## 5. Regras de Segurança (Invariantes)

### O que a OpenClaw PODE fazer para conversation_command:
- ✅ Ler qualquer coleção do Firestore (read-only)
- ✅ Gravar `openclawResult` no próprio documento `pulso_requests`
- ✅ Atualizar `status` do request para `running`, `completed`, `failed`, `needs_approval`
- ✅ Gravar propostas de mutação no campo `proposedMutation` (sem executar)

### O que a OpenClaw NÃO PODE fazer:
- ❌ Criar documentos em `pulso_tasks`, `pulso_projects`, `pulso_people` diretamente
- ❌ Enviar mensagens externas (WhatsApp, email) sem aprovação humana explícita
- ❌ Alterar dados de Áreas, Agentes ou Fontes sem `needs_approval`
- ❌ Arquivar documentos de outras coleções
- ❌ Executar qualquer `conversation_command` onde `requiresHumanConfirmation: true` sem aprovação

### Validação de origem obrigatória:
```javascript
// A OpenClaw deve rejeitar se não encontrar handoff.target === 'openclaw'
if (req.handoff?.target !== 'openclaw') return; // não é para mim
if (req.handoff?.mode !== 'proposal_only') return; // versão desconhecida
```

---

## 6. UI Mínima na Lótus Live (v1.4)

Dentro da bolha de resposta da Lótus, após o `openclawResult` ser gravado:
- Exibir badge: `✅ OpenClaw respondeu` ou `⏳ Aguardando OpenClaw`
- Exibir `openclawResult.responseText` na bolha
- Se `proposedMutation` presente: exibir preview + botão "Aprovar" → chama `approveRequest(id)`
- Não redesenhar a tela

---

## 7. Campos que FALTAM no Payload Atual (Lacunas v1.3 → v1.4)

| Campo                     | Situação atual | Necessário para OpenClaw |
|---------------------------|----------------|--------------------------|
| `openclawResult`          | ❌ Ausente     | ✅ Sim — resposta da OpenClaw |
| `handoff.claimedAt`       | ❌ Ausente     | Opcional — rastreabilidade |
| `handoff.claimedBy`       | ❌ Ausente     | Opcional — qual agente processou |
| `dedupeKey`               | ❌ Ausente     | Recomendado — evitar duplicatas |
| `priority`                | ✅ Presente    | ✅ Já ok |
| `requestedBy`             | ✅ Presente    | ✅ Já ok |
| `handoff.executionPrompt` | ✅ Presente    | ✅ Já ok |
| `handoff.actionType`      | ✅ Presente    | ✅ Já ok |
| `handoff.entitiesMentioned` | ✅ Presente  | ✅ Já ok |
| `archived`                | ✅ Presente    | ✅ Já ok |

### Lacuna crítica:
O campo `openclawResult` não existe no `PulsoRequest` type nem no payload atual.
É o único campo novo necessário para fechar o loop bidirecional.

---

## 8. O que implementar na v1.4

### Recomendação: Implementar agora (baixo risco)

**Arquivo 1:** `pulso.types.ts`
- Adicionar interface `OpenClawResult`
- Adicionar campo opcional `openclawResult?: OpenClawResult` ao `PulsoRequest`
- Adicionar `'queued_for_openclaw' | 'picked_by_openclaw' | 'proposal_ready' | 'waiting_user_approval'` ao `RequestStatus`

**Arquivo 2:** `liveIntentInterpreter.ts`
- Nenhuma mudança necessária — handoff já está completo

**Arquivo 3:** `LivePage.tsx`
- Adicionar leitura de `openclawResult` ao carregar histórico
- Exibir `openclawResult.responseText` na bolha da Lótus quando presente
- Exibir badge de status do handoff (`⏳ Aguardando OpenClaw` / `✅ Respondido`)

**Arquivo 4 (documentação):** este arquivo — já criado.

### Não implementar agora (aguardar OpenClaw real):
- Polling/webhook para detectar quando OpenClaw respondeu
- Botão "Aprovar proposta" (aguardar proposedMutation real)
- Realtime listener no Firestore para openclawResult

---

## 9. Avaliação de Risco

| Item                          | Risco Técnico | Risco de Produto |
|-------------------------------|---------------|------------------|
| Adicionar `openclawResult` ao type | Baixo — campo opcional | Nenhum |
| Exibir `openclawResult` na UI | Baixo — apenas renderização | Nenhum |
| Adicionar status ao `RequestStatus` | Baixo — string union | Baixo — não quebra código existente |
| Polling realtime | Médio — custos Firestore | Médio — não necessário ainda |
| Executar mutations da OpenClaw | Alto — risco de produção | Alto — não fazer ainda |

---

## 10. Referências

- [pulso-openclaw-contract.md](./pulso-openclaw-contract.md)
- [pulso-openclaw-autonomy-limits.md](./pulso-openclaw-autonomy-limits.md)
- [pulso-openclaw-emission-policy.md](./pulso-openclaw-emission-policy.md)
- [pulso-requests-bridge.md](./pulso-requests-bridge.md)
- Endpoint Bridge: `https://felipedutraapps.web.app/api/pulso/requests`
- Endpoint Ingestão: `https://felipedutraapps.web.app/api/pulso/ingest`

---

*Versão: v1.4 — Gerado em 2026-06-11*
*Status: PROPOSTA APROVADA — aguardando implementação*

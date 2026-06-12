# Lótus Live ↔ OpenClaw — Fila Operacional v1.6

Documento canônico do ciclo operacional entre a **Lótus Live** e a **OpenClaw**,
usando `pulso_requests` como fila única de trabalho segura.

---

## Objetivo da v1.6

Organizar o ciclo completo de handoff com:

- **Estados de lifecycle** claros para cada etapa do processamento OpenClaw
- **Fila auditável** de requests elegíveis em `pulso_requests`
- **Scripts CLI seguros** para consumo (`openclaw-next`) e devolução (`openclaw-return`)
- **UI atualizada** na Lótus Live exibindo os 5 estados do ciclo
- **Zero ações automáticas** — tudo em modo `proposal_only`

---

## Lifecycle Completo v1.6

```
┌─────────────────────────────────────────────────────────────┐
│                   LIFECYCLE OPENCLAW                         │
│                                                              │
│  [Lótus Live cria request]                                   │
│         │                                                    │
│         ▼                                                    │
│    requested  ──────────────────────────►  [ENTRADA NA FILA] │
│         │                                                    │
│         │  (script openclaw-next captura)                    │
│         ▼                                                    │
│  queued_for_openclaw  ─────────────────►  [ENVIADO PARA OC]  │
│         │                                                    │
│         │  (OpenClaw processando)                            │
│         ▼                                                    │
│  processing_by_openclaw  ──────────────►  [EM PROCESSAMENTO] │
│         │                                                    │
│         ├── (sucesso sem aprovação)                          │
│         │         ▼                                          │
│         │    proposal_ready  ─────────►  [RESPOSTA PRONTA]   │
│         │                                                    │
│         ├── (requer aprovação humana)                        │
│         │         ▼                                          │
│         │  waiting_user_approval  ────►  [AGUARDA HUMANO]    │
│         │                                                    │
│         └── (retorno inválido)                               │
│                   ▼                                          │
│            openclaw_failed  ───────────►  [FALHA NO RETORNO] │
└─────────────────────────────────────────────────────────────┘
```

### Tabela de Estados

| Status | Trigger | Próximo passo |
|---|---|---|
| `requested` | `handleSendMessage` no LivePage | Script captura e monta pacote |
| `queued_for_openclaw` | Opcional — após captura pelo script | OpenClaw processa |
| `processing_by_openclaw` | Opcional — OpenClaw pode gravar enquanto processa | Aguarda retorno |
| `proposal_ready` | `openclaw-return.mjs` com `requiresHumanApproval: false` | Lótus exibe resposta |
| `waiting_user_approval` | `openclaw-return.mjs` com `requiresHumanApproval: true` | Humano aprova ou rejeita |
| `openclaw_failed` | `openclaw-return.mjs` com JSON inválido ou erro | Humano corrige e re-envia |

### Compatibilidade retroativa

Estes status existentes permanecem funcionais:
- `requested` → ponto de entrada natural (não força `queued_for_openclaw`)
- `completed` → request finalizado e aprovado
- `needs_approval` → governança interna (não OpenClaw)
- `needs_clarification` → aguarda input do usuário
- `cancelled`, `failed`, `archived` → estados terminais

---

## Critérios de Elegibilidade para a Fila

Um request em `pulso_requests` é elegível para a OpenClaw quando:

```js
requestType === 'conversation_command'
origin      === 'lotus_live'
source      === 'pulso_live'          // opcional mas esperado
archived    !== true
status      in ['requested', 'queued_for_openclaw']
// handoff.target === 'openclaw'      // verificado localmente
// handoff.mode   === 'proposal_only' // garantido por liveIntentInterpreter
```

---

## Exemplo de Request Inicial (após `handleSendMessage`)

```json
{
  "id": "abc123",
  "requestType": "conversation_command",
  "title": "Lótus Live — como estão minhas tarefas hoje?",
  "summary": "como estão minhas tarefas hoje?",
  "status": "requested",
  "priority": "medium",
  "origin": "lotus_live",
  "source": "pulso_live",
  "requestedBy": "felipe@dutra",
  "requestedAt": "2026-06-12T14:00:00Z",
  "updatedAt": "2026-06-12T14:00:00Z",
  "archived": false,
  "interpretation": {
    "intent": "query_tasks",
    "domain": "tarefas",
    "riskLevel": "low",
    "canExecuteNow": false,
    "requiresConfirmation": false,
    "suggestedReply": "Vou consultar suas tarefas...",
    "handoff": {
      "target": "openclaw",
      "mode": "proposal_only",
      "canExecuteNow": false,
      "requiresHumanConfirmation": false,
      "intent": "query_tasks",
      "domain": "tarefas",
      "riskLevel": "low",
      "actionType": "read_query",
      "entitiesMentioned": ["tarefas", "hoje"],
      "suggestedNextStep": "Ler pulso_tasks e filtrar por hoje",
      "executionPrompt": "Consulte pulso_tasks e retorne as tarefas de hoje..."
    }
  }
}
```

---

## Exemplo de Request em Fila (após `openclaw-next`)

O script não altera o documento. O pacote gerado tem esta forma:

```json
{
  "meta": {
    "version": "v1.6",
    "generatedAt": "2026-06-12T14:01:00Z",
    "generator": "openclaw-next.mjs",
    "mode": "proposal_only",
    "securityConstraints": {
      "canExecuteNow": false,
      "noDirectMutations": true,
      "noExternalMessages": true,
      "noTaskCreation": true,
      "noProjectCreation": true,
      "noPersonCreation": true,
      "responseTarget": "workspaces/felipe_dutra/pulso_requests/abc123",
      "responseField": "openclawResult",
      "onlyAllowedActions": ["read", "create_proposal", "update_proposal"]
    }
  },
  "request": {
    "id": "abc123",
    "command": "como estão minhas tarefas hoje?",
    "status": "requested",
    "origin": "lotus_live",
    "source": "pulso_live"
  },
  "handoff": {
    "target": "openclaw",
    "mode": "proposal_only",
    "canExecuteNow": false,
    "intent": "query_tasks",
    "domain": "tarefas",
    "riskLevel": "low",
    "actionType": "read_query",
    "entitiesMentioned": ["tarefas", "hoje"],
    "executionPrompt": "Consulte pulso_tasks e retorne as tarefas de hoje..."
  },
  "responseSchema": {
    "processedBy": "openclaw",
    "responseText": "<string>",
    "summary": "<string>",
    "confidence": "<high|medium|low>",
    "riskLevel": "<low|medium|high>",
    "requiresHumanApproval": "<boolean>",
    "sourcesConsulted": ["<array>"],
    "proposedActions": [],
    "errors": [],
    "statusTransition": "proposal_ready | waiting_user_approval | openclaw_failed"
  }
}
```

---

## Exemplo de openclawResult (proposal_ready)

```json
{
  "processedBy": "openclaw",
  "processedAt": "2026-06-12T14:02:00Z",
  "createdAt": "2026-06-12T14:02:00Z",
  "responseText": "Você tem 3 tarefas para hoje: revisar proposta Alpha, call com Marcos e enviar relatório Gamma.",
  "summary": "3 tarefas encontradas para hoje",
  "confidence": "high",
  "riskLevel": "low",
  "requiresHumanApproval": false,
  "sourcesConsulted": ["pulso_tasks"],
  "proposedActions": [],
  "statusTransition": "proposal_ready"
}
```

---

## Exemplo de openclawResult (waiting_user_approval)

```json
{
  "processedBy": "openclaw",
  "processedAt": "2026-06-12T14:05:00Z",
  "responseText": "Encontrei 2 tarefas atrasadas. Proponho arquivá-las e criar uma nova com prazo estendido.",
  "summary": "Proposta de reorganização de tarefas atrasadas",
  "confidence": "medium",
  "riskLevel": "medium",
  "requiresHumanApproval": true,
  "sourcesConsulted": ["pulso_tasks"],
  "proposedActions": [
    {
      "label": "Arquivar task-001 (atrasada há 7 dias)",
      "riskLevel": "medium",
      "requiresConfirmation": true
    },
    {
      "label": "Criar nova task com prazo +14 dias",
      "riskLevel": "low",
      "requiresConfirmation": true
    }
  ],
  "statusTransition": "waiting_user_approval"
}
```

---

## Como a OpenClaw deve consumir

1. Rodar `node scripts/pulso/openclaw-next.mjs`
2. Receber o JSON do stdout
3. Ler `request.id` como `requestId`
4. Ler `handoff.executionPrompt` como instrução principal
5. Consultar somente as coleções em `responseSchema.onlyAllowedActions`
6. Nunca criar entidades, nunca executar propostas, nunca enviar mensagens externas
7. Montar o JSON de retorno com os campos do `responseSchema`

---

## Como a OpenClaw deve devolver

```bash
node scripts/pulso/openclaw-return.mjs <requestId> '<json>'
```

Campos **obrigatórios** no JSON de retorno:
- `responseText` (string, não vazio)

Campos **recomendados**:
- `summary`, `confidence`, `riskLevel`, `requiresHumanApproval`
- `sourcesConsulted`, `proposedActions`

Campos **bloqueados por segurança** (causam `openclaw_failed`):
- `executeNow`, `autoExecute`, `triggerFunction`, `callWebhook`

---

## O que continua bloqueado na v1.6

| Item | Status |
|---|---|
| Execução automática de propostas | ❌ Bloqueado |
| Criação de tarefas reais | ❌ Bloqueado |
| Criação de projetos reais | ❌ Bloqueado |
| Criação de pessoas reais | ❌ Bloqueado |
| Envio de mensagens externas | ❌ Bloqueado |
| Cloud Functions novas | ❌ Bloqueado |
| Coleções novas | ❌ Bloqueado |
| Credenciais hardcoded | ❌ Bloqueado |
| Integração WhatsApp/Notion/Gmail | ❌ Bloqueado |

---

## Próximo passo sugerido para v1.7

**v1.7 — Aprovação Humana Assistida**

Quando `status === 'waiting_user_approval'`, adicionar na Lótus Live:
- Botão `Aprovar Proposta` → atualiza status para `completed` (sem executar)
- Botão `Rejeitar Proposta` → atualiza para `cancelled`
- Log de decisão humana no campo `result.humanDecision`
- Registro no Registro da Lótus com a decisão

Ainda sem integrar sistemas externos. Apenas fechar o ciclo de aprovação dentro do PULSO.

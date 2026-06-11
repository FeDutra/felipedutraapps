# Contrato Lótus Live ↔ OpenClaw v1.5 — Ciclo Completo Assistido

Este documento descreve o primeiro ciclo real de ida e volta entre a **Lótus Live** e a **OpenClaw**,
operando em modo seguro sem execução automática.

---

## 1. O que a v1.5 adiciona à v1.4

| Funcionalidade | v1.4 | v1.5 |
|---|---|---|
| `openclawResult` no tipo | ✅ | ✅ |
| Lifecycle statuses | ✅ | ✅ |
| Badge "Pacote pronto" | ✅ (simples) | ✅ (expandido) |
| Copiar executionPrompt | ✅ | ✅ |
| **Copiar Pacote Completo** | ❌ | ✅ |
| **Registrar Resposta da OpenClaw** | ❌ | ✅ |
| `requestId` na mensagem | ❌ | ✅ |
| `originalCommand` na mensagem | ❌ | ✅ |
| Resposta OpenClaw exibida no bubble | ✅ (se presente) | ✅ |

---

## 2. Exemplo de Request — Antes do Retorno (status: requested)

```json
{
  "id": "req_1749688835142",
  "requestType": "conversation_command",
  "status": "requested",
  "title": "como estão minhas tarefas hoje?",
  "summary": "como estão minhas tarefas hoje?",
  "origin": "lotus_live",
  "source": "pulso_live",
  "archived": false,
  "requestedBy": "felipe@...",
  "requestedAt": "ServerTimestamp",
  "updatedAt": "ServerTimestamp",
  "interpretation": {
    "intent": "consulta_tarefas",
    "domain": "tarefas",
    "riskLevel": "low",
    "requiresConfirmation": false,
    "canExecuteNow": false,
    "sourcesNeeded": ["pulso_tasks", "pulso_projects", "pulso_people"],
    "suggestedReply": "Você possui X tarefas ativas..."
  },
  "handoff": {
    "target": "openclaw",
    "mode": "proposal_only",
    "canExecuteNow": false,
    "requiresHumanConfirmation": false,
    "intent": "consulta_tarefas",
    "domain": "tarefas",
    "riskLevel": "low",
    "actionType": "read",
    "entitiesMentioned": ["Felipe"],
    "suggestedNextStep": "Detalhar tarefas atrasadas e propor ordem de priorização.",
    "executionPrompt": "Consultar tarefas ativas de Felipe..."
  }
}
```

## 3. Exemplo de Request — Após Retorno da OpenClaw (status: proposal_ready)

```json
{
  "id": "req_1749688835142",
  "status": "proposal_ready",
  "updatedAt": "ServerTimestamp",
  "openclawResult": {
    "processedBy": "openclaw",
    "processedAt": "2026-06-11T23:30:00Z",
    "responseText": "Você tem 12 tarefas abertas, sendo 4 atribuídas a você diretamente. 2 estão atrasadas: 'Revisar contrato OPC' (vencida há 3 dias) e 'Fechar reunião Murilo' (vencida ontem). Prioridade imediata: resolver os 2 itens em atraso.",
    "statusTransition": "proposal_ready",
    "sourcesConsulted": ["pulso_tasks", "pulso_projects"],
    "proposedMutation": null,
    "auditLog": {
      "model": "gemini-2.0-flash",
      "skillUsed": "pulso/query_tasks",
      "confidence": "high",
      "notes": "Consultou 24 tarefas ativas. Filtrou por ownerRefs contendo 'felipe'."
    }
  }
}
```

---

## 4. Lifecycle de Status v1.5

```
requested                   ← gerado pela Lótus Live ao enviar comando
    │
    │ OpenClaw faz claim (via GET /pending + POST /claim ou update direto)
    ▼
running                     ← opcional: OpenClaw sinaliza que está processando
    │
    │ OpenClaw grava openclawResult + atualiza status
    ▼
proposal_ready              ← retorno ready para exibição (requiresHumanConfirmation = false)
    │
    └── OU
    ▼
waiting_user_approval       ← retorno requer confirmação humana
    │
    ├── aprovado via approveRequest() → completed
    └── rejeitado via rejectRequest() → failed
```

---

## 5. Pacote Completo de Handoff (Copiar Pacote)

A função `buildHandoffPackage()` em `LivePage.tsx` gera:

```json
{
  "meta": {
    "version": "v1.5",
    "generatedAt": "ISO8601",
    "mode": "proposal_only",
    "securityConstraints": {
      "canExecuteNow": false,
      "noDirectMutations": true,
      "noExternalMessages": true,
      "responseTarget": "pulso_requests/{requestId}.openclawResult",
      "onlyAllowedActions": ["read", "create_proposal", "update_proposal"]
    }
  },
  "request": {
    "id": "req_...",
    "command": "como estão minhas tarefas hoje?",
    "origin": "lotus_live",
    "source": "pulso_live"
  },
  "handoff": {
    "target": "openclaw",
    "intent": "consulta_tarefas",
    "domain": "tarefas",
    "riskLevel": "low",
    "actionType": "read",
    "requiresHumanConfirmation": false,
    "entitiesMentioned": ["Felipe"],
    "suggestedNextStep": "...",
    "executionPrompt": "..."
  },
  "responseSchema": {
    "processedBy": "openclaw",
    "responseText": "<string: resposta em linguagem natural>",
    "statusTransition": "proposal_ready | waiting_user_approval | completed | failed",
    "sourcesConsulted": ["<array de strings>"],
    "proposedMutation": null,
    "auditLog": {
      "model": "<opcional>",
      "skillUsed": "<opcional>",
      "confidence": "high | medium | low"
    }
  }
}
```

---

## 6. Como a OpenClaw deve devolver a resposta

### 6.1 Via Firestore SDK (recomendado)

```python
# A OpenClaw deve:
# 1. Ler requests pendentes
reqs = db.collection('workspaces/felipe_dutra/pulso_requests') \
  .where('requestType', '==', 'conversation_command') \
  .where('status', '==', 'requested') \
  .where('archived', '==', False) \
  .order_by('requestedAt', direction='DESCENDING') \
  .limit(10).get()

for req in reqs:
  data = req.to_dict()
  handoff = data.get('handoff', {})
  
  # 2. Processar via executionPrompt
  response_text = run_gemini(handoff['executionPrompt'])
  
  needs_approval = handoff.get('requiresHumanConfirmation', False)
  new_status = 'waiting_user_approval' if needs_approval else 'proposal_ready'
  
  # 3. Gravar openclawResult — a Lótus Live detecta e exibe
  req.reference.update({
    'status': new_status,
    'updatedAt': firestore.SERVER_TIMESTAMP,
    'openclawResult': {
      'processedBy': 'openclaw',
      'processedAt': datetime.utcnow().isoformat(),
      'responseText': response_text,
      'statusTransition': new_status,
      'sourcesConsulted': ['pulso_tasks'],
      'auditLog': {
        'model': 'gemini-2.0-flash',
        'confidence': 'high'
      }
    }
  })
```

### 6.2 Via Requests Bridge HTTP (alternativa)

```http
POST https://felipedutraapps.web.app/api/pulso/requests/complete
Authorization: Bearer $PULSO_INGEST_TOKEN
Content-Type: application/json

{
  "requestId": "req_...",
  "result": {
    "openclawResult": { ... },
    "action": "proposal_ready"
  }
}
```

### 6.3 Via Retorno Manual (v1.5 — Operação Assistida)

1. Enviar comando na Lótus Live
2. Clicar **"Copiar Pacote"** → colar no OpenClaw/Gemini como prompt de sistema
3. OpenClaw processa e retorna `responseText`
4. Clicar **"Registrar Retorno da OpenClaw"** → colar a resposta → Submit
5. A Lótus Live grava `openclawResult` no Firestore e exibe imediatamente

---

## 7. O que CONTINUA BLOQUEADO na v1.5

| Ação | Status |
|---|---|
| Criar tarefas automaticamente | ❌ BLOQUEADO |
| Criar projetos automaticamente | ❌ BLOQUEADO |
| Enviar mensagens externas (WhatsApp, email) | ❌ BLOQUEADO |
| Executar qualquer ação sem aprovação humana | ❌ BLOQUEADO |
| Criar novas coleções Firestore | ❌ BLOQUEADO |
| Expor tokens ou credenciais no frontend | ❌ BLOQUEADO |
| Cloud Functions novas | ❌ BLOQUEADO |
| Mutações automáticas via openclawResult | ❌ BLOQUEADO (apenas proposta gravada) |

---

## 8. Segurança do Retorno Manual

O mecanismo de retorno manual (`handleRegisterOpenClawResponse`) é seguro porque:
- Só escreve no documento `pulso_requests` que já existe
- Só atualiza os campos `openclawResult`, `status` e `updatedAt`
- `openclawResult` é um campo de texto/objeto sem gatilho de execução
- Nenhuma Cloud Function escuta `openclawResult` para executar ações
- O usuário controla 100% do texto que é gravado
- O `requestId` vem do documento já salvo — não cria nada novo

---

## 9. Arquivos Alterados na v1.5

| Arquivo | Mudança |
|---|---|
| `LivePage.tsx` | +requestId/originalCommand, buildHandoffPackage, handleRegisterOpenClawResponse, UI inline |
| `lotus-live-openclaw-handoff-v1.5.md` | Este arquivo (novo) |
| `pulso.types.ts` | Sem mudança — tipos já completos da v1.4 |
| `liveIntentInterpreter.ts` | Sem mudança |
| Cloud Functions | Sem mudança |
| Firestore rules | Sem mudança |

---

*Versão: v1.5 — 2026-06-11*
*Status: IMPLEMENTADO E EM PRODUÇÃO*

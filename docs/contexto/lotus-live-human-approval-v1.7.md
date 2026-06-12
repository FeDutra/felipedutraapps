# Lótus Live — Aprovação Humana Assistida v1.7

Documento canônico da camada de governança humana sobre propostas da OpenClaw.
Sem execução automática. Apenas registro de decisão.

---

## Objetivo da v1.7

Fechar o ciclo de proposta dentro da Lótus Live:

1. Lótus cria request → OpenClaw devolve `openclawResult`
2. Se `requiresHumanApproval: true` → Lótus exibe botões **Aprovar** / **Rejeitar**
3. Usuário decide → decisão gravada em `userApproval` no mesmo documento
4. Status transita para `approved_by_user` ou `rejected_by_user`
5. **Nenhuma ação real é executada**

---

## Fluxo Completo

```
┌──────────────────────────────────────────────────────────────┐
│              CICLO COMPLETO v1.3 → v1.7                       │
│                                                               │
│  [Usuário envia comando]                                      │
│         │                                                     │
│         ▼                                                     │
│  [Lótus cria request em pulso_requests]     status: requested │
│         │                                                     │
│         ▼                                                     │
│  [openclaw-next.mjs captura pacote]                           │
│         │                                                     │
│         ▼                                                     │
│  [OpenClaw processa e devolve openclawResult]                 │
│  [openclaw-return.mjs grava em pulso_requests]                │
│         │                                                     │
│         ├── requiresHumanApproval: false                      │
│         │         ▼                                           │
│         │  status: proposal_ready  ─────── Lótus exibe resp.  │
│         │                                                     │
│         └── requiresHumanApproval: true                       │
│                   ▼                                           │
│          status: waiting_user_approval                        │
│                   │                                           │
│                   ├── Usuário aprova                          │
│                   │         ▼                                 │
│                   │  status: approved_by_user                 │
│                   │  userApproval.approved = true             │
│                   │  ✗ Nenhuma ação executada                 │
│                   │                                           │
│                   └── Usuário rejeita                         │
│                             ▼                                 │
│                    status: rejected_by_user                   │
│                    userApproval.approved = false              │
│                    ✗ Nenhuma ação executada                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Lifecycle Completo (v1.3 → v1.7)

| Status | Origem | Próximo passo |
|---|---|---|
| `requested` | handleSendMessage | openclaw-next captura |
| `queued_for_openclaw` | Opcional | OpenClaw processa |
| `processing_by_openclaw` | Opcional | Aguarda retorno |
| `proposal_ready` | openclaw-return (sem aprovação) | Lótus exibe resposta final |
| `waiting_user_approval` | openclaw-return (requer aprovação) | Usuário decide na Lótus |
| `approved_by_user` | handleApproveProposal | **v1.8**: execução assistida futura |
| `rejected_by_user` | handleRejectProposal | Ciclo encerrado |
| `openclaw_failed` | openclaw-return (JSON inválido) | Usuário re-envia |

---

## Exemplo de Request Antes da OpenClaw

```json
{
  "id": "xyz789",
  "requestType": "conversation_command",
  "title": "Lótus Live — crie uma tarefa para revisar o contrato amanhã",
  "summary": "crie uma tarefa para revisar o contrato amanhã",
  "status": "requested",
  "origin": "lotus_live",
  "source": "pulso_live",
  "requestedBy": "felipe@dutra",
  "handoff": {
    "target": "openclaw",
    "mode": "proposal_only",
    "canExecuteNow": false,
    "requiresHumanConfirmation": true,
    "intent": "create_task",
    "domain": "tarefas",
    "riskLevel": "medium",
    "actionType": "create_proposal"
  }
}
```

---

## Exemplo de openclawResult (requiresHumanApproval: true)

```json
{
  "processedBy": "openclaw",
  "processedAt": "2026-06-12T15:00:00Z",
  "responseText": "Proponho criar uma tarefa 'Revisar contrato' com prazo para amanhã.",
  "summary": "Proposta de criação de tarefa",
  "confidence": "high",
  "riskLevel": "medium",
  "requiresHumanApproval": true,
  "proposedActions": [
    {
      "label": "Criar tarefa: Revisar contrato amanhã",
      "riskLevel": "medium",
      "requiresConfirmation": true
    }
  ],
  "statusTransition": "waiting_user_approval"
}
```

---

## Exemplo de Request Aprovado

```json
{
  "id": "xyz789",
  "status": "approved_by_user",
  "openclawResult": {
    "responseText": "Proponho criar uma tarefa 'Revisar contrato'...",
    "requiresHumanApproval": true
  },
  "userApproval": {
    "approved": true,
    "approvedBy": "felipe@dutra",
    "approvedAt": "2026-06-12T15:02:30Z",
    "note": "Ok, mas revisar também o anexo B"
  },
  "updatedAt": "2026-06-12T15:02:30Z"
}
```

---

## Exemplo de Request Rejeitado

```json
{
  "id": "xyz789",
  "status": "rejected_by_user",
  "openclawResult": {
    "responseText": "Proponho criar uma tarefa 'Revisar contrato'...",
    "requiresHumanApproval": true
  },
  "userApproval": {
    "approved": false,
    "rejectedBy": "felipe@dutra",
    "rejectedAt": "2026-06-12T15:03:10Z",
    "reason": "Contrato cancelado, não criar tarefa"
  },
  "updatedAt": "2026-06-12T15:03:10Z"
}
```

---

## Garantias de Não Execução

| Garantia | Mecanismo |
|---|---|
| Aprovar não cria tarefa | `approveOpenClawProposal` só escreve em `userApproval`, `status`, `updatedAt` |
| Aprovar não cria projeto | Mesma razão — sem chamadas externas |
| Aprovar não envia mensagem | Sem webhook, sem Cloud Function, sem endpoint externo |
| Rejeitar não executa nada | `rejectOpenClawProposal` só escreve em `userApproval`, `status`, `updatedAt` |
| Aprovação não aciona OpenClaw | Sem callback reverso implementado |
| Segurança no script de retorno | `openclaw-return.mjs` bloqueia campos `executeNow`, `autoExecute`, etc. |

---

## Scripts existentes — sem quebra

Os scripts v1.6 não foram alterados:
- `openclaw-next.mjs` — continua funcionando igual
- `openclaw-return.mjs` — continua funcionando igual; quando grava `requiresHumanApproval: true`, a UI v1.7 exibe os botões automaticamente

---

## Próximo passo sugerido para v1.8

**v1.8 — Execução Assistida de Primeira Ação**

Quando `status === 'approved_by_user'` e a proposta é classificada como baixo risco (`riskLevel: low`):
- Adicionar um botão "Executar" restrito a ações read-safe (ex: consultar tarefas)
- Ou um formulário de confirmação explícita para criar a entidade
- Registro completo em `result.executionLog`
- Ainda sem integrações externas (Notion, WhatsApp, Gmail)
- Ainda sem Cloud Function autônoma

O objetivo é fechar o loop para `create_task` de baixo risco: aprovação → formulário → criação real em `pulso_tasks` — dentro do PULSO, sem sistema externo.

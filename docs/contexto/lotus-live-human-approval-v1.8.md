# Lótus Live — Execução Assistida Segura v1.8

Documento canônico da camada de execução assistida e governança sobre propostas da OpenClaw aprovadas pelo usuário.
Sem execução automática. Apenas ações assistidas e validadas pela Allowlist.

---

## Objetivo da v1.8

Permitir que uma proposta da OpenClaw aprovada pelo usuário no Cockpit crie uma entidade real no banco de dados do PULSO.
**Apenas a criação de tarefas internas (`pulso_tasks`) de baixo e médio risco é permitida nesta versão.**
Nenhuma chamada externa, Cloud Function ou webhook é disparado.

---

## Regra de Ouro (Governance Barrier)

A execução de uma proposta é permitida se, e somente se, todas as condições abaixo forem verdadeiras:

1. **Status do Request:** O request está em `approved_by_user` ou `execution_blocked`.
2. **Consentimento:** `request.userApproval.approved === true`.
3. **Resultado Presente:** `request.openclawResult` existe.
4. **Governança:** `request.openclawResult.requiresHumanApproval === true`.
5. **Mutação Sugerida:** `request.openclawResult.proposedMutation` existe.
6. **Tipo Permitido (Allowlist):** O tipo da ação (`proposedMutation.type`) é estritamente `create_task`.
7. **Risco Controlado:** O nível de risco (`riskLevel`) é `low` ou `medium`.
8. **Não Duplicação:** `executedAt` e `createdEntityRef` não existem no request original (prevenção de double-execution).

---

## Regras de Validação de Dados (Schema Matcher)

Ao acionar a execução, os dados propostos na mutação passam por validação local:

* **Título (`title`/`name`):** 
  - Se faltar: aborta a execução, transita o request para `execution_blocked` e registra o erro em `executionError`.
* **Responsáveis (`ownerRefs`):**
  - Se faltar: verifica se o request representa "triagem explícita" (comando contém as palavras "triagem" ou "triage", ou flag `isTriage: true` no payload).
  - Se não for triagem explícita: bloqueia a execução (`execution_blocked`), informando que falta responsável. Exibe a opção manual de "Confirmar como Triagem & Executar" na UI.
* **Projeto (`projectRef`):**
  - Se faltar: permite a criação da tarefa, mas injeta a tag `"sem-projeto"` e deixa `projectRef: null`.
* **Prioridade (`priority`):**
  - Se faltar: assume o valor padrão `'medium'`.

---

## Estados do Ciclo de Execução

Ao executar com sucesso:
- Um novo documento é inserido em `pulso_tasks`.
- O documento em `pulso_requests` é atualizado com:
  - `status`: `'executed'`
  - `executedAt`: data atual
  - `executedBy`: e-mail do executor (`'felipe@dutra'`)
  - `createdEntityRef`: `'pulso_tasks/' + taskId`
  - `executionError`: limpo (`""`)

---

## Exemplos de Payload

### 1. Request Aprovado (Aguardando Execução)

```json
{
  "id": "req_123",
  "requestType": "conversation_command",
  "title": "crie uma tarefa para revisar o código da live",
  "summary": "crie uma tarefa para revisar o código da live",
  "status": "approved_by_user",
  "openclawResult": {
    "requiresHumanApproval": true,
    "riskLevel": "low",
    "proposedMutation": {
      "type": "create_task",
      "previewLabel": "Criar tarefa: Revisar o código da live",
      "payload": {
        "title": "Revisar o código da live",
        "priority": "medium",
        "ownerRefs": ["felipe@dutra"]
      }
    }
  },
  "userApproval": {
    "approved": true,
    "approvedAt": "2026-06-12T16:00:00Z",
    "approvedBy": "felipe@dutra"
  }
}
```

### 2. Request Executado

```json
{
  "id": "req_123",
  "status": "executed",
  "executedAt": "2026-06-12T16:05:00Z",
  "executedBy": "felipe@dutra",
  "createdEntityRef": "pulso_tasks/task_456"
}
```

### 3. Tarefa Gerada em `pulso_tasks`

```json
{
  "id": "task_456",
  "name": "Revisar o código da live",
  "title": "Revisar o código da live",
  "description": "crie uma tarefa para revisar o código da live",
  "status": "open",
  "priority": "medium",
  "ownerRefs": ["felipe@dutra"],
  "projectRef": null,
  "areaRef": null,
  "sourceRefs": ["req_123"],
  "tags": ["sem-projeto"],
  "origin": "lotus_live",
  "createdBy": "felipe@dutra",
  "createdAt": "2026-06-12T16:05:00Z",
  "updatedAt": "2026-06-12T16:05:00Z",
  "archived": false
}
```

---

## Garantias de Segurança e Limitação

| Canal | Restrição na v1.8 |
|---|---|
| Canais Externos (Notion, WhatsApp, Calendar, etc.) | Estritamente bloqueado. Nenhuma ação externa é efetuada. |
| Automações Autónomas (Cloud Functions) | Inexistente. A execução depende inteiramente do clique do usuário na UI. |
| Alteração de coleções de terceiros | Bloqueado. Apenas `pulso_tasks` é mutada. |
| Risco Alto (`riskLevel: high`) | Rejeitado antes da execução (bloqueio por governança). |

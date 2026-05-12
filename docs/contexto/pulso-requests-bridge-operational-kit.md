# Requests Bridge Operational Kit: Especificação e Manual de Integração

Este manual consolida a interface operacional, os contratos técnicos e as rotas canônicas da **Requests Bridge**. Seu objetivo é fornecer à Lótus/OpenClaw as ferramentas de interação programática para orquestrar o ciclo de vida completo de intenções operacionais e atestar de forma rastreável a sua respectiva **Materialização Canônica** no ecossistema PULSO.

---

## 1. Base URL Real da Requests Bridge
Todas as chamadas de integração devem ser roteadas para a Cloud Function canônica de produção:

*   **URL Base da Cloud Function**: `https://us-central1-felipedutraapps.cloudfunctions.net/pulsoRequests`
*   **URL Base via Rewrite (PULSO API)**: `https://felipedutraapps.web.app/api/pulso/requests`

---

## 2. Autenticação
O acesso operacional é estritamente autorizado mediante verificação de token no cabeçalho HTTP da requisição.

*   **Formato do Header**: `Authorization: Bearer <TOKEN>`
*   **Variável de Ambiente Esperada**: `PULSO_INGEST_TOKEN`
*   **Exemplo Canônico**:
    ```http
    Authorization: Bearer $PULSO_INGEST_TOKEN
    ```

---

## 3. Endpoints Reais Disponíveis

A ponte expõe os seguintes endpoints REST sob a Base URL para o controle transacional do ciclo de vida das solicitações:

| Endpoint | Método | Descrição | Resposta de Sucesso |
| :--- | :--- | :--- | :--- |
| `/create` | `POST` | Cria nova solicitação operacional com suporte a deduplicação | `201 Created` / `200 OK` (Duplicate) |
| `/pending` | `GET` | Lista solicitações com status `requested` aguardando triagem | `200 OK` (Array de objetos) |
| `/claim` | `POST` | Aplica lock transacional na solicitação (`running`) | `200 OK` (`claimed`) |
| `/complete` | `POST` | Finaliza a solicitação e aciona a materialização canônica | `200 OK` (`completed`) |
| `/fail` | `POST` | Sinaliza erro técnico ou falha irrecuperável de processamento | `200 OK` (`failed`) |
| `/needs-clarification` | `POST` | Pausa solicitação aguardando esclarecimento ou dados extras | `200 OK` (`needs_clarification`) |
| `/needs-approval` | `POST` | Pausa solicitação exigindo aprovação estrutural/governança | `200 OK` (`needs_approval`) |
| `/:id` | `GET` | Consulta o documento de uma solicitação específica por ID | `200 OK` (Objeto completo com result) |

---

## 4. Exemplos cURL de Operação

### 4.1 Criar `register_person`
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "register_person",
    "title": "Registrar Stakeholder: Mariana",
    "summary": "Captura autônoma de contato.",
    "priority": "medium",
    "areaRef": "area_openclaw",
    "requestedBy": "agent_lotus",
    "dedupeKey": "person_mariana_999",
    "origin": { "channel": "whatsapp", "source": "openclaw" },
    "payload": {
      "name": "Mariana",
      "role": "Consultora Externa",
      "attentionLevel": "high",
      "notes": "Parceira estratégica de processos."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

### 4.2 Criar `register_source`
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "register_source",
    "title": "Registrar Fonte: Planilha Base",
    "summary": "Planilha financeira unificada.",
    "priority": "high",
    "requestedBy": "agent_lotus",
    "dedupeKey": "source_planilha_base_001",
    "payload": {
      "name": "Planilha Financeira Unificada",
      "type": "google_sheets",
      "url": "https://docs.google.com/spreadsheets/d/abc123xyz",
      "relevance": "critical"
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

### 4.3 Criar `create_task`
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "create_task",
    "title": "Estruturar Relatório Semanal",
    "priority": "high",
    "requestedBy": "agent_lotus",
    "dedupeKey": "task_relatorio_001",
    "payload": {
      "title": "Estruturar Relatório Semanal",
      "description": "Compilar avanços das obras e finanças operacionais."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```

### 4.4 Listar Pendentes (`pending`)
```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/pending?limit=5"
```

### 4.5 Fazer Lock (`claim`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_123456", "processedBy": "openclaw_agent"}' \
  "https://felipedutraapps.web.app/api/pulso/requests/claim"
```

### 4.6 Concluir e Materializar (`complete`)
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_123456", "result": {"status": "success"}}' \
  "https://felipedutraapps.web.app/api/pulso/requests/complete"
```

### 4.7 Consultar Request por ID
```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/req_123456"
```

---

## 5. Shape Real do Request e do Result

### Shape de Entrada Canônico
```json
{
  "id": "req_123456",
  "requestType": "register_person",
  "title": "Registrar Stakeholder: Mariana",
  "summary": "Captura autônoma de contato.",
  "status": "requested",
  "priority": "medium",
  "requestedBy": "agent_lotus",
  "dedupeKey": "person_mariana_999",
  "origin": {
    "channel": "whatsapp",
    "source": "openclaw"
  },
  "payload": {
    "name": "Mariana",
    "role": "Consultora Externa"
  },
  "requestedAt": "2026-05-12T10:00:00.000Z"
}
```

### Shape do Objeto de Resultado (`result`) após Conclusão
Quando a transação aciona o Dispatcher de Materialização e conclui com sucesso, a chave `result` contém a auditoria de destino:
```json
{
  "status": "success",
  "entityRef": "person_mariana",
  "entityPath": "workspaces/felipe_dutra/pulso_people/person_mariana",
  "matResult": {
    "ok": true,
    "action": "created",
    "entityType": "person",
    "entityRef": "person_mariana",
    "entityPath": "workspaces/felipe_dutra/pulso_people/person_mariana",
    "summary": "Entidade materializada."
  }
}
```
*Se houver falha de validação estrutural:*
```json
{
  "ok": false,
  "action": "needs_clarification",
  "summary": "Nome é obrigatório.",
  "missingFields": ["name"],
  "error": "Validação falhou por ausência de payload obrigatório."
}
```

---

## 6. Paths Canônicos de Coleções no Firestore
A Lótus/OpenClaw deve utilizar os seguintes caminhos exatos sob o escopo do workspace para inspecionar os documentos canônicos materializados:

*   **Ponte de Intenções**: `workspaces/felipe_dutra/pulso_requests`
*   **Pessoas**: `workspaces/felipe_dutra/pulso_people`
*   **Fontes**: `workspaces/felipe_dutra/pulso_sources`
*   **Tarefas**: `workspaces/felipe_dutra/pulso_tasks`
*   **Decisões**: `workspaces/felipe_dutra/pulso_decisions`
*   **Alertas**: `workspaces/felipe_dutra/pulso_alerts`
*   **Projetos**: `workspaces/felipe_dutra/pulso_projects`
*   **Áreas**: `workspaces/felipe_dutra/pulso_areas`
*   **Agentes**: `workspaces/felipe_dutra/pulso_agents`
*   **Rotinas**: `workspaces/felipe_dutra/pulso_routines`

---

## 7. Critério de Certificação Externa
> **IMPORTANTE**: A materialização geral não deve ser declarada como "validada pela OpenClaw" na documentação de status técnico até que a própria OpenClaw consuma as chaves `entityRef` e `entityPath` retornadas neste kit e prove a existência efetiva do documento gravado de forma autônoma na respectiva coleção canônica.

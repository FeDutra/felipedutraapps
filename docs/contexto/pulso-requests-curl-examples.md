# Catálogo de Chamadas cURL: Requests Bridge Operational Kit

Este catálogo lista os comandos prontos para a Lótus/OpenClaw acionar e testar o ciclo operacional transacional completo da **Requests Bridge**, mantendo o token de autenticação protegido na variável de ambiente `$PULSO_INGEST_TOKEN`.

---

## 1. Criar Solicitações Operacionais (`POST /create`)

### 1.1 Criar `register_person`
```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "register_person",
    "title": "Registrar Stakeholder: Mariana",
    "summary": "Captura autônoma de contato via OpenClaw.",
    "priority": "medium",
    "areaRef": "area_openclaw",
    "requestedBy": "agent_lotus",
    "dedupeKey": "person_mariana_001",
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
**Resposta Esperada**: `{"status":"created","requestId":"req_123456_abc"}`

### 1.2 Criar `register_source`
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
**Resposta Esperada**: `{"status":"created","requestId":"req_123456_def"}`

### 1.3 Criar `create_task`
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
**Resposta Esperada**: `{"status":"created","requestId":"req_123456_ghi"}`

---

## 2. Listar Fila de Pendentes (`GET /pending`)
Lista as intenções operacionais que ainda não possuem um lock de agente e estão no status `requested`.

```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/pending?limit=10&status=requested"
```

---

## 3. Lock Transacional de Agente (`POST /claim`)
Reivindica a solicitação, trocando seu status para `running` de forma atômica para impedir colisões de processamento.

```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_123456_abc",
    "processedBy": "openclaw_agent_lotus"
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/claim"
```
**Resposta Esperada**: `claimed`

---

## 4. Conclusão e Gatilho de Materialização (`POST /complete`)
Finaliza o fluxo operacional acionando o Dispatcher de Materialização que escreve o registro canônico na coleção correspondente.

```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_123456_abc",
    "result": {
      "status": "success",
      "notes": "Processamento externo validado com sucesso via Lótus."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/complete"
```
**Resposta Esperada**: `completed`

---

## 5. Consultar Desfecho e Chaves por ID (`GET /:id`)
Busca o documento completo da solicitação para auditar as chaves canônicas de navegação geradas (`result.entityRef` e `result.entityPath`).

```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/req_123456_abc"
```
**Resposta Esperada**:
```json
{
  "id": "req_123456_abc",
  "requestType": "register_person",
  "status": "completed",
  "title": "Registrar Stakeholder: Mariana",
  "result": {
    "status": "success",
    "notes": "Processamento externo validado com sucesso via Lótus.",
    "matResult": {
      "ok": true,
      "action": "created",
      "entityType": "person",
      "entityRef": "person_mariana",
      "entityPath": "workspaces/felipe_dutra/pulso_people/person_mariana",
      "summary": "Entidade materializada."
    }
  },
  "updatedAt": "2026-05-12T10:05:00.000Z"
}
```

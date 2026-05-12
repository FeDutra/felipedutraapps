# Exemplos cURL: Interação com a Requests Bridge

Este documento fornece comandos `cURL` prontos para uso que ilustram como consumir programaticamente os endpoints da camada **Requests Bridge**. Os comandos utilizam a variável de ambiente `$PULSO_INGEST_TOKEN` para manter as credenciais protegidas.

---

## 1. Criar Solicitação (`POST /create`)
Cria uma solicitação operacional autônoma simulando a captura a partir de uma mensagem do WhatsApp.

```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "register_person",
    "title": "Registrar Stakeholder: Juliana",
    "summary": "Nova parceira estratégica identificada via Lótus.",
    "priority": "high",
    "areaRef": "area_openclaw",
    "requestedBy": "agent_lotus",
    "dedupeKey": "whats_msg_999888",
    "origin": {
      "channel": "whatsapp",
      "source": "openclaw"
    },
    "payload": {
      "name": "Juliana",
      "role": "Líder de Operações",
      "attentionLevel": "high",
      "notes": "Ponto de contato chave para integrações."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/create"
```
**Saída Esperada**:
```json
{"status":"created","requestId":"req_1778549999999_xyz123"}
```

---

## 2. Listar Solicitações Pendentes (`GET /pending`)
Busca as solicitações que ainda não foram processadas (status `requested`).

```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/pending?limit=5&status=requested"
```

---

## 3. Fazer Lock / Claim (`POST /claim`)
Aplica o bloqueio transacional na solicitação para iniciar o processamento com exclusividade.

```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_1778549999999_xyz123",
    "processedBy": "openclaw_agent_lotus"
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/claim"
```
**Saída Esperada**:
```
claimed
```

---

## 4. Concluir e Materializar (`POST /complete`)
Finaliza a solicitação acionando a materialização direta para a coleção `pulso_people`.

```bash
curl -X POST -s \
  -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_1778549999999_xyz123",
    "result": {
      "status": "success",
      "log": "Processamento Lótus validado."
    }
  }' \
  "https://felipedutraapps.web.app/api/pulso/requests/complete"
```
**Saída Esperada**:
```
completed
```

---

## 5. Consultar Solicitação por ID (`GET /:id`)
Inspeciona o documento final e seus metadados de materialização gerados de forma canônica.

```bash
curl -s -H "Authorization: Bearer $PULSO_INGEST_TOKEN" \
  "https://felipedutraapps.web.app/api/pulso/requests/req_1778549999999_xyz123"
```
**Saída Esperada**:
```json
{
  "id": "req_1778549999999_xyz123",
  "requestType": "register_person",
  "status": "completed",
  "title": "Registrar Stakeholder: Juliana",
  "result": {
    "status": "success",
    "log": "Processamento Lótus validado.",
    "matResult": {
      "ok": true,
      "action": "created",
      "entityType": "person",
      "entityRef": "person_juliana",
      "entityPath": "workspaces/felipe_dutra/pulso_people/person_juliana",
      "summary": "Entidade materializada."
    }
  },
  "updatedAt": "2026-05-12T05:30:00.000Z"
}
```

---

## 6. Provar Materialização na Base Canônica
Como a consulta direta ao Firestore via API REST do Firebase requer chaves ou regras específicas, a verificação externa final da existência de `workspaces/felipe_dutra/pulso_people/person_juliana` prova conclusivamente a solidez do ciclo operacional para a OpenClaw.

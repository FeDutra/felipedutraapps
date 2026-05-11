# PULSO Requests Bridge (OpenClaw)

Esta ponte permite que agentes externos (OpenClaw/Lótus) consultem e processem solicitações operacionais geradas pela interface do PULSO.

## Autenticação

Todos os endpoints exigem o header `Authorization` com o token de ingestão.

```http
Authorization: Bearer <PULSO_INGEST_TOKEN>
```

---

## Endpoints

### 1. Listar Pendentes
`GET /pulsoRequests/pending`

Retorna uma lista de solicitações com status `requested`.

**Parâmetros (Query):**
- `limit`: (opcional, default: 20)
- `requestType`: (opcional) ex: `create_agent`
- `status`: (opcional, default: `requested`)

**Exemplo de Resposta:**
```json
[
  {
    "id": "req_123456",
    "requestType": "create_agent",
    "title": "Solicitação: Novo Agente - Auditor",
    "summary": "Missão: Auditar notas fiscais",
    "status": "requested",
    "priority": "medium",
    "payload": { ... },
    "requestedAt": "2024-05-11T12:00:00Z"
  }
]
```

### 2. Assumir Solicitação (Claim)
`POST /pulsoRequests/claim`

Muda o status de `requested` para `running`. Impede que outros agentes processem simultaneamente.

**Payload:**
```json
{
  "requestId": "req_123456",
  "processedBy": "agent_openclaw_v1"
}
```

### 3. Completar Solicitação
`POST /pulsoRequests/complete`

Finaliza a solicitação com sucesso.

**Payload:**
```json
{
  "requestId": "req_123456",
  "result": { "message": "Agente criado com sucesso", "agentId": "agent_001" },
  "emittedEvents": ["agent_created", "workspace_updated"]
}
```

### 4. Falhar Solicitação
`POST /pulsoRequests/fail`

Registra um erro na execução.

**Payload:**
```json
{
  "requestId": "req_123456",
  "error": "Timeout na API de destino",
  "recoverable": true
}
```

### 5. Pedir Esclarecimento
`POST /pulsoRequests/needs-clarification`

Solicita mais dados ao usuário.

**Payload:**
```json
{
  "requestId": "req_123456",
  "question": "Qual o limite de orçamento para este agente?",
  "missingFields": ["budget_limit"]
}
```

---

## Fluxo de Operação Recomendado

1. **Audit**: Chame `/pending` a cada X minutos.
2. **Lock**: Chame `/claim` para garantir a exclusividade.
3. **Execute**: Processe a lógica no OpenClaw.
4. **Report**: Chame `/complete` ou `/fail` ao terminar.

## Teste Rápido (cURL)

```bash
# Listar pendentes
curl -H "Authorization: Bearer <TOKEN>" \
     "https://us-central1-felipedutraapps.cloudfunctions.net/pulsoRequests/pending"

# Claim
curl -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
     -d '{"requestId": "ID_AQUI", "processedBy": "meu_agente"}' \
     "https://us-central1-felipedutraapps.cloudfunctions.net/pulsoRequests/claim"
```

# Contrato de Integração: OpenClaw <> PULSO

Este documento define o protocolo de comunicação entre a camada operacional (**OpenClaw / Agente Lótus**) e a central de estado (**PULSO**).

## 1. Visão Geral
O fluxo principal é **OpenClaw -> PULSO**. A Lótus captura informações do mundo real (áudio, mensagens, documentos) e injeta dados estruturados no PULSO através do barramento de ingestão.

O fluxo secundário é **PULSO -> OpenClaw**, onde o PULSO gera eventos no Outbox que a Lótus pode ler para sincronizar seu estado interno ou disparar ações em ferramentas externas.

## 2. Contrato de Ingestão (JSON)

Toda entrada vinda do OpenClaw deve seguir a estrutura de **duas camadas**:
1. **Camada Canônica**: Campos fixos para indexação e dashboard no PULSO.
2. **Camada Payload (Contexto)**: Objeto flexível para dados específicos do evento.

### Exemplo de Payload: Nova Tarefa via Lótus
```json
{
  "event_id": "evt_claw_20240509_001",
  "dedupe_key": "task_opc_copy_lotus",
  "type": "task",
  "origin_label": "openclaw",
  "origin_agent_ref": "agent_lotus",
  "title": "Preparar copy do OPC",
  "summary": "Lótus interpretou que Fê quer iniciar o copy do projeto OPC.",
  "priority": "high",
  "confidence": "high",
  "area_ref": "area_infra",
  "project_ref": "proj_opc",
  "should_create_inbox_item": true,
  "payload": {
    "raw_input": "Fê disse no WhatsApp: 'Lótus, coloca no radar pra gente começar o copy do OPC.'",
    "suggested_action": "Criar rascunho no Notion",
    "metadata": {
      "platform": "whatsapp",
      "voice_to_text": true
    }
  }
}
```

## 3. Campos Obrigatórios
- `type`: Tipo de entrada (ver `InboxType` na ontologia).
- `origin_label`: Identificador da origem (ex: `openclaw`).
- `title`: Título curto legível por humanos.
- `rawInput`: O dado original bruto.

## 4. Idempotência & Deduplicação
- **`event_id`**: UUID único gerado pelo OpenClaw. Se o PULSO receber o mesmo ID, ele ignorará a criação da entidade.
- **`dedupe_key`**: Chave opcional para evitar duplicidade conceitual (ex: a mesma tarefa enviada duas vezes por erro de rede).

## 🚀 Endpoint de Ingestão v1

O endpoint oficial para a Lótus enviar dados ao PULSO é:

**URL**: `https://felipedutraapps.web.app/api/pulso/ingest`  
**Método**: `POST`  
**Autenticação**: `Bearer Token` obrigatório.  
**Arquitetura**: Implementado como Firebase Cloud Function com rewrite no Hosting.

### Headers Obrigatórios
- `Content-Type: application/json`
- `Authorization: Bearer <PULSO_INGEST_TOKEN>`
- `X-Pulso-Signature: sha256=<hmac>` (Preparado/Opcional para v1)

### Envelope de Payload (Canônico)
A Lótus deve enviar o payload seguindo esta estrutura:

```json
{
  "version": "v1",
  "event_id": "string (único)",
  "dedupe_key": "string (para idempotência de entidade)",
  "event_type": "alert | task | agent_update | decision",
  "occurred_at": "ISO8601 Timestamp",
  "area_ref": "string (opcional - ex: area_despertar)",
  "project_ref": "string (opcional - ex: proj_central_despertar)",
  "source": {
    "product": "openclaw",
    "agent": "string",
    "environment": "production | staging"
  },
  "actor": {
    "type": "agent",
    "id": "string",
    "name": "string"
  },
  "payload": {
    "summary": "string",
    "status": "string (opcional)",
    "severity": "low | medium | high | critical (para alertas)",
    "raw_input": "string (opcional)"
  }
}
```

### 5. Normalização de Entidades
O PULSO normaliza as referências para `areaRef` e `projectRef` internamente. Por compatibilidade, o endpoint aceita os campos tanto em snake_case quanto camelCase, e em diferentes níveis do JSON (raiz, `context` ou `payload`), priorizando a raiz do envelope.

### Códigos de Erro
- `401 Unauthorized`: Token ausente ou inválido.
- `403 Forbidden`: Falha na assinatura HMAC (se habilitada).
- `400 Bad Request`: Payload malformado ou versão incompatível.
- `422 Unprocessable Entity`: Falha na validação de campos obrigatórios.
- `200 OK` (com `status: duplicate`): Evento já processado anteriormente.

## 6. Próximos Passos
- [x] Endpoint seguro de ingestão v1.
- [ ] Implementação de Webhook para leitura do Outbox pelo OpenClaw.
- [ ] Interface de auditoria de ingestão no Health Center.

---
**Frase-Mãe da Arquitetura:**
> OpenClaw não precisa morar dentro do PULSO.
> OpenClaw precisa saber falar com o PULSO.
> E o PULSO precisa saber entender o que a Lótus quis dizer.

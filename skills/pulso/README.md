# Skill PULSO v1 — Guia de Uso e Configuração

Skill do OpenClaw para emissão de eventos estruturados ao sistema PULSO.

---

## Arquitetura

```
OpenClaw / Lótus
       │
       ▼
pulso_emit.sh  ──►  [fila local]  ──►  POST /api/pulso/ingest
                           │
                     pulso_queue_retry.sh (retry com backoff)
                           │
                    sent.ndjson / failed.ndjson
```

---

## Setup Rápido

### 1. Configurar o token (NUNCA no Git)

**Opção A — Variável de ambiente (preferida):**
```bash
export PULSO_INGEST_TOKEN="seu-token-aqui"
```
Adicione ao `~/.bashrc` ou `~/.zshrc` ou ao environment do processo OpenClaw.

**Opção B — Arquivo seguro:**
```bash
mkdir -p /root/.openclaw/secrets
echo 'PULSO_INGEST_TOKEN=seu-token-aqui' > /root/.openclaw/secrets/pulso.env
chmod 600 /root/.openclaw/secrets/pulso.env
```

Os scripts carregam automaticamente de `$PULSO_INGEST_TOKEN` ou do arquivo seguro.

### 2. Copiar a configuração de exemplo
```bash
cp skills/pulso/config.example.json skills/pulso/config.json
```
Edite `config.json` com os valores reais do seu ambiente.

### 3. Inicializar os arquivos de estado
```bash
touch skills/pulso/state/queue.ndjson
touch skills/pulso/state/sent.ndjson
touch skills/pulso/state/failed.ndjson
```

### 4. Dar permissão de execução nos scripts
```bash
chmod +x skills/pulso/scripts/*.sh
```

---

## Uso

### Emitir um agent_update:
```bash
./skills/pulso/scripts/pulso_emit.sh agent_update \
  --summary "Lótus iniciou ciclo de trabalho." \
  --topic "pulso_skill_v1"
```

### Emitir uma task:
```bash
./skills/pulso/scripts/pulso_emit.sh task \
  --title "Revisar contrato PULSO" \
  --body "Verificar se o payload v1 está correto." \
  --priority "high"
```

### Emitir um alert:
```bash
./skills/pulso/scripts/pulso_emit.sh alert \
  --severity "warning" \
  --title "Teste de alerta OpenClaw" \
  --message "Alerta criado para validar entrada no Health Center."
```

### Adicionar à fila sem enviar agora:
```bash
./skills/pulso/scripts/pulso_queue_add.sh agent_update \
  --summary "Evento para envio posterior."
```

### Reprocessar fila:
```bash
./skills/pulso/scripts/pulso_queue_retry.sh
```

### Ver status da skill:
```bash
./skills/pulso/scripts/pulso_health.sh
```

---

## Segurança

> ⚠️ O token `PULSO_INGEST_TOKEN` é a chave de acesso ao endpoint de ingestão do PULSO.
> Nunca deve aparecer em:
> - Logs de console
> - Arquivos no Git
> - Mensagens de chat
> - Ambiente de desenvolvimento não seguro

A skill carrega o token na seguinte ordem de preferência:
1. Variável de ambiente `$PULSO_INGEST_TOKEN`
2. Arquivo `/root/.openclaw/secrets/pulso.env` (permissão 600)

---

## Geração de IDs

### event_id
Formato: `evt_<timestamp_unix>_<hash4>`

```bash
EVENT_ID="evt_$(date +%s)_$(head -c 4 /dev/urandom | xxd -p)"
```

### dedupe_key
Formato semântico: `event_type:topic_ou_titulo:janela_tempo`

Exemplos:
- `agent_update:pulso-skill-v1:2026-05-10`
- `task:revisar-contrato:msg_ABC123`
- `alert:api-timeout:2026-05-10T03`

---

## Retry

A skill implementa retry automático com backoff exponencial:

| Tentativa | Delay    |
|-----------|----------|
| 1         | imediato |
| 2         | 30s      |
| 3         | 2min     |
| 4         | 10min    |
| 5         | 30min    |
| >5        | failed   |

Retry é acionado para: timeout, erro de rede, HTTP 429/500/502/503/504.
**Sem retry** para: 400, 401, 403, 404, 422 (erros estruturais).

---

## Payload v1

```json
{
  "version": "v1",
  "event_id": "evt_1746780000_a1b2",
  "dedupe_key": "agent_update:pulso-skill-v1:2026-05-10",
  "event_type": "agent_update",
  "occurred_at": "2026-05-10T03:00:00Z",
  "source": {
    "product": "openclaw",
    "workspace": "lotus",
    "agent": "main",
    "host": "srv1499601",
    "environment": "production"
  },
  "actor": {
    "type": "agent",
    "id": "lotus",
    "name": "Lótus"
  },
  "context": {
    "channel": "whatsapp",
    "session_key": "session-key-atual"
  },
  "payload": {
    "status": "working",
    "summary": "Evento de exemplo."
  }
}
```

---

## Endpoint

```
POST https://felipedutraapps.web.app/api/pulso/ingest
Authorization: Bearer $PULSO_INGEST_TOKEN
Content-Type: application/json
X-Pulso-Source: openclaw
X-Pulso-Event-Id: <event_id>
X-Pulso-Dedupe-Key: <dedupe_key>
```

---

## Versão

| Campo       | Valor                |
|-------------|----------------------|
| Skill       | pulso                |
| Versão      | 1.0.0                |
| Protocolo   | PULSO Contract v1    |
| Mantenedor  | Lótus / OpenClaw     |

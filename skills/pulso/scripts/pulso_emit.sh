#!/usr/bin/env bash
# ===========================================================================
# pulso_emit.sh — Monta e envia um evento para o PULSO
# Uso: pulso_emit.sh <event_type> [--key value ...]
#
# Exemplos:
#   pulso_emit.sh agent_update --summary "Lótus iniciou ciclo." --topic "boot"
#   pulso_emit.sh task --title "Revisar contrato" --priority "high"
#   pulso_emit.sh alert --severity "warning" --title "Timeout" --message "Detalhe"
# ===========================================================================
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$SKILL_DIR/scripts"
STATE_DIR="$SKILL_DIR/state"
QUEUE_FILE="$STATE_DIR/queue.ndjson"
SENT_FILE="$STATE_DIR/sent.ndjson"
FAILED_FILE="$STATE_DIR/failed.ndjson"

PULSO_ENDPOINT="https://felipedutraapps.web.app/api/pulso/ingest"
TIMEOUT=15

# ---------------------------------------------------------------------------
# Carregar token (nunca loga o valor)
# ---------------------------------------------------------------------------
load_token() {
  if [[ -n "${PULSO_INGEST_TOKEN:-}" ]]; then
    echo "$PULSO_INGEST_TOKEN"
    return 0
  fi
  local secret_file="/root/.openclaw/secrets/pulso.env"
  if [[ -f "$secret_file" ]]; then
    # shellcheck source=/dev/null
    source "$secret_file"
    if [[ -n "${PULSO_INGEST_TOKEN:-}" ]]; then
      echo "$PULSO_INGEST_TOKEN"
      return 0
    fi
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# Gerar event_id único
# ---------------------------------------------------------------------------
gen_event_id() {
  local ts hash4
  ts="$(date +%s)"
  hash4="$(head -c 4 /dev/urandom 2>/dev/null | xxd -p 2>/dev/null || echo "$(($RANDOM * $RANDOM))" | md5sum | cut -c1-8)"
  echo "evt_${ts}_${hash4}"
}

# ---------------------------------------------------------------------------
# Gerar dedupe_key semântica
# ---------------------------------------------------------------------------
gen_dedupe_key() {
  local event_type="$1" topic="$2"
  local date_window
  date_window="$(date -u +%Y-%m-%d)"
  echo "${event_type}:${topic}:${date_window}"
}

# ---------------------------------------------------------------------------
# Parse argumentos
# ---------------------------------------------------------------------------
EVENT_TYPE="${1:-}"
if [[ -z "$EVENT_TYPE" ]]; then
  echo "[pulso_emit] ERRO: event_type é obrigatório. Ex: agent_update | task | alert" >&2
  exit 1
fi
shift

declare -A ARGS
while [[ $# -gt 0 ]]; do
  key="${1#--}"
  value="${2:-}"
  ARGS["$key"]="$value"
  shift 2 || break
done

# ---------------------------------------------------------------------------
# Montar payload v1
# ---------------------------------------------------------------------------
EVENT_ID="${ARGS[event_id]:-$(gen_event_id)}"
OCCURRED_AT="${ARGS[occurred_at]:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
HOST_NAME="${ARGS[host]:-$(hostname 2>/dev/null || echo 'openclaw-host')}"
SESSION_KEY="${ARGS[session_key]:-}"
CHANNEL="${ARGS[channel]:-api}"

# Montar payload específico por tipo
case "$EVENT_TYPE" in
  agent_update)
    TOPIC="${ARGS[topic]:-general}"
    SUMMARY="${ARGS[summary]:-Atualização de agente via OpenClaw.}"
    STATUS="${ARGS[status]:-working}"
    DEDUPE_KEY="${ARGS[dedupe_key]:-$(gen_dedupe_key "$EVENT_TYPE" "$TOPIC")}"
    PAYLOAD_JSON=$(cat <<EOF
{
  "status": "$STATUS",
  "summary": "$SUMMARY",
  "topic": "$TOPIC"
}
EOF
)
    ;;
  task)
    TITLE="${ARGS[title]:-Tarefa criada via OpenClaw}"
    BODY="${ARGS[body]:-}"
    PRIORITY="${ARGS[priority]:-medium}"
    STATUS="${ARGS[status]:-received}"
    TOPIC="${TITLE// /-}"
    DEDUPE_KEY="${ARGS[dedupe_key]:-$(gen_dedupe_key "$EVENT_TYPE" "$TOPIC")}"
    PAYLOAD_JSON=$(cat <<EOF
{
  "kind": "request",
  "title": "$TITLE",
  "body": "$BODY",
  "status": "$STATUS",
  "priority": "$PRIORITY"
}
EOF
)
    ;;
  alert)
    TITLE="${ARGS[title]:-Alerta OpenClaw}"
    MESSAGE="${ARGS[message]:-}"
    SEVERITY="${ARGS[severity]:-medium}"
    STATUS="${ARGS[status]:-open}"
    TOPIC="${TITLE// /-}"
    DEDUPE_KEY="${ARGS[dedupe_key]:-$(gen_dedupe_key "$EVENT_TYPE" "$TOPIC")}"
    PAYLOAD_JSON=$(cat <<EOF
{
  "severity": "$SEVERITY",
  "title": "$TITLE",
  "message": "$MESSAGE",
  "status": "$STATUS"
}
EOF
)
    ;;
  *)
    TOPIC="${ARGS[topic]:-${EVENT_TYPE}}"
    SUMMARY="${ARGS[summary]:-Evento genérico via OpenClaw.}"
    DEDUPE_KEY="${ARGS[dedupe_key]:-$(gen_dedupe_key "$EVENT_TYPE" "$TOPIC")}"
    PAYLOAD_JSON=$(cat <<EOF
{
  "summary": "$SUMMARY"
}
EOF
)
    ;;
esac

FULL_PAYLOAD=$(cat <<EOF
{
  "version": "v1",
  "event_id": "$EVENT_ID",
  "dedupe_key": "$DEDUPE_KEY",
  "event_type": "$EVENT_TYPE",
  "occurred_at": "$OCCURRED_AT",
  "source": {
    "product": "openclaw",
    "workspace": "lotus",
    "agent": "main",
    "host": "$HOST_NAME",
    "environment": "production"
  },
  "actor": {
    "type": "agent",
    "id": "lotus",
    "name": "Lótus"
  },
  "context": {
    "channel": "$CHANNEL",
    "session_key": "$SESSION_KEY"
  },
  "payload": $PAYLOAD_JSON
}
EOF
)

# ---------------------------------------------------------------------------
# Carregar token
# ---------------------------------------------------------------------------
TOKEN="$(load_token)"
if [[ -z "$TOKEN" ]]; then
  echo "[pulso_emit] ERRO: PULSO_INGEST_TOKEN não encontrado. Configure a variável de ambiente ou o arquivo seguro." >&2
  # Adicionar à fila para retry posterior
  "$SCRIPTS_DIR/pulso_queue_add.sh" "$EVENT_TYPE" --event_id "$EVENT_ID" --dedupe_key "$DEDUPE_KEY" --body "$FULL_PAYLOAD" --reason "token_missing"
  exit 1
fi

# ---------------------------------------------------------------------------
# Enviar para o PULSO
# ---------------------------------------------------------------------------
echo "[pulso_emit] Enviando event_id=$EVENT_ID type=$EVENT_TYPE..."

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" \
  --max-time "$TIMEOUT" \
  -X POST "$PULSO_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "User-Agent: openclaw-pulso-skill/1.0" \
  -H "X-Pulso-Source: openclaw" \
  -H "X-Pulso-Event-Id: $EVENT_ID" \
  -H "X-Pulso-Dedupe-Key: $DEDUPE_KEY" \
  -d "$FULL_PAYLOAD" 2>&1) || {
    echo "[pulso_emit] ERRO: Falha de rede ou timeout. Adicionando à fila de retry."
    "$SCRIPTS_DIR/pulso_queue_add.sh" "$EVENT_TYPE" \
      --event_id "$EVENT_ID" --dedupe_key "$DEDUPE_KEY" \
      --body "$FULL_PAYLOAD" --reason "network_error"
    exit 1
  }

HTTP_BODY="$(echo "$HTTP_RESPONSE" | head -n -1)"
HTTP_CODE="$(echo "$HTTP_RESPONSE" | tail -n 1)"

# ---------------------------------------------------------------------------
# Registrar resultado
# ---------------------------------------------------------------------------
"$SCRIPTS_DIR/pulso_mark_result.sh" \
  --event_id "$EVENT_ID" \
  --dedupe_key "$DEDUPE_KEY" \
  --event_type "$EVENT_TYPE" \
  --http_code "$HTTP_CODE" \
  --body "$FULL_PAYLOAD" \
  --response "$HTTP_BODY"

# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------
if [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]]; then
  echo "[pulso_emit] ✓ Sucesso ($HTTP_CODE): $HTTP_BODY"
elif [[ "$HTTP_CODE" == "200" && "$HTTP_BODY" == *"duplicate"* ]]; then
  echo "[pulso_emit] ~ Duplicata detectada (já enviado): $HTTP_BODY"
else
  echo "[pulso_emit] ✗ Falha ($HTTP_CODE): $HTTP_BODY"
  # Verificar se deve fazer retry
  case "$HTTP_CODE" in
    429|500|502|503|504)
      echo "[pulso_emit] Código $HTTP_CODE é retriável. Adicionando à fila."
      "$SCRIPTS_DIR/pulso_queue_add.sh" "$EVENT_TYPE" \
        --event_id "$EVENT_ID" --dedupe_key "$DEDUPE_KEY" \
        --body "$FULL_PAYLOAD" --reason "http_$HTTP_CODE"
      ;;
    401|403|400|404|422)
      echo "[pulso_emit] Código $HTTP_CODE não é retriável. Verificar configuração."
      ;;
  esac
  exit 1
fi

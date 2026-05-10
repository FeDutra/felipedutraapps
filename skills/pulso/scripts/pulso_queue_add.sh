#!/usr/bin/env bash
# ===========================================================================
# pulso_queue_add.sh — Adiciona evento à fila local para envio posterior
# Uso: pulso_queue_add.sh <event_type> [--event_id X] [--dedupe_key Y] [--body '{}'] [--reason Z]
# ===========================================================================
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$SKILL_DIR/state"
QUEUE_FILE="$STATE_DIR/queue.ndjson"

# Garantir que o arquivo existe
mkdir -p "$STATE_DIR"
touch "$QUEUE_FILE"

# ---------------------------------------------------------------------------
# Parse argumentos
# ---------------------------------------------------------------------------
EVENT_TYPE="${1:-unknown}"
shift || true

declare -A ARGS
while [[ $# -gt 0 ]]; do
  key="${1#--}"
  value="${2:-}"
  ARGS["$key"]="$value"
  shift 2 || break
done

EVENT_ID="${ARGS[event_id]:-evt_$(date +%s)_$(head -c 2 /dev/urandom | xxd -p 2>/dev/null || echo $RANDOM)}"
DEDUPE_KEY="${ARGS[dedupe_key]:-${EVENT_TYPE}:queued:$(date -u +%Y-%m-%d)}"
BODY="${ARGS[body]:-{}}"
REASON="${ARGS[reason]:-manual}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ---------------------------------------------------------------------------
# Verificar duplicata na fila (pelo event_id)
# ---------------------------------------------------------------------------
if grep -q "\"event_id\":\"$EVENT_ID\"" "$QUEUE_FILE" 2>/dev/null; then
  echo "[pulso_queue_add] Evento $EVENT_ID já está na fila. Ignorando."
  exit 0
fi

# ---------------------------------------------------------------------------
# Calcular próximo retry (imediato = attempt 1)
# ---------------------------------------------------------------------------
NEXT_RETRY="$NOW"

# ---------------------------------------------------------------------------
# Gravar entrada na fila
# ---------------------------------------------------------------------------
ENTRY=$(cat <<EOF
{"event_id":"$EVENT_ID","dedupe_key":"$DEDUPE_KEY","event_type":"$EVENT_TYPE","status":"pending","attempt":0,"created_at":"$NOW","last_attempt_at":null,"next_retry_at":"$NEXT_RETRY","last_http_status":null,"last_error":"$REASON","body":$(echo "$BODY" | tr -d '\n')}
EOF
)

echo "$ENTRY" >> "$QUEUE_FILE"
echo "[pulso_queue_add] ✓ Evento adicionado à fila: event_id=$EVENT_ID type=$EVENT_TYPE reason=$REASON"

#!/usr/bin/env bash
# ===========================================================================
# pulso_health.sh — Exibe resumo de status da skill PULSO
# Uso: pulso_health.sh [--test-endpoint]
# ===========================================================================
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$SKILL_DIR/state"
QUEUE_FILE="$STATE_DIR/queue.ndjson"
SENT_FILE="$STATE_DIR/sent.ndjson"
FAILED_FILE="$STATE_DIR/failed.ndjson"
PULSO_ENDPOINT="https://felipedutraapps.web.app/api/pulso/ingest"

# ---------------------------------------------------------------------------
# Carregar token
# ---------------------------------------------------------------------------
load_token() {
  if [[ -n "${PULSO_INGEST_TOKEN:-}" ]]; then echo "present"; return 0; fi
  local f="/root/.openclaw/secrets/pulso.env"
  if [[ -f "$f" ]]; then
    # shellcheck source=/dev/null
    source "$f"
    if [[ -n "${PULSO_INGEST_TOKEN:-}" ]]; then echo "present"; return 0; fi
  fi
  echo "MISSING"
}

count_lines() {
  local file="$1"
  if [[ -f "$file" && -s "$file" ]]; then
    grep -c . "$file" 2>/dev/null || echo 0
  else
    echo 0
  fi
}

TOKEN_STATUS="$(load_token)"
QUEUE_COUNT="$(count_lines "$QUEUE_FILE")"
SENT_COUNT="$(count_lines "$SENT_FILE")"
FAILED_COUNT="$(count_lines "$FAILED_FILE")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       PULSO Skill v1 — Health Check      ║"
echo "╠══════════════════════════════════════════╣"
echo "║ Token       : $TOKEN_STATUS"
echo "║ Fila        : $QUEUE_COUNT eventos pendentes"
echo "║ Enviados    : $SENT_COUNT eventos com sucesso"
echo "║ Falhas      : $FAILED_COUNT eventos falhos"
echo "╠══════════════════════════════════════════╣"

# Mostrar últimos itens da fila se houver
if [[ "$QUEUE_COUNT" -gt 0 ]]; then
  echo "║ Próximos na fila:"
  tail -3 "$QUEUE_FILE" | while IFS= read -r line; do
    EID="$(echo "$line" | sed 's/.*"event_id":"\([^"]*\)".*/\1/')"
    ETYPE="$(echo "$line" | sed 's/.*"event_type":"\([^"]*\)".*/\1/')"
    NRET="$(echo "$line" | sed 's/.*"next_retry_at":"\([^"]*\)".*/\1/')"
    echo "║   - $ETYPE ($EID) → retry: $NRET"
  done
fi

if [[ "$FAILED_COUNT" -gt 0 ]]; then
  echo "║ ⚠ Últimas falhas:"
  tail -3 "$FAILED_FILE" | while IFS= read -r line; do
    EID="$(echo "$line" | sed 's/.*"event_id":"\([^"]*\)".*/\1/')"
    CODE="$(echo "$line" | sed 's/.*"http_code":"\([^"]*\)".*/\1/')"
    echo "║   ✗ $EID (http: $CODE)"
  done
fi

echo "╠══════════════════════════════════════════╣"

# Teste de conectividade sem token (deve retornar 401)
if [[ "${1:-}" == "--test-endpoint" ]]; then
  echo "║ Testando conectividade com endpoint..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$PULSO_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d '{"version":"v1"}' 2>/dev/null || echo "ERR")
  
  if [[ "$HTTP_CODE" == "401" ]]; then
    echo "║ Endpoint    : ✓ Online (401 sem token — correto)"
  elif [[ "$HTTP_CODE" == "ERR" ]]; then
    echo "║ Endpoint    : ✗ Offline ou timeout"
  else
    echo "║ Endpoint    : ~ HTTP $HTTP_CODE (inesperado)"
  fi
  echo "╠══════════════════════════════════════════╣"
fi

echo "║ Endpoint    : $PULSO_ENDPOINT"
echo "╚══════════════════════════════════════════╝"
echo ""

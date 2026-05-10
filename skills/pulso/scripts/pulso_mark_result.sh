#!/usr/bin/env bash
# ===========================================================================
# pulso_mark_result.sh — Registra o resultado de um envio ao PULSO
# Uso: pulso_mark_result.sh --event_id X --http_code Y --event_type Z [--dedupe_key W] [--body '{}'] [--response '{}']
# ===========================================================================
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$SKILL_DIR/state"
SENT_FILE="$STATE_DIR/sent.ndjson"
FAILED_FILE="$STATE_DIR/failed.ndjson"

mkdir -p "$STATE_DIR"
touch "$SENT_FILE" "$FAILED_FILE"

# ---------------------------------------------------------------------------
# Parse argumentos
# ---------------------------------------------------------------------------
declare -A ARGS
while [[ $# -gt 0 ]]; do
  key="${1#--}"
  value="${2:-}"
  ARGS["$key"]="$value"
  shift 2 || break
done

EVENT_ID="${ARGS[event_id]:-unknown}"
DEDUPE_KEY="${ARGS[dedupe_key]:-}"
EVENT_TYPE="${ARGS[event_type]:-unknown}"
HTTP_CODE="${ARGS[http_code]:-0}"
BODY="${ARGS[body]:-{}}"
RESPONSE="${ARGS[response]:-}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ---------------------------------------------------------------------------
# Classificar resultado
# ---------------------------------------------------------------------------
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" || "$HTTP_CODE" == "202" ]]; then
  STATUS="sent"
  TARGET_FILE="$SENT_FILE"
else
  STATUS="failed"
  TARGET_FILE="$FAILED_FILE"
fi

# Sanitizar body para JSON single-line (remove newlines)
BODY_CLEAN="$(echo "$BODY" | tr -d '\n' | tr -s ' ')"
RESPONSE_CLEAN="$(echo "$RESPONSE" | tr -d '\n' | sed 's/"/\\"/g' | head -c 500)"

ENTRY="{\"event_id\":\"$EVENT_ID\",\"dedupe_key\":\"$DEDUPE_KEY\",\"event_type\":\"$EVENT_TYPE\",\"status\":\"$STATUS\",\"http_code\":\"$HTTP_CODE\",\"recorded_at\":\"$NOW\",\"response\":\"$RESPONSE_CLEAN\"}"

echo "$ENTRY" >> "$TARGET_FILE"
echo "[pulso_mark_result] Registrado: event_id=$EVENT_ID status=$STATUS http=$HTTP_CODE"

#!/usr/bin/env bash
# ===========================================================================
# pulso_queue_retry.sh — Processa a fila local e retenta eventos pendentes
# Uso: pulso_queue_retry.sh
#
# Processa todos os eventos em queue.ndjson cujo next_retry_at já passou,
# tentando reenviar para o PULSO com backoff progressivo.
# ===========================================================================
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$SKILL_DIR/state"
SCRIPTS_DIR="$SKILL_DIR/scripts"
QUEUE_FILE="$STATE_DIR/queue.ndjson"
SENT_FILE="$STATE_DIR/sent.ndjson"
FAILED_FILE="$STATE_DIR/failed.ndjson"
PULSO_ENDPOINT="https://felipedutraapps.web.app/api/pulso/ingest"
TIMEOUT=15

# Backoff por tentativa (segundos): 0, 30, 120, 600, 1800
BACKOFF=(0 30 120 600 1800)
MAX_ATTEMPTS=5

# ---------------------------------------------------------------------------
# Carregar token
# ---------------------------------------------------------------------------
load_token() {
  if [[ -n "${PULSO_INGEST_TOKEN:-}" ]]; then echo "$PULSO_INGEST_TOKEN"; return 0; fi
  local f="/root/.openclaw/secrets/pulso.env"
  if [[ -f "$f" ]]; then source "$f"; fi
  echo "${PULSO_INGEST_TOKEN:-}"
}

TOKEN="$(load_token)"
if [[ -z "$TOKEN" ]]; then
  echo "[pulso_queue_retry] ERRO: PULSO_INGEST_TOKEN não encontrado. Abortando."
  exit 1
fi

# ---------------------------------------------------------------------------
# Verificar se fila existe
# ---------------------------------------------------------------------------
if [[ ! -f "$QUEUE_FILE" ]] || [[ ! -s "$QUEUE_FILE" ]]; then
  echo "[pulso_queue_retry] Fila vazia. Nada a processar."
  exit 0
fi

NOW_EPOCH="$(date +%s)"
NEW_QUEUE=()
PROCESSED=0
SUCCEEDED=0
FAILED_NOW=0

# ---------------------------------------------------------------------------
# Processar cada linha da fila
# ---------------------------------------------------------------------------
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue

  # Extrair campos com sed (compatível sem jq)
  EVENT_ID="$(echo "$line" | sed 's/.*"event_id":"\([^"]*\)".*/\1/')"
  DEDUPE_KEY="$(echo "$line" | sed 's/.*"dedupe_key":"\([^"]*\)".*/\1/')"
  EVENT_TYPE="$(echo "$line" | sed 's/.*"event_type":"\([^"]*\)".*/\1/')"
  STATUS="$(echo "$line" | sed 's/.*"status":"\([^"]*\)".*/\1/')"
  ATTEMPT="$(echo "$line" | sed 's/.*"attempt":\([0-9]*\).*/\1/')"
  NEXT_RETRY="$(echo "$line" | sed 's/.*"next_retry_at":"\([^"]*\)".*/\1/')"
  BODY="$(echo "$line" | sed 's/.*"body":\(.*\)}/\1/')"

  # Pular se não for pendente
  if [[ "$STATUS" == "sent" || "$STATUS" == "failed" ]]; then
    NEW_QUEUE+=("$line")
    continue
  fi

  # Verificar se chegou a hora do retry
  if [[ "$NEXT_RETRY" != "null" ]]; then
    NEXT_EPOCH="$(date -d "$NEXT_RETRY" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$NEXT_RETRY" +%s 2>/dev/null || echo 0)"
    if [[ "$NEXT_EPOCH" -gt "$NOW_EPOCH" ]]; then
      NEW_QUEUE+=("$line")
      continue
    fi
  fi

  PROCESSED=$((PROCESSED + 1))
  NEW_ATTEMPT=$((ATTEMPT + 1))
  NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  echo "[pulso_queue_retry] Tentando event_id=$EVENT_ID (tentativa $NEW_ATTEMPT/$MAX_ATTEMPTS)..."

  # Enviar
  HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" \
    --max-time "$TIMEOUT" \
    -X POST "$PULSO_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "User-Agent: openclaw-pulso-skill/1.0" \
    -H "X-Pulso-Source: openclaw" \
    -H "X-Pulso-Event-Id: $EVENT_ID" \
    -H "X-Pulso-Dedupe-Key: $DEDUPE_KEY" \
    -d "$BODY" 2>&1) || {
      HTTP_CODE="network_error"
      HTTP_BODY="Falha de rede"
    }

  HTTP_BODY="$(echo "$HTTP_RESPONSE" | head -n -1)"
  HTTP_CODE="$(echo "$HTTP_RESPONSE" | tail -n 1)"

  # Avaliar resultado
  if [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]]; then
    # Sucesso
    SENT_ENTRY="{\"event_id\":\"$EVENT_ID\",\"dedupe_key\":\"$DEDUPE_KEY\",\"event_type\":\"$EVENT_TYPE\",\"status\":\"sent\",\"attempt\":$NEW_ATTEMPT,\"sent_at\":\"$NOW_ISO\",\"http_status\":$HTTP_CODE,\"response\":\"ok\"}"
    echo "$SENT_ENTRY" >> "$SENT_FILE"
    echo "[pulso_queue_retry] ✓ Enviado com sucesso: $EVENT_ID ($HTTP_CODE)"
    SUCCEEDED=$((SUCCEEDED + 1))
    # NÃO adiciona de volta à fila
  elif [[ "$NEW_ATTEMPT" -ge "$MAX_ATTEMPTS" ]]; then
    # Esgotou tentativas
    FAILED_ENTRY="{\"event_id\":\"$EVENT_ID\",\"dedupe_key\":\"$DEDUPE_KEY\",\"event_type\":\"$EVENT_TYPE\",\"status\":\"failed\",\"attempt\":$NEW_ATTEMPT,\"failed_at\":\"$NOW_ISO\",\"last_http_status\":\"$HTTP_CODE\",\"last_error\":\"max_attempts_reached\"}"
    echo "$FAILED_ENTRY" >> "$FAILED_FILE"
    echo "[pulso_queue_retry] ✗ Evento $EVENT_ID marcado como failed (tentativas esgotadas)."
    FAILED_NOW=$((FAILED_NOW + 1))
    # NÃO adiciona de volta à fila
  else
    # Calcular próximo retry
    BACKOFF_IDX=$((NEW_ATTEMPT < ${#BACKOFF[@]} ? NEW_ATTEMPT : ${#BACKOFF[@]} - 1))
    DELAY="${BACKOFF[$BACKOFF_IDX]}"
    NEXT_RETRY_EPOCH=$((NOW_EPOCH + DELAY))
    NEXT_RETRY_ISO="$(date -u -d "@$NEXT_RETRY_EPOCH" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$NEXT_RETRY_EPOCH" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$NOW_ISO")"
    
    UPDATED_LINE="{\"event_id\":\"$EVENT_ID\",\"dedupe_key\":\"$DEDUPE_KEY\",\"event_type\":\"$EVENT_TYPE\",\"status\":\"retry_scheduled\",\"attempt\":$NEW_ATTEMPT,\"created_at\":\"$NOW_ISO\",\"last_attempt_at\":\"$NOW_ISO\",\"next_retry_at\":\"$NEXT_RETRY_ISO\",\"last_http_status\":\"$HTTP_CODE\",\"last_error\":\"http_$HTTP_CODE\",\"body\":$BODY}"
    NEW_QUEUE+=("$UPDATED_LINE")
    echo "[pulso_queue_retry] ~ Retry agendado para $NEXT_RETRY_ISO (delay: ${DELAY}s)"
  fi

done < "$QUEUE_FILE"

# ---------------------------------------------------------------------------
# Reescrever fila com itens restantes
# ---------------------------------------------------------------------------
printf '%s\n' "${NEW_QUEUE[@]}" > "$QUEUE_FILE"

echo ""
echo "[pulso_queue_retry] === Resumo ==="
echo "  Processados : $PROCESSED"
echo "  Enviados    : $SUCCEEDED"
echo "  Falhados    : $FAILED_NOW"
echo "  Na fila     : ${#NEW_QUEUE[@]}"

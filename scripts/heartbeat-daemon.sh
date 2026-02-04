#!/bin/bash
# heartbeat-daemon.sh - Background process that sends periodic heartbeats to keep session alive

set -e

CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SESSION_FILE="${CONFIG_DIR}/session.json"
PID_FILE="${CONFIG_DIR}/heartbeat.pid"
LOG_FILE="${CONFIG_DIR}/heartbeat.log"
AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"
HEARTBEAT_INTERVAL="${CLAUDE_SMS_HEARTBEAT_INTERVAL:-30}"  # seconds

# Log with timestamp
log() {
  echo "[$(date -u +"%Y-%m-%d %H:%M:%S")] $*" >> "$LOG_FILE"
}

# Cleanup on exit
cleanup() {
  log "Heartbeat daemon stopping"
  rm -f "$PID_FILE"
  exit 0
}

trap cleanup EXIT TERM INT

# Check if session file exists
if [ ! -f "$SESSION_FILE" ]; then
  log "ERROR: No session file found at $SESSION_FILE"
  exit 1
fi

# Extract session data
MONITORING_ID=$(jq -r '.monitoring_id // empty' "$SESSION_FILE" 2>/dev/null)
SESSION_TOKEN=$(jq -r '.session_token // empty' "$SESSION_FILE" 2>/dev/null)

if [ -z "$MONITORING_ID" ] || [ -z "$SESSION_TOKEN" ]; then
  log "ERROR: Invalid session data"
  exit 1
fi

# Store PID
echo $$ > "$PID_FILE"
log "Heartbeat daemon started (PID: $$) for session $MONITORING_ID"
log "Interval: ${HEARTBEAT_INTERVAL}s"

# Send initial heartbeat
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/sessions/${MONITORING_ID}/heartbeat" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\":\"${TIMESTAMP}\"}" \
  --max-time 10 2>&1 || echo "000")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  log "Initial heartbeat sent successfully"
else
  log "WARNING: Initial heartbeat failed (HTTP $HTTP_CODE)"
fi

# Main heartbeat loop
while true; do
  # Check if session file still exists (stops if sms-stop was called)
  if [ ! -f "$SESSION_FILE" ]; then
    log "Session file removed, exiting"
    exit 0
  fi

  # Sleep for interval
  sleep "$HEARTBEAT_INTERVAL"

  # Send heartbeat
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/sessions/${MONITORING_ID}/heartbeat" \
    -H "Authorization: Bearer ${SESSION_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\":\"${TIMESTAMP}\"}" \
    --max-time 10 2>&1 || echo "000")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    log "Heartbeat sent (${MONITORING_ID:0:8}...)"
  elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    log "ERROR: Authentication failed, session may be expired"
    exit 1
  elif [ "$HTTP_CODE" = "404" ]; then
    log "ERROR: Session not found on server, stopping"
    exit 1
  else
    log "WARNING: Heartbeat failed (HTTP $HTTP_CODE), will retry"
  fi
done

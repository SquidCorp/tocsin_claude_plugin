#!/bin/bash
# Handle session end - send completion notification via server

# Claude Code provides session end reason
REASON="${CLAUDE_HOOK_REASON:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get session file (rest unchanged)
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SESSION_FILE="${CONFIG_DIR}/session.json"
PID_FILE="${CONFIG_DIR}/heartbeat.pid"
AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"

# Stop heartbeat daemon if running
if [ -f "$PID_FILE" ]; then
  HEARTBEAT_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$HEARTBEAT_PID" ] && kill -0 "$HEARTBEAT_PID" 2>/dev/null; then
    kill "$HEARTBEAT_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

if [ ! -f "$SESSION_FILE" ]; then
  exit 0
fi

# Extract session data
MONITORING_ID=$(jq -r '.monitoring_id // empty' "$SESSION_FILE" 2>/dev/null)
SESSION_TOKEN=$(jq -r '.session_token // empty' "$SESSION_FILE" 2>/dev/null)
DESCRIPTION=$(jq -r '.description // empty' "$SESSION_FILE" 2>/dev/null)

if [ -z "$MONITORING_ID" ] || [ -z "$SESSION_TOKEN" ]; then
  # Clean up orphaned session file
  rm -f "$SESSION_FILE"
  exit 0
fi

# Determine final state based on reason
case "$REASON" in
  clear|logout)
    FINAL_STATE="success"
    ;;
  error)
    FINAL_STATE="error"
    ;;
  *)
    FINAL_STATE="success"
    ;;
esac

# Send session stop to server
curl -s -X POST "${AUTH_URL}/sessions/${MONITORING_ID}/stop" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"reason\": \"${REASON}\",
    \"final_state\": \"${FINAL_STATE}\",
    \"ended_at\": \"${TIMESTAMP}\"
  }" > /dev/null 2>&1

# Clean up session file and logs
rm -f "$SESSION_FILE"
rm -f "${CONFIG_DIR}/heartbeat.log"

exit 0

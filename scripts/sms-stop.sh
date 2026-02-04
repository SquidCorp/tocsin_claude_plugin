#!/bin/bash
# sms-stop.sh - Stop monitoring session with server sync

set -e

AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TOKEN_FILE="${CONFIG_DIR}/auth.json"
SESSION_FILE="${CONFIG_DIR}/session.json"
PID_FILE="${CONFIG_DIR}/heartbeat.pid"

echo "🦞 Stopping SMS monitoring..."

# Stop heartbeat daemon if running
if [ -f "$PID_FILE" ]; then
  HEARTBEAT_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$HEARTBEAT_PID" ] && kill -0 "$HEARTBEAT_PID" 2>/dev/null; then
    echo "🔄 Stopping heartbeat daemon (PID: ${HEARTBEAT_PID})..."
    kill "$HEARTBEAT_PID" 2>/dev/null || true
    sleep 0.5
    # Force kill if still running
    if kill -0 "$HEARTBEAT_PID" 2>/dev/null; then
      kill -9 "$HEARTBEAT_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

# Check if session file exists
if [ ! -f "$SESSION_FILE" ]; then
  echo "ℹ️  No active monitoring session."
  exit 0
fi

# Extract session data
MONITORING_ID=$(jq -r '.monitoring_id // empty' "$SESSION_FILE" 2>/dev/null)
SESSION_TOKEN=$(jq -r '.session_token // empty' "$SESSION_FILE" 2>/dev/null)
DESCRIPTION=$(jq -r '.description // empty' "$SESSION_FILE" 2>/dev/null)

if [ -z "$MONITORING_ID" ]; then
  echo "ℹ️  Invalid session data. Cleaning up..."
  rm -f "$SESSION_FILE"
  exit 0
fi

# Get current timestamp
ENDED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "📡 Notifying server..."

# Call server to stop session
RESPONSE=$(curl -s -X POST "${AUTH_URL}/sessions/${MONITORING_ID}/stop" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"reason\": \"user_stop\",
    \"final_state\": \"success\",
    \"ended_at\": \"${ENDED_AT}\"
  }" \
  --max-time 10 2>/dev/null) || {
  echo "⚠️  Could not reach server, but cleaning up locally..."
}

# Remove session file and logs
rm -f "$SESSION_FILE"
rm -f "${CONFIG_DIR}/heartbeat.log"

echo "✅ Monitoring stopped."
if [ -n "$DESCRIPTION" ]; then
  echo "   Session: ${DESCRIPTION}"
fi
echo ""
echo "Note: Auth token preserved. Run /sms-logout to clear authentication."

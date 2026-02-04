#!/bin/bash
# sms-stop.sh - Stop monitoring session with server sync

set -e

AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TOKEN_FILE="${CONFIG_DIR}/auth.json"
SESSION_FILE="${CONFIG_DIR}/session.json"

echo "🦞 Stopping SMS monitoring..."

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

# Remove session file
rm -f "$SESSION_FILE"

echo "✅ Monitoring stopped."
if [ -n "$DESCRIPTION" ]; then
  echo "   Session: ${DESCRIPTION}"
fi
echo ""
echo "Note: Auth token preserved. Run /sms-logout to clear authentication."

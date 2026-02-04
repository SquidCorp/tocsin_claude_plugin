#!/bin/bash
# Handle user activity (prompt submission) - resets idle timer via server


# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get session file (rest unchanged)
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SESSION_FILE="${CONFIG_DIR}/session.json"
SESSION_ID="${CLAUDE_SESSION_ID:-}"
AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"

if [ ! -f "$SESSION_FILE" ]; then
  exit 0
fi

# Extract session data
MONITORING_ID=$(jq -r '.monitoring_id // empty' "$SESSION_FILE" 2>/dev/null)
SESSION_TOKEN=$(jq -r '.session_token // empty' "$SESSION_FILE" 2>/dev/null)

if [ -z "$MONITORING_ID" ] || [ -z "$SESSION_TOKEN" ]; then
  exit 0
fi

# Send heartbeat to server (async, don't block)
(
  curl -s -X POST "${AUTH_URL}/sessions/${MONITORING_ID}/heartbeat" \
    -H "Authorization: Bearer ${SESSION_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"timestamp\": \"${TIMESTAMP}\",
      \"last_activity\": \"${LAST_ACTIVITY}\"
    }" > /dev/null 2>&1
) &

exit 0

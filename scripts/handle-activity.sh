#!/bin/bash
# Handle user activity (prompt submission) - resets idle timer via server

# Read JSON input from stdin
INPUT=$(cat)

# Extract session ID
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LAST_ACTIVITY=$(echo "$INPUT" | jq -r '.timestamp // empty')

# Get session file
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SESSION_FILE="${CONFIG_DIR}/session.json"
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

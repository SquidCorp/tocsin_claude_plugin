#!/bin/bash
# Handle session end - send completion notification

# Read JSON input from stdin
INPUT=$(cat)

# Extract session info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
REASON=$(echo "$INPUT" | jq -r '.reason // empty')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Get auth token
AUTH_FILE="${HOME}/.config/claude-sms-notifier/auth.json"
if [ ! -f "$AUTH_FILE" ]; then
  exit 0
fi

AUTH_TOKEN=$(jq -r '.access_token // empty' "$AUTH_FILE")
if [ -z "$AUTH_TOKEN" ]; then
  exit 0
fi

# Get session file
SESSION_FILE="/tmp/claude-sms-sessions/${SESSION_ID}.json"
if [ ! -f "$SESSION_FILE" ]; then
  exit 0
fi

# Check if session is active
IS_ACTIVE=$(jq -r '.is_active // false' "$SESSION_FILE")
if [ "$IS_ACTIVE" != "true" ]; then
  exit 0
fi

# Send session end notification
SERVER_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"

# Get session description
DESCRIPTION=$(jq -r '.description // "Claude session"' "$SESSION_FILE")

# Determine status based on reason
if [ "$REASON" = "clear" ] || [ "$REASON" = "logout" ]; then
  STATUS="done"
else
  STATUS="done"
fi

curl -s -X POST "${SERVER_URL}/sessions/${SESSION_ID}/stop" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"${STATUS}\",
    \"reason\": \"${REASON}\"
  }" > /dev/null 2>&1

# Mark session as inactive
jq '.is_active = false' "$SESSION_FILE" > "${SESSION_FILE}.tmp" && mv "${SESSION_FILE}.tmp" "$SESSION_FILE"

exit 0

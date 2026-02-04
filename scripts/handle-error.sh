#!/bin/bash
# Handle tool errors and send SMS notification

# Read JSON input from stdin
INPUT=$(cat)

# Extract session ID if available
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
ERROR=$(echo "$INPUT" | jq -r '.error // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Get auth token from config
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

# Check if this is a blocking error (not file not found, etc.)
BLOCKING_PATTERNS="permission denied|rate limit|fatal|crash|connection refused|unauthorized"
if echo "$ERROR" | grep -qiE "$BLOCKING_PATTERNS"; then
  # Send error notification
  SERVER_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"
  
  curl -s -X POST "${SERVER_URL}/sessions/${SESSION_ID}/events" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"error\",
      \"tool_name\": \"${TOOL_NAME}\",
      \"error\": \"${ERROR}\",
      \"cwd\": \"${CWD}\"
    }" > /dev/null 2>&1
fi

exit 0

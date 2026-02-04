#!/bin/bash
# Handle tool errors and send SMS notification via server
set -e

# Read JSON input from stdin
INPUT=$(cat)

# Extract session ID if available
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
ERROR=$(echo "$INPUT" | jq -r '.error // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Get session file
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SESSION_FILE="${CONFIG_DIR}/session.json"
AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"

if [ ! -f "$SESSION_FILE" ]; then
  # No active session, nothing to do
  exit 0
fi

# Extract session data
MONITORING_ID=$(jq -r '.monitoring_id // empty' "$SESSION_FILE" 2>/dev/null)
SESSION_TOKEN=$(jq -r '.session_token // empty' "$SESSION_FILE" 2>/dev/null)

if [ -z "$MONITORING_ID" ] || [ -z "$SESSION_TOKEN" ]; then
  exit 0
fi

# Check if this is a blocking error (not file not found, etc.)
BLOCKING_PATTERNS="permission denied|rate limit|fatal|crash|connection refused|unauthorized|authentication failed"
if echo "$ERROR" | grep -qiE "$BLOCKING_PATTERNS"; then
  # Get timestamp
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # Send error event to server
  curl -s -X POST "${AUTH_URL}/sessions/${MONITORING_ID}/events" \
    -H "Authorization: Bearer ${SESSION_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"event_type\": \"error\",
      \"timestamp\": \"${TIMESTAMP}\",
      \"details\": {
        \"tool_name\": \"${TOOL_NAME}\",
        \"error\": \"${ERROR}\",
        \"cwd\": \"${CWD}\"
      }
    }" > /dev/null 2>&1
fi

exit 0

#!/bin/bash
# sms-start.sh - Start monitoring session with server sync

set -e

AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TOKEN_FILE="${CONFIG_DIR}/auth.json"
SESSION_FILE="${CONFIG_DIR}/session.json"
DESCRIPTION="$*"

if [ -z "$DESCRIPTION" ]; then
  echo "❌ Error: Description required"
  echo "Usage: /sms-start \"What you're working on\""
  exit 1
fi

# Check authentication
if [ ! -f "$TOKEN_FILE" ]; then
  echo "❌ Not authenticated!"
  echo "Run /sms-setup first, then /sms-pair"
  exit 1
fi

# Extract auth token
AUTH_TOKEN=$(jq -r '.access_token // empty' "$TOKEN_FILE" 2>/dev/null)
if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Invalid authentication token!"
  echo "Run /sms-setup to re-authenticate."
  exit 1
fi

# Get session from claude env 
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID:-}"

# Get hostname
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")

# Get current timestamp in ISO format
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Truncate description if too long (max 100 chars)
if [ ${#DESCRIPTION} -gt 100 ]; then
  DESCRIPTION="${DESCRIPTION:0:97}..."
  echo "⚠️  Description truncated to 100 characters"
fi

echo "🦞 Starting SMS monitoring..."
echo "Description: $DESCRIPTION"
echo ""
echo "📡 Syncing with SMS server..."

# Call server API to register session
RESPONSE=$(curl -s -X POST "${AUTH_URL}/sessions/start" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"claude_session_id\": \"${CLAUDE_SESSION_ID}\",
    \"description\": \"${DESCRIPTION}\",
    \"hostname\": \"${HOSTNAME}\",
    \"started_at\": \"${STARTED_AT}\"
  }" \
  --max-time 10 2>/dev/null) || {
  echo ""
  echo "❌ Could not reach SMS server!"
  echo "Check your internet connection or try again later."
  exit 1
}

# Check if response contains monitoring_id
if echo "$RESPONSE" | grep -q '"monitoring_id"'; then
  # Extract values from response
  MONITORING_ID=$(echo "$RESPONSE" | grep -o '"monitoring_id":"[^"]*"' | cut -d'"' -f4)
  SESSION_TOKEN=$(echo "$RESPONSE" | grep -o '"session_token":"[^"]*"' | cut -d'"' -f4)
  
  # Save session data to file
  cat > "$SESSION_FILE" << EOF
{
  "monitoring_id": "${MONITORING_ID}",
  "session_token": "${SESSION_TOKEN}",
  "claude_session_id": "${CLAUDE_SESSION_ID}",
  "description": "${DESCRIPTION}",
  "hostname": "${HOSTNAME}",
  "started_at": "${STARTED_AT}"
}
EOF
  chmod 600 "$SESSION_FILE"
  
  echo "✅ Session registered: ${MONITORING_ID}"
  echo ""
  echo "🔄 Starting heartbeat daemon..."

  # Start heartbeat daemon in background
  nohup "${BASH_SOURCE%/*}/heartbeat-daemon.sh" > /dev/null 2>&1 &
  HEARTBEAT_PID=$!

  # Give it a moment to start
  sleep 0.5

  # Check if it's running
  if kill -0 "$HEARTBEAT_PID" 2>/dev/null; then
    echo "✅ Heartbeat active (PID: ${HEARTBEAT_PID})"
  else
    echo "⚠️  Heartbeat daemon failed to start (session still active)"
  fi

  echo ""
  echo "📱 Monitoring active for:"
  echo "  ${DESCRIPTION}"
  echo ""
  echo "You'll receive SMS for:"
  echo "  • ⚠️ Errors (blocking only)"
  echo "  • ⏳ Waiting for input"
  echo "  • ✅ When session completes"
  echo ""
  echo "Run /sms-stop to stop monitoring."
else
  # Check for error response
  ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4 || echo "Unknown error")
  echo ""
  echo "❌ Failed to start monitoring: ${ERROR_MSG}"
  echo ""
  if echo "$RESPONSE" | grep -q "401\|Unauthorized"; then
    echo "Your session may have expired."
    echo "Run /sms-setup to re-authenticate."
  fi
  exit 1
fi

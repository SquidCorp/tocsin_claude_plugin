#!/bin/bash
# sms-setup.sh - Start authentication flow with setup_id polling

set -e

AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TEMP_TOKEN_FILE="${CONFIG_DIR}/.temp_token"

# Parse arguments
REMOTE_MODE=false
PHONE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --remote)
      REMOTE_MODE=true
      if [[ -n "$2" && ! "$2" =~ ^-- ]]; then
        PHONE="$2"
        shift 2
      else
        echo "❌ Error: --remote requires a phone number"
        echo "Usage: /sms-setup --remote +1234567890"
        exit 1
      fi
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "⚠️  Warning: Unknown option $1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo "🦞 Claude SMS Notifier - Setup"
echo "==============================="
echo ""

# Check if already authenticated
if [ -f "${CONFIG_DIR}/auth.json" ]; then
  echo "✅ Already authenticated!"
  echo "Run /sms-logout to re-authenticate."
  exit 0
fi

# Create config directory
mkdir -p "$CONFIG_DIR"

# Generate CSRF state nonce
STATE=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "state-$(date +%s)")

echo "🔐 Initiating authentication flow..."
echo ""

# Remote mode: call API directly, skip browser
if [ "$REMOTE_MODE" = true ]; then
  # Validate phone number format (E.164)
  if [[ ! "$PHONE" =~ ^\+[1-9][0-9]{1,14}$ ]]; then
    echo "❌ Error: Invalid phone number format."
    echo "Use E.164 format: +1234567890"
    exit 1
  fi

  echo "📱 Sending SMS to ${PHONE}..."
  echo ""

  # Call server API directly (spec-compliant /login endpoint)
  RESPONSE=$(curl -s -X POST "${AUTH_URL}/login" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"${PHONE}\",\"state\":\"${STATE}\",\"mode\":\"remote\"}" \
    --max-time 10 2>/dev/null) || {
    echo "❌ Error: Could not reach SMS server."
    echo "Try without --remote flag for browser-based setup."
    exit 1
  }

  # Extract temp_token from response (spec-compliant field)
  TEMP_TOKEN=$(echo "$RESPONSE" | grep -o '"temp_token":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$TEMP_TOKEN" ]; then
    echo "❌ Error: Failed to initiate authentication."
    echo "Response: ${RESPONSE}"
    exit 1
  fi

  # Store temp_token securely
  echo "$TEMP_TOKEN" > "$TEMP_TOKEN_FILE"
  chmod 600 "$TEMP_TOKEN_FILE"

  echo "✅ SMS sent successfully!"
  echo ""
  echo "Check your phone for a 6-digit code, then run:"
  echo "  /sms-pair <code>"
  echo ""
  echo "⏳ Pairing code valid for 5 minutes."
  exit 0
fi

# Default browser mode
echo "📱 Opening browser for authentication..."
echo ""

# Build auth URL with state parameter
AUTH_URL_FULL="${AUTH_URL}/login?state=${STATE}"

# Open browser
case "$(uname -s)" in
  Darwin*)    open "$AUTH_URL_FULL" ;;
  Linux*)     xdg-open "$AUTH_URL_FULL" 2>/dev/null || sensible-browser "$AUTH_URL_FULL" 2>/dev/null || echo "Please open: $AUTH_URL_FULL" ;;
  CYGWIN*|MINGW*|MSYS*) start "$AUTH_URL_FULL" ;;
  *)          echo "Please open: $AUTH_URL_FULL" ;;
esac

echo "Next steps:"
echo "1. Enter your phone number on the webpage"
echo "2. Wait for SMS with the pairing code"
echo "3. Run: /sms-pair YOUR_6_DIGIT_CODE"
echo ""
echo "⏳ Pairing code valid for 5 minutes."

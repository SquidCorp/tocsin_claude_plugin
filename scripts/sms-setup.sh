#!/bin/bash
# sms-setup.sh - Start authentication flow with setup_id polling

set -e

AUTH_URL="${CLAUDE_SMS_AUTH_URL:-https://sms.shadowemployee.xyz}"
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SETUP_ID_FILE="${CONFIG_DIR}/.setup_id"

# Phone number validation function (E.164 format)
validate_phone() {
  local phone="$1"
  if [[ ! "$phone" =~ ^\+[1-9][0-9]{1,14}$ ]]; then
    echo "❌ Error: Invalid phone number format."
    echo "Use E.164 format: +1234567890 (max 15 digits)"
    return 1
  fi
  return 0
}

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

# Generate unique setup_id
SETUP_ID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || date +%s%N)
echo "$SETUP_ID" > "$SETUP_ID_FILE"
chmod 600 "$SETUP_ID_FILE"

echo "📋 Setup ID: ${SETUP_ID:0:8}..."
echo ""

# Remote mode: call API directly, skip browser
if [ "$REMOTE_MODE" = true ]; then
  # Validate phone number format (E.164)
  if ! validate_phone "$PHONE"; then
    exit 1
  fi

  echo "📱 Sending SMS to ${PHONE}..."
  echo ""

  # Call server API directly
  RESPONSE=$(curl -s -X POST "${AUTH_URL}/login/submit-with-setup" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"${PHONE}\",\"setup_id\":\"${SETUP_ID}\"}" \
    --max-time 10 2>/dev/null) || {
    echo "❌ Error: Could not reach SMS server."
    echo "Try without --remote flag for browser-based setup."
    exit 1
  }

  # Check if response contains pairing_code
  if echo "$RESPONSE" | grep -q '"pairing_code"'; then
    PAIRING_CODE=$(echo "$RESPONSE" | grep -o '"pairing_code":"[0-9]*"' | grep -o '[0-9]*')
    echo "✅ SMS sent successfully!"
    echo ""
    echo "Check your phone for the pairing code."
    echo "Then run: /sms-pair ${PAIRING_CODE}"
  else
    echo "❌ Error: Failed to send SMS."
    echo "Response: ${RESPONSE}"
    exit 1
  fi

  echo ""
  echo "⏳ Setup ID valid for 10 minutes."
  exit 0
fi

# Default browser mode
echo "📱 Opening browser for authentication..."
echo ""

# Build auth URL with setup_id
AUTH_URL_FULL="${AUTH_URL}/login?setup_id=${SETUP_ID}"

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
echo "⏳ Setup ID valid for 10 minutes."

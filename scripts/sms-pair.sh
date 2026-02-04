#!/bin/bash
# sms-pair.sh - Exchange pairing code for auth token using setup_id

set -e

AUTH_URL="${CLAUDE_SMS_AUTH_URL:-https://sms.shadowemployee.xyz}"
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SETUP_ID_FILE="${CONFIG_DIR}/.setup_id"
TOKEN_FILE="${CONFIG_DIR}/auth.json"
CODE="$1"

# Validate code
if [ -z "$CODE" ] || ! echo "$CODE" | grep -qE '^[0-9]{6}$'; then
  echo "❌ Error: Invalid pairing code"
  echo "Usage: /sms-pair 123456"
  exit 1
fi

# Read setup_id
if [ ! -f "$SETUP_ID_FILE" ]; then
  echo "❌ Error: No setup ID found."
  echo "   Run /sms-setup first."
  exit 1
fi

SETUP_ID=$(cat "$SETUP_ID_FILE")
if [ -z "$SETUP_ID" ]; then
  echo "❌ Error: Invalid setup ID."
  rm -f "$SETUP_ID_FILE"
  exit 1
fi

echo "🦞 Exchanging pairing code ${CODE}..."
echo ""

# Call exchange endpoint with setup_id
RESPONSE=$(curl -s -X POST "${AUTH_URL}/auth/exchange-by-setup" \
  -H "Content-Type: application/json" \
  -d "{\"setup_id\":\"${SETUP_ID}\",\"pairing_code\":\"${CODE}\"}" 2>/dev/null)

# Check for errors
if echo "$RESPONSE" | grep -q '"error"'; then
  ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "❌ Exchange failed: ${ERROR:-Invalid code or expired setup}"
  exit 1
fi

# Save token
echo "$RESPONSE" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

# Clean up setup_id
rm -f "$SETUP_ID_FILE"

# Extract info
PHONE=$(echo "$RESPONSE" | grep -o '"phone":"[^"]*"' | cut -d'"' -f4)
EXPIRES=$(echo "$RESPONSE" | grep -o '"expires_at":"[^"]*"' | cut -d'"' -f4)

echo "✅ Authentication successful!"
echo "   Phone: ${PHONE}"
echo "   Expires: ${EXPIRES}"
echo ""
echo "Next: Run /sms-start \"Your session description\""

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

# Validate response contains access_token (proper success indicator)
if ! echo "$RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
  # Extract error message from response (handles both JSON {"message":"..."} and plain text)
  ERROR=$(echo "$RESPONSE" | jq -r '.message // . // "Unknown error"' 2>/dev/null || echo "$RESPONSE")
  echo "❌ Exchange failed: ${ERROR}"
  echo ""
  echo "The pairing code may have expired or be invalid."
  echo "Run /sms-setup to generate a new code."
  exit 1
fi

# Save token
echo "$RESPONSE" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

# Extract and validate required fields
PHONE=$(echo "$RESPONSE" | jq -r '.phone // empty')
EXPIRES=$(echo "$RESPONSE" | jq -r '.expires_at // empty')

if [ -z "$PHONE" ] || [ -z "$EXPIRES" ]; then
  echo "❌ Error: Invalid response from server"
  echo "Response received:"
  cat "$TOKEN_FILE"
  rm -f "$TOKEN_FILE"
  exit 1
fi

# Only clean up setup_id after confirmed success
rm -f "$SETUP_ID_FILE"

echo "✅ Authentication successful!"
echo "   Phone: ${PHONE}"
echo "   Expires: ${EXPIRES}"
echo ""
echo "Next: Run /sms-start \"Your session description\""

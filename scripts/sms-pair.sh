#!/bin/bash
# sms-pair.sh - Exchange pairing code for auth token using temp_token

set -e

AUTH_URL="${CLAUDE_SMS_SERVER_URL:-https://sms.shadowemployee.xyz}"
CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TEMP_TOKEN_FILE="${CONFIG_DIR}/.temp_token"
TOKEN_FILE="${CONFIG_DIR}/auth.json"
CODE="$1"

# Validate code
if [ -z "$CODE" ] || ! echo "$CODE" | grep -qE '^[0-9]{6}$'; then
  echo "❌ Error: Invalid pairing code"
  echo "Usage: /sms-pair 123456"
  exit 1
fi

# Read temp_token
if [ ! -f "$TEMP_TOKEN_FILE" ]; then
  echo "❌ Error: No setup in progress."
  echo "   Run /sms-setup first."
  exit 1
fi

TEMP_TOKEN=$(cat "$TEMP_TOKEN_FILE")
if [ -z "$TEMP_TOKEN" ]; then
  echo "❌ Error: Invalid temporary token."
  rm -f "$TEMP_TOKEN_FILE"
  exit 1
fi

# Generate stable device fingerprint (workspace-based)
generate_device_fingerprint() {
  local workspace_path="${PWD}"
  local hostname="$(hostname 2>/dev/null || echo 'unknown')"
  local fingerprint_base="${workspace_path}:${hostname}"

  # Create hash of workspace + hostname
  if command -v md5 >/dev/null 2>&1; then
    echo -n "$fingerprint_base" | md5 | cut -c1-16
  elif command -v md5sum >/dev/null 2>&1; then
    echo -n "$fingerprint_base" | md5sum | cut -c1-16
  else
    # Fallback to simple truncation
    echo -n "$fingerprint_base" | cut -c1-16
  fi
}

DEVICE_FINGERPRINT=$(generate_device_fingerprint)

echo "🦞 Exchanging pairing code ${CODE}..."
echo ""

# Call exchange endpoint with temp_token (spec-compliant)
RESPONSE=$(curl -s -X POST "${AUTH_URL}/auth/exchange" \
  -H "Content-Type: application/json" \
  -d "{\"temp_token\":\"${TEMP_TOKEN}\",\"pairing_code\":\"${CODE}\",\"device_fingerprint\":\"${DEVICE_FINGERPRINT}\"}" 2>/dev/null)

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

# Only clean up temp_token after confirmed success
rm -f "$TEMP_TOKEN_FILE"

echo "✅ Authentication successful!"
echo "   Phone: ${PHONE}"
echo "   Expires: ${EXPIRES}"
echo ""
echo "Next: Run /sms-start \"Your session description\""

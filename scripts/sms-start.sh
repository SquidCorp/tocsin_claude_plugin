#!/bin/bash
# sms-start.sh - Start monitoring session

set -e

CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TOKEN_FILE="${CONFIG_DIR}/auth.json"
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

echo "🦞 Starting SMS monitoring..."
echo "Description: $DESCRIPTION"
echo ""
echo "✅ Monitoring session active!"
echo ""
echo "You'll receive SMS for:"
echo "  • ⚠️ Errors (blocking only)"
echo "  • ⏳ Waiting for input"
echo "  • ✅ When session completes"
echo ""
echo "Run /sms-stop to stop monitoring."

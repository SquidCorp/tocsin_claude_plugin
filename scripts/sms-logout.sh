#!/bin/bash
# sms-logout.sh - Clear authentication

set -e

CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TOKEN_FILE="${CONFIG_DIR}/auth.json"

echo "🦞 Logging out..."

if [ -f "$TOKEN_FILE" ]; then
  rm -f "$TOKEN_FILE"
  echo "✅ Logged out."
else
  echo "ℹ️ Already logged out."
fi

echo ""
echo "Run /sms-setup to authenticate again."

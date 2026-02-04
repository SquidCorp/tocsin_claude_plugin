#!/bin/bash
# sms-stop.sh - Stop monitoring session

set -e

CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
TOKEN_FILE="${CONFIG_DIR}/auth.json"

echo "🦞 Stopping SMS monitoring..."

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️ No active session."
  exit 0
fi

echo "✅ Monitoring stopped."
echo ""
echo "Note: Auth token preserved. Run /sms-logout to clear."

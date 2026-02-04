#!/bin/bash
# sms-status.sh - Check monitoring and heartbeat status

CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
SESSION_FILE="${CONFIG_DIR}/session.json"
PID_FILE="${CONFIG_DIR}/heartbeat.pid"
LOG_FILE="${CONFIG_DIR}/heartbeat.log"

echo "🦞 Claude SMS Notifier - Status"
echo "================================"
echo ""

# Check authentication
if [ -f "${CONFIG_DIR}/auth.json" ]; then
  PHONE=$(jq -r '.phone // "unknown"' "${CONFIG_DIR}/auth.json" 2>/dev/null)
  EXPIRES=$(jq -r '.expires_at // "unknown"' "${CONFIG_DIR}/auth.json" 2>/dev/null)
  echo "🔑 Authentication:"
  echo "   Phone: ${PHONE}"
  echo "   Expires: ${EXPIRES}"
else
  echo "❌ Not authenticated"
  echo "   Run /sms-setup --remote +phone"
fi

echo ""

# Check active session
if [ -f "$SESSION_FILE" ]; then
  MONITORING_ID=$(jq -r '.monitoring_id // "unknown"' "$SESSION_FILE" 2>/dev/null)
  DESCRIPTION=$(jq -r '.description // "No description"' "$SESSION_FILE" 2>/dev/null)
  STARTED=$(jq -r '.started_at // "unknown"' "$SESSION_FILE" 2>/dev/null)

  echo "📱 Active Session:"
  echo "   ID: ${MONITORING_ID}"
  echo "   Description: ${DESCRIPTION}"
  echo "   Started: ${STARTED}"
else
  echo "ℹ️  No active session"
  echo "   Run /sms-start \"description\""
fi

echo ""

# Check heartbeat daemon
if [ -f "$PID_FILE" ]; then
  HEARTBEAT_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$HEARTBEAT_PID" ] && kill -0 "$HEARTBEAT_PID" 2>/dev/null; then
    echo "💓 Heartbeat Daemon:"
    echo "   Status: Running"
    echo "   PID: ${HEARTBEAT_PID}"

    # Show last log lines if available
    if [ -f "$LOG_FILE" ]; then
      LAST_LOG=$(tail -n 1 "$LOG_FILE" 2>/dev/null)
      echo "   Last activity: ${LAST_LOG}"
      echo ""
      echo "   Recent logs (last 5):"
      tail -n 5 "$LOG_FILE" 2>/dev/null | sed 's/^/     /'
    fi
  else
    echo "⚠️  Heartbeat Daemon:"
    echo "   Status: Not running (PID file exists but process dead)"
    echo "   PID file: ${HEARTBEAT_PID}"
    rm -f "$PID_FILE"
  fi
else
  echo "💤 Heartbeat Daemon: Not active"
fi

echo ""
echo "================================"

#!/bin/bash
# Handle user activity (prompt submission) - resets idle timer

# Read JSON input from stdin
INPUT=$(cat)

# Extract session ID
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Update session file with last activity
SESSION_FILE="/tmp/claude-sms-sessions/${SESSION_ID}.json"
if [ -f "$SESSION_FILE" ]; then
  # Update last_activity timestamp
  jq '.last_activity = now' "$SESSION_FILE" > "${SESSION_FILE}.tmp" && mv "${SESSION_FILE}.tmp" "$SESSION_FILE"
fi

exit 0

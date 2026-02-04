# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code plugin that sends SMS notifications when Claude needs user attention during remote/long-running sessions. The plugin hooks into Claude Code events (errors, completion, inactivity) and communicates with an external SMS server.

## Architecture

### Two-Component System

1. **Plugin (this repo)**: Bash scripts that integrate with Claude Code
2. **External Server** (separate): Handles authentication, SMS delivery via Twilio, and session storage in Neon DB

### Data Flow

```
Claude Code → Plugin Hooks → Shell Scripts → HTTP API → SMS Server → Twilio → User's Phone
```

### State Management

The plugin stores state in `~/.config/claude-sms-notifier/`:
- `auth.json` - JWT token (36h expiry) from auth server
- `session.json` - Current monitoring session (monitoring_id, session_token)
- `.setup_id` - Temporary setup identifier during auth flow

**Critical**: Never use `/tmp` for session data (security issue). Always use `~/.config/` with 600 permissions.

### Hook Architecture

The plugin registers three Claude Code hooks in `hooks/hooks.json`:

1. **PostToolUseFailure** - Triggered when any tool fails
   - Filters for "blocking" errors only (permission denied, rate limit, fatal, crash, etc.)
   - Sends event to server with tool name and error message
   - Server applies rate limiting (1 SMS per 30min per event type)

2. **UserPromptSubmit** - Triggered when user sends a message
   - Resets inactivity timer
   - Sends heartbeat to server

3. **SessionEnd** - Triggered when Claude session ends
   - Sends completion notification to server
   - Cleans up session.json

**Important**: Claude Code hooks provide data via **environment variables**, not stdin. Scripts should read `CLAUDE_HOOK_*` vars, not `$(cat)`.

### Environment Variables

Required:
- `CLAUDE_SMS_AUTH_URL` or `CLAUDE_SMS_SERVER_URL` - Base URL for SMS server (e.g., https://sms.shadowemployee.xyz)

Optional (mentioned in README but not implemented):
- `CLAUDE_SMS_HEARTBEAT_INTERVAL` - Default 30000ms
- `CLAUDE_SMS_INACTIVITY_THRESHOLD` - Default 600000ms
- `CLAUDE_SMS_LOG_LEVEL` - Default "info"

**Note**: The plugin currently uses defaults hardcoded in scripts. Environment variable support is planned but not yet implemented.

## Testing Plugin Locally

Since this is a Claude Code plugin, testing requires:

1. **Install plugin locally**:
   ```bash
   claude plugin install /Users/fambr/Development/claude-sms-project/tocsin_claude_plugin
   ```

2. **Test authentication flow**:
   ```bash
   # In Claude Code interface:
   /sms-setup --remote +1234567890
   /sms-pair 123456
   ```

3. **Test monitoring**:
   ```bash
   /sms-start "Test session"
   # Trigger some work...
   /sms-stop
   ```

4. **Check state files**:
   ```bash
   cat ~/.config/claude-sms-notifier/auth.json
   cat ~/.config/claude-sms-notifier/session.json
   ```

5. **Verify hooks fire** (check server logs or add local logging):
   ```bash
   # Hooks don't have direct output
   # Check server received events or add logging to scripts
   ```

## Server API Integration

The plugin expects these endpoints (see `docs/api-spec.md` for full spec):

**Authentication**:
- `POST /login/submit-with-setup` - Remote setup (sends SMS)
- `POST /auth/exchange-by-setup` - Exchange setup_id + pairing_code for JWT

**Session Management**:
- `POST /sessions/start` - Create monitoring session (returns monitoring_id, session_token)
- `POST /sessions/{id}/events` - Report error/done/waiting events
- `POST /sessions/{id}/heartbeat` - Keep-alive ping
- `POST /sessions/{id}/stop` - End monitoring

**Authentication**: JWT in `Authorization: Bearer {token}` header
**Session endpoints**: Use session_token (not auth token) for authorization

## Common Development Tasks

### Making Scripts Executable

Scripts must have execute permissions to work as plugin commands:
```bash
chmod +x scripts/*.sh
git add scripts/  # Git tracks execute bit
git commit -m "fix: add execute permissions"
```

Verify: `ls -l scripts/` should show `-rwxr-xr-x`

### Adding a New Command

1. Create `commands/my-command.md`:
   ```markdown
   # /my-command

   Description of what it does.

   ```bash
   #!/bin/bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/my-command.sh" "${ARGUMENTS}"
   ```
   ```

2. Create `scripts/my-command.sh`:
   ```bash
   #!/bin/bash
   set -e

   CONFIG_DIR="${HOME}/.config/claude-sms-notifier"
   # Implementation...
   ```

3. Make executable: `chmod +x scripts/my-command.sh`

4. Test: `/my-command` in Claude Code

### Adding a New Hook

1. Edit `hooks/hooks.json`, add to `hooks` object:
   ```json
   "NewHookName": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "${CLAUDE_PLUGIN_ROOT}/scripts/handle-new-hook.sh",
           "env": {
             "CLAUDE_HOOK_CUSTOM_VAR": "{{someValue}}"
           }
         }
       ]
     }
   ]
   ```

2. Create handler script that reads environment variables
3. Make executable
4. Test by triggering the hook event

### Debugging Hook Issues

**Problem**: Hooks not firing or hanging

**Common causes**:
1. Script not executable (`chmod +x scripts/handle-*.sh`)
2. Script reads stdin with `$(cat)` but Claude Code doesn't send stdin
3. Script has syntax error (check with `bash -n script.sh`)
4. Missing session.json file (hooks exit early if not monitoring)

**Debug approach**:
1. Add logging: `echo "Hook fired" >> /tmp/hook-debug.log`
2. Check script exits quickly: `time ./scripts/handle-error.sh`
3. Test environment vars are available: `env | grep CLAUDE`

### Testing API Integration

Use curl to test server endpoints:

```bash
# Setup (get temp pairing code)
curl -X POST https://sms.shadowemployee.xyz/login/submit-with-setup \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","setup_id":"test-123"}'

# Exchange for token
curl -X POST https://sms.shadowemployee.xyz/auth/exchange-by-setup \
  -H "Content-Type: application/json" \
  -d '{"setup_id":"test-123","pairing_code":"123456"}'

# Start session
curl -X POST https://sms.shadowemployee.xyz/sessions/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"claude_session_id":"test","description":"Test"}'
```

## Known Implementation Gaps

The README describes aspirational features that aren't yet implemented:

### Missing Features (from README):
- ❌ Continuous heartbeat background process (30s interval)
- ❌ Inactivity timer background process (10min idle detection)
- ❌ Local rate limiting (server-side only)
- ❌ Token auto-refresh (manual re-auth required after 36h)
- ❌ MCP server for OAuth callback (browser mode doesn't work)

### What Actually Works:
- ✅ Authentication via `/sms-setup --remote` (direct API call)
- ✅ Session creation/cleanup with server sync
- ✅ Hook-based event reporting (one-shot, not continuous)
- ✅ Error detection and notification
- ✅ Session end notification

### Implementation Status by Script:
- `sms-setup.sh` - ✅ Works (remote mode), ⚠️ Browser mode needs MCP server
- `sms-pair.sh` - ✅ Works
- `sms-start.sh` - ✅ API call works, ❌ Missing background heartbeat/inactivity timers
- `sms-stop.sh` - ✅ Works
- `sms-logout.sh` - ✅ Works
- `handle-error.sh` - ⚠️ Works but reads stdin instead of env vars (needs fix)
- `handle-activity.sh` - ⚠️ Same stdin issue
- `handle-session-end.sh` - ⚠️ Same stdin issue

## Critical Implementation Notes

### Hook Data Access Pattern (Current Bug)

**Current implementation** (incorrect):
```bash
# handle-error.sh - WRONG
INPUT=$(cat)  # Blocks forever waiting for stdin
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
```

**Should be** (correct):
```bash
# handle-error.sh - CORRECT
TOOL_NAME="${CLAUDE_HOOK_TOOL_NAME:-unknown}"
ERROR="${CLAUDE_HOOK_ERROR_OUTPUT:-}"
```

Claude Code hooks inject data via environment variables, not stdin JSON.

### File Permissions

All files in `~/.config/claude-sms-notifier/` must have 600 permissions:
```bash
chmod 600 "$TOKEN_FILE"
chmod 600 "$SESSION_FILE"
```

This prevents other users from reading sensitive tokens.

### Error Pattern Matching

The plugin only sends SMS for "blocking" errors. Current patterns:
```bash
"permission denied|rate limit|fatal|crash|connection refused|unauthorized|authentication failed"
```

Not considered blocking (no SMS):
- File not found
- Syntax errors
- Non-critical warnings

### API URL Inconsistency

Scripts use different environment variable names:
- `sms-setup.sh`, `sms-pair.sh` use `CLAUDE_SMS_AUTH_URL`
- `sms-start.sh`, hooks use `CLAUDE_SMS_SERVER_URL`

Both default to `https://sms.shadowemployee.xyz`. This should be unified.

## Security Considerations

1. **Never commit tokens**: `.gitignore` excludes `**/.config/` and `**/auth.json`
2. **HTTPS only**: All server communication must use TLS
3. **Phone number validation**: E.164 format required (`^\+[1-9][0-9]{1,14}$`)
4. **Token lifetime**: 36 hours, stored with 600 permissions
5. **Session token separation**: Different token for each monitoring session

## Plugin Installation

Users install with:
```bash
export CLAUDE_SMS_AUTH_URL="https://sms.yourserver.com"
claude plugin install /path/to/tocsin_claude_plugin
```

Then in Claude Code:
```bash
/sms-setup --remote +1234567890
/sms-pair 123456
/sms-start "Working on feature X"
```

## Future Development

### Planned Features (not yet implemented):
1. Background heartbeat daemon (keep session alive)
2. Inactivity timer process (detect 10min idle)
3. Token auto-refresh before expiry
4. MCP server for browser-based OAuth flow
5. Local rate limiting (per-event-type cooldown)
6. Logging system (file-based debug logs)

See `REMEDIATION_PLAN.md` for detailed implementation guidance.

## Documentation Files

- `README.md` - User-facing documentation (aspirational, describes planned features)
- `docs/api-spec.md` - Server API contract (request/response schemas)
- `AUDIT_REPORT.md` - Security and functionality audit findings
- `REMEDIATION_PLAN.md` - Step-by-step fix instructions for known issues
- `UPDATED_AUDIT.md` - Latest review of changes and remaining issues
- `QUICK_FIXES.md` - 20-minute path to working beta

When reading README, note that ~40% of described features aren't implemented yet. Check other audit docs for actual implementation status.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code plugin that sends SMS notifications when Claude needs user attention during remote/long-running sessions. The plugin hooks into Claude Code events (errors, completion, inactivity) and communicates with an external SMS server.

## Architecture

### Two-Component System

1. **Plugin (this repo)**: Node.js scripts that integrate with Claude Code via hooks
2. **External Server** (separate): Handles authentication, SMS delivery via Twilio, and session storage in Neon DB

### Data Flow

```
Claude Code → Plugin Hooks → Node.js Scripts → HTTP API → SMS Server → Twilio → User's Phone
```

### State Management

The plugin stores state in `~/.config/tocsin/`:

- `auth.json` - JWT token (36h expiry) from auth server
- `session.json` - Current monitoring session (monitoring_id, session_token, claude_session_id, description, hostname, started_at)
- `.setup_id` - Temporary setup identifier during auth flow

**Session data** (as of 2026-02-06):
- No client-side activity tracking (`last_activity`, `waiting_event_sent` removed)
- Server handles all rate limiting and cooldown logic
- Cleaner session.json structure with only essential fields

**Critical**: Never use `/tmp` for session data (security issue). Always use `~/.config/` with 600 permissions.

### Hook Architecture

The plugin registers **five** Claude Code hooks in `hooks/hooks.json`:

1. **PostToolUseFailure** - Triggered when any tool fails
   - Filters for "blocking" errors only (permission denied, rate limit, fatal, crash, etc.)
   - Sends error event to server with tool name and error message
   - Server applies rate limiting (1 SMS per 30min per event type)
   - Runs asynchronously (non-blocking)

2. **UserPromptSubmit** - Triggered when user sends a message
   - Sends heartbeat to server (server tracks activity time)
   - Keeps session alive
   - Runs asynchronously (non-blocking)

3. **Notification** (idle_prompt) - Triggered when Claude is waiting for user response
   - Fires when Claude Code detects user has been idle
   - Sends "waiting" event immediately to server (no client-side cooldown)
   - Server applies rate limiting (1 SMS per 30min per event type)
   - Runs asynchronously (non-blocking)

4. **Stop** - Triggered when Claude finishes responding to current task
   - Sends completion notification ("done" event)
   - Different from SessionEnd (which fires on session termination)
   - Prevents infinite loops with `stop_hook_active` check
   - Runs asynchronously (non-blocking)

5. **SessionEnd** - Triggered when Claude session terminates (user exits)
   - Cleans up session.json and heartbeat daemon
   - Sends final stop event to server
   - Runs synchronously to ensure cleanup completes

**Important**: According to [official Claude Code documentation](https://code.claude.com/docs/en/hooks), hooks receive data via **stdin as JSON**, not environment variables. All hook scripts use the standard pattern:

```javascript
import { readStdin } from './lib/stdin.js';

const input = await readStdin();
const toolName = input.tool_name || 'unknown';
const error = input.error || '';
```

### Environment Variables

Required:

- `CLAUDE_SMS_SERVER_URL` - Base URL for SMS server (e.g., http://localhost:3000)

Optional:

- `CLAUDE_SMS_HEARTBEAT_INTERVAL` - Default 30000ms (heartbeat interval)
- `CLAUDE_SMS_LOG_LEVEL` - Default "info"

**Note**: Environment variable configuration is supported but defaults are hardcoded in `scripts/lib/config.js`.

**Removed** (as of 2026-02-06):
- `CLAUDE_SMS_INACTIVITY_THRESHOLD` - No longer used; server handles all rate limiting

## Testing Plugin Locally

Since this is a Claude Code plugin, testing requires:

1. **Install plugin locally**:

   ```bash
   claude plugin install /Users/fambr/Development/claude-sms-project/tocsin_claude_plugin
   ```

2. **Test authentication flow**:

   ```bash
   # In Claude Code interface:
   /sms-login +1234567890
   /sms-pair 123456
   ```

3. **Test monitoring**:

   ```bash
   /sms-start "Test session"
   # Trigger some work...
   /sms-unpair
   ```

4. **Check state files**:

   ```bash
   cat ~/.config/tocsin/auth.json
   cat ~/.config/tocsin/session.json
   ```

5. **Test hooks** (check server logs for events):
   - Trigger error: Try invalid command → PostToolUseFailure fires
   - Test activity: Send prompt → UserPromptSubmit fires
   - Test idle: Wait for Claude to become idle → Notification fires
   - Test completion: Let Claude finish task → Stop fires
   - Test cleanup: Exit Claude → SessionEnd fires

6. **Debug mode**:
   ```bash
   claude --debug  # See hook execution details
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

Scripts must have execute permissions to work:

```bash
chmod +x scripts/*.js
git add scripts/  # Git tracks execute bit
git commit -m "fix: add execute permissions"
```

Verify: `ls -l scripts/` should show `-rwxr-xr-x`

### Adding a New Command

1. Create `commands/my-command.md`:

   ````markdown
   # /my-command

   Description of what it does.

   ```bash
   #!/bin/bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/my-command.js" "${ARGUMENTS}"
   ```
   ````

2. Create `scripts/my-command.js`:

   ```javascript
   #!/usr/bin/env node

   import { FILES } from './lib/config.js';
   import { readJSON, writeJSON } from './lib/files.js';

   // Implementation...
   ```

3. Make executable: `chmod +x scripts/my-command.js`

4. Test: `/my-command` in Claude Code

### Adding a New Hook

1. Edit `hooks/hooks.json`, add to `hooks` object:

   ```json
   "HookEventName": [
     {
       "matcher": "optional-regex-pattern",
       "hooks": [
         {
           "type": "command",
           "command": "${CLAUDE_PLUGIN_ROOT}/scripts/handle-new-hook.js",
           "async": true,
           "timeout": 30,
           "statusMessage": "Processing..."
         }
       ]
     }
   ]
   ```

2. Create handler script that reads from stdin:

   ```javascript
   #!/usr/bin/env node

   import { readStdin } from './lib/stdin.js';

   (async () => {
     try {
       const input = await readStdin();

       // Extract hook-specific fields from input
       const field = input.field_name || '';

       // Process and send to server
       // ...

       process.exit(0);
     } catch (error) {
       // Hooks must never block Claude Code
       process.exit(0);
     }
   })();
   ```

3. Make executable: `chmod +x scripts/handle-new-hook.js`

4. Test by triggering the hook event

### Debugging Hook Issues

**Problem**: Hooks not firing or hanging

**Common causes**:

1. Script not executable (`chmod +x scripts/handle-*.js`)
2. Script has syntax error (check with `node --check script.js`)
3. Missing session.json file (hooks exit early if not monitoring)
4. Hook timeout too short (increase `timeout` value)
5. Async network calls blocking (mark hook as `async: true`)

**Debug approach**:

1. Run `claude --debug` to see hook execution logs
2. Check script runs: `echo '{"test":"data"}' | ./scripts/handle-error.js`
3. Add temporary logging: `console.error("Hook fired:", input);`
4. Verify JSON input: `cat ~/.claude/projects/.../transcript.jsonl`

**Hook Input/Output**:
- ✅ **Input**: JSON via stdin (official pattern)
- ✅ **Output**: Exit code 0 = success, non-zero = error (won't block if async)
- ✅ **Common fields**: All hooks receive `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`

### Testing API Integration

Use curl to test server endpoints:

```bash
# Setup (get temp pairing code)
curl -X POST http://localhost:3000/login/submit-with-setup \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","setup_id":"test-123"}'

# Exchange for token
curl -X POST http://localhost:3000/auth/exchange-by-setup \
  -H "Content-Type: application/json" \
  -d '{"setup_id":"test-123","pairing_code":"123456"}'

# Start session
curl -X POST http://localhost:3000/sessions/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"claude_session_id":"test","description":"Test"}'
```

## Implementation Status

### Fully Implemented Features:

- ✅ Authentication via `/sms-login` (direct API call)
- ✅ Session creation/cleanup with server sync
- ✅ Hook-based event reporting (async, non-blocking)
- ✅ Error detection and notification (blocking errors only)
- ✅ Idle detection notification (immediate, server-side rate limiting)
- ✅ Task completion notification (Stop hook)
- ✅ Session end notification and cleanup (SessionEnd hook)
- ✅ All hooks read from stdin per official docs
- ✅ Heartbeat-only daemon (no client-side cooldown logic)
- ✅ Server-side rate limiting (1 SMS per 30min per event type)
- ✅ **Centralized 401 authentication error handling** (2026-02-08)
  - Automatic logout on token expiry/revocation
  - Type-safe `AuthenticationError` class
  - Consistent handling across all 10 scripts (commands, hooks, daemon)
  - User-friendly error messages for commands
  - Silent handling for background processes (hooks, daemon)

### Implementation Status by Hook:

- `handle-error.js` - ✅ Reads stdin, filters blocking errors, sends to server
- `handle-activity.js` - ✅ Reads stdin, sends heartbeat on user prompt
- `handle-idle.js` - ✅ NEW: Reads stdin, detects idle_prompt, sends waiting event
- `handle-completion.js` - ✅ NEW: Reads stdin, sends done event when Claude stops
- `handle-session-end.js` - ✅ Reads stdin, cleans up session on termination

### Implementation Status by Command:

- `sms-login.js` - ✅ Works (remote mode), ⚠️ Browser mode needs MCP server
- `sms-pair.js` - ✅ Works
- `sms-start.js` - ✅ Works, creates monitoring session
- `sms-unpair.js` - ✅ Works, ends monitoring session
- `sms-logout.js` - ✅ Works
- `sms-status.js` - ✅ Works, shows auth and session status

### Missing Features (Future Development):

- ❌ Token auto-refresh (manual re-auth required after 36h)
- ❌ MCP server for OAuth callback (browser mode doesn't work)

### Removed Features (Delegated to Server):

- ❌ Local rate limiting - **Server handles this** (1 SMS per 30min per event type)
- ❌ Client-side inactivity cooldown - **Removed 2026-02-06** (server-side rate limiting only)

**Note**: The README may describe some aspirational features not yet implemented. This CLAUDE.md reflects actual implementation status.

## Critical Implementation Notes

### Hook Data Access Pattern

**According to [official Claude Code documentation](https://code.claude.com/docs/en/hooks#hook-input-and-output):**

Hooks receive JSON data via **stdin**, not environment variables.

**Correct implementation** (all our hooks use this):

```javascript
#!/usr/bin/env node

import { readStdin } from './lib/stdin.js';

(async () => {
  const input = await readStdin();

  // Extract fields from JSON input
  const toolName = input.tool_name || 'unknown';
  const error = input.error || '';
  const sessionId = input.session_id || '';

  // Process...
})();
```

**stdin.js helper**:
```javascript
export async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}
```

### Available Hook Input Fields

Each hook type receives different fields. Check [official docs](https://code.claude.com/docs/en/hooks#hook-events) for complete schemas:

**PostToolUseFailure**:
- `tool_name`, `tool_input`, `tool_use_id`
- `error` - Error message string
- `is_interrupt` - Boolean indicating user cancellation

**UserPromptSubmit**:
- `prompt` - User's submitted text

**Notification**:
- `notification_type` - Type of notification (e.g., "idle_prompt")
- `message` - Notification text
- `title` - Optional title

**Stop**:
- `stop_hook_active` - Boolean to prevent infinite loops

**SessionEnd**:
- `reason` - Why session ended (clear, logout, prompt_input_exit, etc.)

All hooks also receive common fields: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`.

### File Permissions

All files in `~/.config/tocsin/` must have 600 permissions:

```bash
chmod 600 "$TOKEN_FILE"
chmod 600 "$SESSION_FILE"
```

This prevents other users from reading sensitive tokens.

### Error Pattern Matching

The plugin only sends SMS for "blocking" errors (see `scripts/lib/config.js`):

```javascript
export const BLOCKING_PATTERNS = /permission denied|rate limit|fatal|crash|connection refused|unauthorized|authentication failed/i;
```

Not considered blocking (no SMS):
- File not found
- Syntax errors
- Non-critical warnings

### Async Hooks

Most hooks use `"async": true` to run in background without blocking Claude:

```json
{
  "type": "command",
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/handle-error.js",
  "async": true,
  "timeout": 30
}
```

Exception: SessionEnd runs synchronously (`async` omitted) to ensure cleanup completes before session terminates.

### API URL Configuration

All scripts use `CLAUDE_SMS_SERVER_URL` for the base server URL.

Default: `http://localhost:3000`

Users can override:

```bash
export CLAUDE_SMS_SERVER_URL="https://sms.yourserver.com"
```

## Authentication Error Handling (NEW: 2026-02-08)

The plugin implements centralized 401 authentication error handling across all scripts.

### Architecture

**Three-Layer Design**:

1. **Detection Layer** (`scripts/lib/api.js`):
   - Custom `AuthenticationError` class extends `Error`
   - Automatically thrown when server returns 401 Unauthorized
   - Type-safe with `instanceof` checks

2. **Handling Layer** (`scripts/lib/auth-utils.js`):
   - `handleAuthenticationError({ silent, context })` function
   - Automatically deletes `auth.json` (logout)
   - Displays user message (commands) or silent (hooks/daemon)
   - Logs to console.error for debugging

3. **Consumer Layer** (10 scripts):
   - All commands, hooks, and daemon catch `AuthenticationError`
   - Call `handleAuthenticationError()` with appropriate options
   - Commands: Show error message and exit(1)
   - Hooks: Silent logout and exit(0) to never block
   - Daemon: Silent logout and return fatal error flag

### Behavior by Context

**Commands** (user-initiated):
```javascript
catch (error) {
  if (error instanceof AuthenticationError) {
    handleAuthenticationError({ context: 'sms-start' });
    process.exit(1);
  }
}
```
User sees: "⚠️ Authentication Failed - Please re-authenticate with: /sms-login +1234567890"

**Hooks** (background events):
```javascript
catch (error) {
  if (error instanceof AuthenticationError) {
    handleAuthenticationError({ silent: true, context: 'handle-error' });
  }
}
process.exit(0); // Never block Claude Code
```
User sees: Nothing immediately. Next command shows auth error.

**Daemon** (long-running):
```javascript
catch (error) {
  if (error instanceof AuthenticationError) {
    handleAuthenticationError({ silent: true, context: 'heartbeat-daemon' });
    return { success: false, fatal: true };
  }
}
```
Daemon exits gracefully. User sees auth error on next command.

### Benefits

- ✅ Single source of truth for auth error detection
- ✅ Consistent logout behavior across all contexts
- ✅ Type-safe error handling with custom error class
- ✅ No duplicate code (all use shared utility)
- ✅ Easy to test and maintain
- ✅ Clear user messages for commands
- ✅ Silent handling for background processes

See `docs/authentication-error-flow.md` for detailed architecture diagrams.

## Security Considerations

1. **Never commit tokens**: `.gitignore` excludes `**/.config/` and `**/auth.json`
2. **HTTPS only**: All production server communication must use TLS
3. **Phone number validation**: E.164 format required (`^\+[1-9][0-9]{1,14}$`)
4. **Token lifetime**: 36 hours, stored with 600 permissions
5. **Session token separation**: Different token for each monitoring session
6. **Hook safety**: All hooks exit(0) on errors to never block Claude Code
7. **Automatic logout on 401**: Auth token is deleted when server returns Unauthorized

## Plugin Installation

Users install with:

```bash
export CLAUDE_SMS_SERVER_URL="https://sms.yourserver.com"
claude plugin install /path/to/tocsin_claude_plugin
```

Then in Claude Code:

```bash
/sms-login +1234567890
/sms-pair 123456
/sms-start "Working on feature X"
```

The plugin will now send SMS notifications for:
- ❌ Blocking errors (permission denied, crashes, etc.)
- ⏰ Idle time (Claude waiting for response)
- ✅ Task completion (Claude finished responding)

## Documentation Files

- `README.md` - User-facing documentation and installation guide
- `docs/api-spec.md` - Server API contract (request/response schemas)
- `CLAUDE.md` - This file: developer guidance (you are here)
- `AUDIT_REPORT.md` - Security and functionality audit findings
- `REMEDIATION_PLAN.md` - Step-by-step fix instructions for known issues
- `MIGRATION_SUMMARY.md` - Bash to Node.js migration notes
- `HEARTBEAT_IMPLEMENTATION.md` - Background heartbeat daemon design
- `CENTRALIZED_401_HANDLING.md` - Authentication error handling implementation summary (NEW: 2026-02-08)
- `docs/authentication-error-flow.md` - Detailed architecture diagrams for 401 handling (NEW: 2026-02-08)

## Official Documentation References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Hook Events Reference](https://code.claude.com/docs/en/hooks#hook-events)
- [Hook Input/Output](https://code.claude.com/docs/en/hooks#hook-input-and-output)
- [Plugin Development Guide](https://code.claude.com/docs/en/plugins)

When in doubt, **official Claude Code documentation is the authoritative source**.

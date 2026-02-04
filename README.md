# Claude SMS Notifier

Get SMS notifications when Claude Code needs your attention, finishes work, or hits errors. Perfect for remote/long-running sessions.

## Quick Start

```bash
# 1. Set your SMS server URL
export CLAUDE_SMS_SERVER_URL="https://sms.yourserver.com"

# 2. Install the plugin
claude plugin install /path/to/claude-sms-notifier

# 3. In Claude Code, authenticate
/sms-setup
# (opens browser, enter phone, get SMS code)

/sms-pair 123456  # your 6-digit code

# 4. Start monitoring a session
/sms-start "Fixing production bug"
# Work remotely... get SMS when Claude needs you!
```

---

## How It Works

### The Big Picture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Claude Code │────▶│ Your Server  │────▶│   Twilio    │
│   (plugin)  │◄────│  (auth/SMS)  │◄────│   (SMS)     │
└─────────────┘     └──────────────┘     └─────────────┘
       │                     │
       ▼                     ▼
  Hooks fire           Neon DB stores
  (error/done/         session history
  waiting)
```

### Step-by-Step Flow

1. **Setup** (`/sms-setup`)
   - Plugin opens browser to your auth server
   - User enters phone number
   - Auth server sends 6-digit pairing code via SMS
   - User enters code with `/sms-pair 123456`
   - Plugin receives JWT token (valid 36 hours)

2. **Start Monitoring** (`/sms-start "description"`)
   - Plugin registers session with your server
   - Server returns session token for this specific session
   - Hooks start watching for events (error detection, session end)

3. **While Working**
   - **User sends message** → Heartbeat sent to server
   - **Tool fails** → Hook fires → Report to server → SMS sent (if not rate limited)
   - **Session ends** → Hook fires → "Done" SMS sent

4. **Rate Limiting** (Server-Side)
   - Server enforces 1 SMS per 30 minutes **per event type**
   - Error at 14:00 → SMS sent
   - Error at 14:15 → Blocked by server (same type, <30min)
   - Done at 14:15 → SMS sent (different type)

5. **Cleanup** (`/sms-stop` or session end)
   - Send final state to server
   - Remove session.json file

---

## Architecture

### Plugin Components

```
claude-sms-notifier/
├── commands/               # User-facing commands
│   ├── sms-setup.md       # /sms-setup
│   ├── sms-pair.md        # /sms-pair
│   ├── sms-start.md       # /sms-start
│   ├── sms-stop.md        # /sms-stop
│   └── sms-logout.md      # /sms-logout
├── hooks/
│   └── hooks.json         # Event registrations
├── scripts/               # Bash implementations
│   ├── sms-setup.sh       # Authentication flow
│   ├── sms-pair.sh        # Token exchange
│   ├── sms-start.sh       # Session start + server sync
│   ├── sms-stop.sh        # Session end
│   ├── sms-logout.sh      # Revoke auth
│   ├── handle-error.sh    # PostToolUseFailure hook
│   ├── handle-activity.sh # UserPromptSubmit hook
│   └── handle-session-end.sh # SessionEnd hook
└── .claude-plugin/        # Plugin metadata
    └── plugin.json        # Plugin manifest
```

### Data Flow

**Authentication Flow (Remote Mode - Current Implementation):**
```
User: /sms-setup --remote +1234567890
  ▼
Plugin generates setup_id (UUID)
  ▼
Plugin POST /login/submit-with-setup (phone, setup_id)
  ▼
Server sends SMS with 6-digit pairing code
  ▼
Server returns setup_id confirmation
  ▼
User receives SMS with code
  ▼
User: /sms-pair 123456
  ▼
Plugin POST /auth/exchange-by-setup (setup_id, pairing_code)
  ▼
Server validates and returns JWT (36h expiry)
  ▼
Plugin stores token in ~/.config/claude-sms-notifier/auth.json (600 perms)
```

**Browser Mode (Planned, Not Yet Implemented):**
The `/sms-setup` command without `--remote` flag is intended to open a browser for OAuth flow, but this requires an MCP server implementation that isn't available yet. Use `--remote` mode for now.

**Session Monitoring Flow:**
```
User: /sms-start "Fixing bug"
  ▼
Plugin POST /sessions/start (claude_session_id, description)
  ▼
Server returns: session_token, monitoring_id
  ▼
Plugin starts:
  • Heartbeat interval (30s)
  • Inactivity timer (10min)
  • Hook listeners
  ▼
[Events]
  ├─ PostToolUseFailure ──▶ Report error ──▶ SMS
  ├─ UserPromptSubmit ────▶ Reset timer
  ├─ 10min inactivity ────▶ Report waiting ──▶ SMS
  └─ SessionEnd ──────────▶ Report done ──▶ SMS
```

---

## Server API Contract

Your server must implement these endpoints:

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | GET | OAuth entry, accepts `callback_uri` param |
| `/auth/exchange` | POST | Exchange temp_token + pairing_code for JWT |
| `/auth/refresh` | POST | Refresh JWT before expiry |
| `/auth/logout` | POST | Revoke token |

### Session Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sessions/start` | POST | Register new session, return session_token |
| `/sessions/{id}/events` | POST | Report event (error/done/waiting) |
| `/sessions/{id}/heartbeat` | POST | Keep-alive ping |
| `/sessions/{id}/stop` | POST | End monitoring |

See `docs/api-spec.md` for complete request/response schemas.

---

## Configuration

### Environment Variables (Plugin)

```bash
# Required
CLAUDE_SMS_SERVER_URL=https://sms.yourserver.com  # Default: https://sms.shadowemployee.xyz

# Optional (with defaults)
CLAUDE_SMS_HEARTBEAT_INTERVAL=30  # Heartbeat interval in seconds (default: 30)
```

### Environment Variables (Your Server)

```bash
# Required for your server implementation
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# Neon DB
DATABASE_URL=postgresql://...

# JWT Secret
JWT_SECRET=your-secret-key
```

---

## Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/sms-setup` | Start OAuth flow | First time, or token expired (36h) |
| `/sms-pair 123456` | Complete auth | After receiving SMS code |
| `/sms-start "desc"` | Start monitoring | Beginning of focused work session |
| `/sms-stop` | Stop monitoring | Done early, don't want more SMS |
| `/sms-status` | Check status | See active session, heartbeat daemon state |
| `/sms-logout` | Revoke auth | Switch phone, uninstall, security |

---

## SMS Message Examples

**Error:**
```
⚠️ Claude: "Fixing Docker build"
Error: npm install failed

Reply STOP to disable
```

**Done:**
```
✅ Claude: "Refactor auth module"
Completed successfully!

Reply STOP to disable
```

**Waiting:**
```
⏳ Claude: "Database migration"
Waiting for input (idle detected)

Reply STOP to disable

Note: Idle detection not yet implemented in v1.0.0
```

---

## Current Implementation Status

### ✅ What Works Now

- **Authentication**: Remote mode (`--remote +phone`) for headless/SSH sessions
- **Session Management**: Create/stop monitoring sessions with server sync
- **Background Heartbeat**: Daemon process that sends keep-alive pings every 30 seconds
- **Event Hooks**: Three hooks that trigger on Claude Code events
  - `PostToolUseFailure` - Detects blocking errors and sends SMS
  - `UserPromptSubmit` - Sends heartbeat when user sends messages
  - `SessionEnd` - Notifies when Claude session ends and stops heartbeat daemon
- **Server Integration**: Full API integration for session tracking and event reporting
- **Error Filtering**: Only sends SMS for blocking errors (not file-not-found, syntax errors, etc.)
- **Security**: Proper token storage (600 permissions), HTTPS-only, separate session tokens

### 🚧 Planned Features (Not Yet Implemented)

The following features are **planned but not yet available**:

- **Inactivity Timer**: Automatic 10-minute idle detection and "waiting" SMS
- **Token Auto-Refresh**: Automatic JWT refresh before 36-hour expiry
- **Browser-Based OAuth**: MCP server for OAuth callback (requires local server)
- **Local Rate Limiting**: Client-side SMS cooldown (currently server-side only)
- **Environment Configuration**: Config options for intervals and log levels
- **Logging System**: File-based debug logs

These features are documented in the codebase's `REMEDIATION_PLAN.md` and will be implemented in future versions.

### 📊 Implementation Details

**Current Architecture**:
- Pure Bash scripts (no TypeScript/Node.js required)
- Background heartbeat daemon (30-second keep-alive pings)
- Hook-based event detection (reactive, not polling)
- Stateless client (server manages rate limiting and session state)
- Config stored in `~/.config/claude-sms-notifier/`

**Hybrid Approach**:
The implementation combines background processes with event hooks:
- ✅ **Background daemon** for continuous heartbeat (keeps session alive)
- ✅ **Event hooks** for instant error/completion detection (no polling delay)
- ✅ **Automatic cleanup** when session ends (daemon stops automatically)
- ✅ **Lightweight** single bash process (~1-2MB RAM)
- ⚠️ **Inactivity detection** not yet implemented (requires monitoring user activity)

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| **Rate limit hit** | Server blocks SMS. Plugin receives 200 OK, no error shown to user. |
| **Auth token expires** | User must re-run `/sms-setup`. Old sessions automatically expire. |
| **Server down** | Plugin fails gracefully. Hooks exit with status 0 (no Claude interruption). |
| **Claude crashes** | Session file remains. Restart `/sms-start` to create new session. |
| **Multiple `/sms-start`** | Currently creates new session (old one orphaned on server). |
| **Invalid pairing code** | Exchange fails with clear error message. |
| **Network blip** | Hooks fire but curl may fail silently (non-blocking). |

---

## Security Considerations

- **JWT Tokens**: Short-lived (36h), stored with 0o600 permissions
- **Session Tokens**: Per-session, invalidated on stop
- **Phone Masking**: Displayed as `+1***8912` in logs/UI
- **No Twilio keys in plugin**: All SMS logic on your server
- **HTTPS only**: Auth server must use TLS
- **State validation**: OAuth `state` param prevents CSRF

---

## Future: Monitoring Dashboard

The Neon DB schema supports a future web dashboard:

```sql
-- View all your sessions
SELECT * FROM sessions WHERE user_phone = '+1234567890';

-- SMS history
SELECT * FROM sms_events WHERE session_id = 123;

-- Stats
SELECT 
  COUNT(*) as total_sessions,
  SUM(sms_sent_count) as total_sms,
  AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration
FROM sessions 
WHERE user_phone = '+1234567890';
```

WebSocket endpoint planned for real-time session view.

---

## Development

```bash
# Install dependencies
bun install

# Run type checks
bun run typecheck

# Run linter
bun run lint

# Run tests
bun run test

# Run with coverage
bun run test:coverage

# Build
bun run build
```

---

## License

MIT

---

## Support

Issues? Feature requests? Open an issue on GitHub or contact jeremy@example.com

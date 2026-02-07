# Claude SMS Notifier

Get SMS notifications when Claude Code needs your attention, finishes work, or hits errors. Perfect for remote/long-running sessions.

## Requirements

- Node.js ≥18.0.0
- Claude Code CLI
- SMS server implementing the API spec (see `docs/api-spec.md`)

## Quick Start

### Option 1: One Command (Recommended)

```bash
npx tocsin-claude-plugin
```

This will:
1. ✅ Copy plugin files to `~/.claude/plugins/`
2. ✅ Install the plugin in Claude Code
3. ✅ Guide you through SMS setup

Then in Claude Code:
```
/sms-login +1234567890
/sms-pair 123456
/sms-start "Fixing production bug"
```

### Option 2: Manual Installation

```bash
# 1. Set your SMS server URL
export CLAUDE_SMS_SERVER_URL="https://sms.yourserver.com"

# 2. Clone and install
git clone https://github.com/SquidCorp/tocsin_claude_plugin.git
cd tocsin_claude_plugin
npm install
claude plugin install .

# 3. In Claude Code, authenticate
/sms-login +1234567890
# (sends SMS with pairing code)

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

1. **Setup** (`/sms-login`)

   - User provides phone number
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
   - **Claude waits for input** → Idle hook fires → "Waiting" SMS sent (if not rate limited)
   - **Session ends** → Hook fires → Cleanup and final notification

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
tocsin/
├── commands/               # User-facing commands
│   ├── sms-login.md       # /sms-login
│   ├── sms-pair.md        # /sms-pair
│   ├── sms-start.md       # /sms-start
│   ├── sms-stop.md        # /sms-stop
│   ├── sms-status.md      # /sms-status
│   └── sms-logout.md      # /sms-logout
├── hooks/
│   └── hooks.json         # Event registrations
├── scripts/               # Node.js implementations
│   ├── sms-login.js       # Authentication flow
│   ├── sms-pair.js        # Token exchange
│   ├── sms-start.js       # Session start + server sync
│   ├── sms-stop.js        # Session end
│   ├── sms-status.js      # Session status check
│   ├── sms-logout.js      # Revoke auth
│   ├── handle-error.js    # PostToolUseFailure hook
│   ├── handle-activity.js # UserPromptSubmit hook
│   ├── handle-idle.js     # Notification hook (idle detection)
│   ├── handle-session-end.js # SessionEnd hook
│   ├── heartbeat-daemon.js # Background heartbeat process
│   └── lib/               # Shared utilities
│       ├── api.js         # HTTP API client
│       ├── config.js      # Configuration and constants
│       ├── files.js       # File I/O helpers
│       └── stdin.js       # Hook input reader
├── .claude-plugin/        # Plugin metadata
│   ├── plugin.json        # Plugin manifest
│   └── marketplace.json   # Marketplace metadata
└── package.json           # Node.js dependencies
```

### Data Flow

**Authentication Flow:**

```
User: /sms-login +1234567890
  ▼
Plugin generates state (UUID)
  ▼
Plugin POST /login (phone, state, mode: "remote")
  ▼
Server sends SMS with 6-digit pairing code
  ▼
Server returns temp_token
  ▼
User receives SMS with code
  ▼
User: /sms-pair 123456
  ▼
Plugin POST /auth/exchange (temp_token, pairing_code)
  ▼
Server validates and returns JWT (36h expiry)
  ▼
Plugin stores token in ~/.config/tocsin/auth.json (600 perms)
```

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
  ├─ UserPromptSubmit ────▶ Send heartbeat
  ├─ Notification (idle) ─▶ Report waiting ──▶ SMS
  └─ SessionEnd ──────────▶ Cleanup + notify server
```

---

## Server API Contract

Your server must implement these endpoints:

### Authentication

| Endpoint         | Method | Description                                |
| ---------------- | ------ | ------------------------------------------ |
| `/login`         | GET    | OAuth entry, accepts `callback_uri` param  |
| `/auth/exchange` | POST   | Exchange temp_token + pairing_code for JWT |
| `/auth/refresh`  | POST   | Refresh JWT before expiry                  |
| `/auth/logout`   | POST   | Revoke token                               |

### Session Management

| Endpoint                   | Method | Description                                |
| -------------------------- | ------ | ------------------------------------------ |
| `/sessions/start`          | POST   | Register new session, return session_token |
| `/sessions/{id}/events`    | POST   | Report event (error/done/waiting)          |
| `/sessions/{id}/heartbeat` | POST   | Keep-alive ping                            |
| `/sessions/{id}/stop`      | POST   | End monitoring                             |

See `docs/api-spec.md` for complete request/response schemas.

---

## Configuration

### Environment Variables (Plugin)

```bash
# Required
CLAUDE_SMS_SERVER_URL=https://sms.yourserver.com  # Default: http://localhost:3000

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

| Command             | Purpose          | When to Use                                |
| ------------------- | ---------------- | ------------------------------------------ |
| `/sms-login`        | Start auth flow  | First time, or token expired (36h)         |
| `/sms-pair 123456`  | Complete auth    | After receiving SMS code                   |
| `/sms-start "desc"` | Start monitoring | Beginning of focused work session          |
| `/sms-stop`         | Stop monitoring  | Done early, don't want more SMS            |
| `/sms-status`       | Check status     | See active session, heartbeat daemon state |
| `/sms-logout`       | Revoke auth      | Switch phone, uninstall, security          |

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
```

---

## Current Implementation Status

### ✅ What Works Now

- **Authentication**: SMS-based authentication with phone number via `/sms-login` and `/sms-pair`
- **Session Management**: Create/stop monitoring sessions with server sync
- **Background Heartbeat**: Daemon process that sends keep-alive pings every 30 seconds
- **Event Hooks**: Four hooks that trigger on Claude Code events
  - `PostToolUseFailure` - Detects blocking errors and sends SMS
  - `UserPromptSubmit` - Sends heartbeat when user sends messages
  - `Notification` (idle_prompt) - Detects when Claude is waiting for user response
  - `SessionEnd` - Notifies when Claude session ends and cleans up
- **Node.js Implementation**: All scripts migrated from Bash to Node.js (ES modules)
- **Server Integration**: Full API integration for session tracking and event reporting
- **Error Filtering**: Only sends SMS for blocking errors (not file-not-found, syntax errors, etc.)
- **Idle Detection**: Automatic SMS when Claude is waiting for user input
- **Security**: Proper token storage (600 permissions), HTTPS-only, separate session tokens

### 🚧 Planned Features (Not Yet Implemented)

The following features are **planned but not yet available**:

- **Token Auto-Refresh**: Automatic JWT refresh before 36-hour expiry
- **Browser-Based OAuth**: Alternative to SMS-based login (requires MCP server)
- **Local Rate Limiting**: Client-side SMS cooldown (currently server-side only)
- **Advanced Configuration**: User-customizable intervals and thresholds
- **Structured Logging**: File-based debug logs with rotation

### ✨ Recently Implemented

- ✅ **Idle Detection** - Now working via Notification hook
- ✅ **Node.js Migration** - All Bash scripts converted to JavaScript
- ✅ **Heartbeat Daemon** - Background process for session keep-alive
- ✅ **Hook-based Architecture** - Event-driven notification system

### 📊 Implementation Details

**Current Architecture**:

- Node.js scripts (ES modules, requires Node.js ≥18)
- Background heartbeat daemon (30-second keep-alive pings)
- Hook-based event detection (reactive, not polling)
- Stateless client (server manages rate limiting and session state)
- Config stored in `~/.config/tocsin/`

**Hybrid Approach**:
The implementation combines background processes with event hooks:

- ✅ **Background daemon** for continuous heartbeat (keeps session alive)
- ✅ **Event hooks** for instant error/idle/completion detection (no polling delay)
- ✅ **Automatic cleanup** when session ends (daemon stops automatically)
- ✅ **Lightweight** single Node.js process (~10-15MB RAM)
- ✅ **Idle detection** via Claude Code's Notification hook
- ✅ **stdin-based hook data** following official Claude Code patterns

---

## Edge Cases Handled

| Scenario                  | Behavior                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| **Rate limit hit**        | Server blocks SMS. Plugin receives 200 OK, no error shown to user.          |
| **Auth token expires**    | User must re-run `/sms-login`. Old sessions automatically expire.           |
| **Server down**           | Plugin fails gracefully. Hooks exit with status 0 (no Claude interruption). |
| **Claude crashes**        | Session file remains. Restart `/sms-start` to create new session.           |
| **Multiple `/sms-start`** | Currently creates new session (old one orphaned on server).                 |
| **Invalid pairing code**  | Exchange fails with clear error message.                                    |
| **Network blip**          | Hooks fire but curl may fail silently (non-blocking).                       |

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

### Prerequisites

- Node.js ≥18.0.0
- npm (comes with Node.js)

### Setup

```bash
# Install dependencies
npm install

# Make scripts executable (if needed)
chmod +x scripts/*.js
```

### Testing

```bash
# Install plugin locally for testing
claude plugin install /path/to/tocsin_claude_plugin

# Test in Claude Code
/sms-login +1234567890
/sms-pair 123456
/sms-start "Test session"
/sms-status
/sms-stop

# Check state files
cat ~/.config/tocsin/auth.json
cat ~/.config/tocsin/session.json

# Debug mode
claude --debug  # See hook execution in real-time
```

---

## License

MIT

---

## Support

Issues? Feature requests? Open an issue on GitHub or contact jeremy@example.com

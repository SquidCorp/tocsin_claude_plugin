# Claude SMS Notifier

Get SMS notifications when Claude Code needs your attention, finishes work, or hits errors. Perfect for remote/long-running sessions.

## Quick Start

```bash
# 1. Set your auth server URL
export CLAUDE_SMS_AUTH_URL="https://auth.yourserver.com"

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
   - Plugin starts:
     - **Heartbeat** every 30 seconds (keeps session alive)
     - **Inactivity timer** (10 minutes)
   - Hooks start watching for events

3. **While Working**
   - **User sends message** → Reset inactivity timer
   - **Tool fails** → Hook fires → Report to server → SMS sent (if not rate limited)
   - **10 min silence** → Inactivity timer fires → "Waiting" SMS sent
   - **Session ends** → "Done" SMS sent

4. **Rate Limiting**
   - 1 SMS per 30 minutes **per event type**
   - Error at 14:00 → SMS
   - Error at 14:15 → Blocked (same type, <30min)
   - Done at 14:15 → SMS (different type)

5. **Cleanup** (`/sms-stop` or session end)
   - Stop timers
   - Send final state to server
   - Cleanup temp files

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
├── src/
│   ├── types.ts           # Zod schemas (validation)
│   ├── api-client.ts      # HTTP client to your server
│   ├── auth.ts            # Token management
│   ├── session.ts         # Monitoring logic, timers
│   ├── utils.ts           # Logging, helpers
│   ├── mcp-auth-server.ts # Local OAuth callback server
│   └── handlers/          # Hook implementations
└── .mcp.json              # MCP server config
```

### Data Flow

**Authentication Flow:**
```
User: /sms-setup
  ▼
MCP Server starts (localhost:random)
  ▼
Browser opens: auth.yourserver.com/login?callback=localhost:xyz
  ▼
User enters phone
  ▼
Auth server sends SMS with 6-digit code
  ▼
Auth server redirects to localhost callback with temp_token
  ▼
MCP server captures token, shows "Enter /sms-pair"
  ▼
User: /sms-pair 123456
  ▼
Plugin POST /auth/exchange (temp_token + pairing_code)
  ▼
Server returns JWT (36h expiry)
  ▼
Plugin stores token in ~/.config/claude-sms-notifier/auth.json
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
CLAUDE_SMS_AUTH_URL=https://auth.yourserver.com

# Optional (defaults shown)
CLAUDE_SMS_HEARTBEAT_INTERVAL=30000      # 30 seconds
CLAUDE_SMS_INACTIVITY_THRESHOLD=600000   # 10 minutes
CLAUDE_SMS_LOG_LEVEL=info                # debug|info|warn|error
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
Waiting for input (10 min idle)

Reply STOP to disable
```

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| **Rate limit hit** | SMS skipped, logged. Next different event still sends. |
| **Auth token expires** | User must re-run `/sms-setup`. Old sessions cleaned up. |
| **Server down** | Plugin queues events, retries. SMS may be delayed/lost. |
| **Claude crashes** | Session file persists, monitoring resumes on restart. |
| **Multiple `/sms-start`** | Error: "Session already monitoring. Use /sms-stop first." |
| **Invalid pairing code** | 5 attempts allowed, then temp_token invalidated. |
| **Network blip** | Heartbeat retries. If persistent, session marked stale. |
| **10min activity** | Timer resets on every UserPromptSubmit. Only fires after true idle. |

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

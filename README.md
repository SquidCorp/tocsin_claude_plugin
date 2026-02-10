# Tocsin Claude Plugin

Get SMS notifications when Claude Code needs your attention, finishes work, or hits errors. Perfect for remote and long-running sessions.

## Installation

### Quick Start (Recommended)

```bash
npx tocsin-claude-plugin
```

That's it! The installer will:

1. Verify Claude Code is installed
2. Add the plugin marketplace
3. Install the plugin
4. Show you what to do next

### Manual Installation

If you prefer to install manually:

```bash
# 1. Add the marketplace
claude plugin marketplace add https://github.com/SquidCorp/tocsin_claude_plugin

# 2. Install the plugin
claude plugin install tocsin@SquidCorp-plugins --scope user

# 3. Restart Claude Code
```

## Getting Started

### Initial Setup (One Time)

In Claude Code interactive mode:

```bash
# 1. Start authentication
/tocsin:sms-login +1234567890

# 2. Enter the 6-digit code you receive via SMS
/tocsin:sms-pair 123456
```

### Remote/Batch Mode (After Pairing)

Once your device is paired, you can use Claude in non-interactive mode:

```bash
# Start a remote session with SMS monitoring
# The plugin continues monitoring even after Claude exits
# You'll get SMS notifications for errors, completion, and idle events
claude --print "Working on feature X" 
```

**Why this is useful:**
- 📱 **Leave interactive mode** - No need to stay in Claude Code UI
- 🔄 **Long-running tasks** - Run Claude in background, get SMS alerts
- 📡 **Remote work** - Perfect for SSH sessions, CI/CD, automation
- 📊 **Batch processing** - Process multiple prompts with monitoring enabled

### Interactive Mode (Traditional)

Alternatively, you can stay in interactive mode:

```bash
# Start interactive session with monitoring
/tocsin:sms-start "Working on feature X"

# Do your work...

# Stop monitoring when you're done
/tocsin:sms-unpair
```

## What You'll Get

**Error Notifications** - Get SMS when tools fail or crash:
```
⚠️ Claude: "Fixing Docker build"
Error: npm install failed
```

**Completion Alerts** - Know when Claude finishes a task:
```
✅ Claude: "Refactor auth module"
Completed successfully!
```

**Idle Alerts** - Get notified when Claude is waiting for input:
```
⏳ Claude: "Database migration"
Waiting for your response
```

## Commands

| Command | Purpose |
|---------|---------|
| `/tocsin:sms-login <phone>` | Start authentication with your phone number |
| `/tocsin:sms-pair <code>` | Enter the 6-digit code you receive via SMS |
| `/tocsin:sms-start <description>` | Start monitoring a Claude session |
| `/tocsin:sms-unpair` | Stop monitoring the current session |
| `/tocsin:sms-status` | Check if monitoring is active |
| `/tocsin:sms-logout` | Revoke authentication |

## Features

✅ SMS-based authentication
✅ Real-time error notifications
✅ Task completion alerts
✅ Idle detection
✅ Automatic rate limiting 
✅ Secure token storage
✅ Works with remote/long-running sessions

## Requirements

- Claude Code CLI (install from https://claude.ai/code)
- Node.js ≥18.0.0
- Valid phone number (E.164 format, e.g., +1234567890)

## Troubleshooting

### Plugin not appearing in Claude Code

Try restarting Claude Code after installation. Plugins are auto-discovered on launch.

### SMS not being received

1. Check that monitoring is active: `/tocsin:sms-status`
2. Verify your phone number in E.164 format (e.g., +1234567890)
3. Ensure the SMS server is running and accessible

### Token expired after 36 hours

Re-authenticate with `/tocsin:sms-login` to get a new token.

## Documentation

- **Plugin Repository**: https://github.com/SquidCorp/tocsin_claude_plugin
- **API Spec**: See `docs/api-spec.md` in the repository
- **Developer Guide**: See `CLAUDE.md` in the repository

## License

MIT

## Support

Found a bug or have a feature request? [Open an issue on GitHub](https://github.com/SquidCorp/tocsin_claude_plugin/issues)

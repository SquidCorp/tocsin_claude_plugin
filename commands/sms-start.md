# /sms-start

Start monitoring a Claude session and sync with SMS server.

## Usage

```
/tocsin:sms-start "Description of what you're working on"
```

## What happens

1. Validates authentication
2. Generates unique session ID
3. **Registers session with SMS server** (POST /sessions/start)
4. Saves session data locally for hooks
5. Displays confirmation with monitoring ID

## Example

```
/tocsin:sms-start "Implementing user authentication feature"
```

## Server Sync

This command now syncs your Claude session with the SMS server, enabling:

- Real-time error notifications via SMS
- Session completion alerts
- Idle timeout warnings

The session remains active until you run `/tocsin:sms-stop` or the session expires.

```bash
#!/bin/bash
"${CLAUDE_PLUGIN_ROOT}/scripts/sms-start.js" "$@"
```

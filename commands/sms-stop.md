# /sms-stop

Stop the current monitoring session and notify server.

## Usage

```
/tocsin:sms-stop
```

## What happens

1. Reads active session from local storage
2. **Notifies SMS server** (POST /sessions/:id/stop)
3. Cleans up session file locally
4. Confirms monitoring stopped

## Notes

- If no session is active, displays "No active monitoring session"
- If server is unreachable, still cleans up local session
- Does NOT log you out (use `/sms-logout` for that)

```bash
#!/bin/bash
"${CLAUDE_PLUGIN_ROOT}/scripts/sms-stop.js" "$@"
```

# /sms-status

Check the current status of SMS monitoring, authentication, and heartbeat daemon.

## Usage

```
/sms-status
```

## What it shows

- **Authentication Status**: Whether you're logged in and token expiry
- **Active Session**: Current monitoring session details (ID, description, start time)
- **Heartbeat Daemon**: Whether the background heartbeat process is running
- **Recent Logs**: Last 5 heartbeat log entries

## Example Output

```
🦞 Claude SMS Notifier - Status
================================

🔑 Authentication:
   Phone: +1***8912
   Expires: 2026-02-06T12:34:56Z

📱 Active Session:
   ID: abc123def
   Description: Implementing feature X
   Started: 2026-02-04T10:15:00Z

💓 Heartbeat Daemon:
   Status: Running
   PID: 12345
   Last activity: [2026-02-04 10:45:30] Heartbeat sent (abc123de...)

   Recent logs (last 5):
     [2026-02-04 10:44:30] Heartbeat sent (abc123de...)
     [2026-02-04 10:44:00] Heartbeat sent (abc123de...)
     [2026-02-04 10:43:30] Heartbeat sent (abc123de...)
     [2026-02-04 10:43:00] Heartbeat sent (abc123de...)
     [2026-02-04 10:42:30] Heartbeat sent (abc123de...)

================================
```

```bash
#!/bin/bash
"${CLAUDE_PLUGIN_ROOT}/scripts/sms-status.sh"
```

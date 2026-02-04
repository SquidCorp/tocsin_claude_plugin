# /sms-start

Start monitoring a Claude session for SMS notifications.

## Usage

```
/sms-start "Fixing bug in auth.ts"
```

## Arguments

- `description` - Description of what you're working on (shown in SMS)

```bash
#!/bin/bash
"${CLAUDE_PLUGIN_ROOT}/scripts/sms-start.sh" "$@"
```

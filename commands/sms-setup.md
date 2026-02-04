# /sms-setup

Start the SMS authentication flow.

## Usage

```
/sms-setup
/sms-setup --remote +1234567890
```

## Options

- `--remote <phone>`: Skip browser and send SMS directly (for SSH/headless sessions)

## What happens

**Browser mode (default):**
1. Generates unique setup ID
2. Opens browser to login page
3. You enter phone number
4. Server sends SMS with pairing code
5. Run `/sms-pair CODE` to complete

**Remote mode (`--remote`):**
1. Generates unique setup ID
2. Calls server API directly with your phone number
3. Server sends SMS immediately
4. Run `/sms-pair CODE` when SMS arrives

```bash
#!/bin/bash
"${CLAUDE_PLUGIN_ROOT}/scripts/sms-setup.sh" "$@"
```

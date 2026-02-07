# /sms-login

Start the SMS authentication flow by sending a pairing code to your phone.

## Usage

```
/sms-login +1234567890
```

## Arguments

- `phone`: Your phone number in E.164 format (required)
  - Must include country code with + prefix
  - Example: `+1234567890` for US, `+447911123456` for UK

## What happens

1. Validates phone number format
2. Calls server API directly with your phone number
3. Server sends SMS with 6-digit pairing code
4. Run `/tocsin:sms-pair CODE` when SMS arrives

**Note:** Pairing code expires after 5 minutes.

```bash
#!/bin/bash
"${CLAUDE_PLUGIN_ROOT}/scripts/sms-login.js" "$@"
```

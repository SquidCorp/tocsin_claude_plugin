# /sms-pair

Complete authentication by entering your 6-digit pairing code from SMS.

## Usage

```
/sms-pair <code>
```

## Arguments

- `code` (required) - The 6-digit code you received via SMS

## Example

```
You: /sms-pair 847291
Claude: ✅ Authentication successful!
       Phone: +1***8912
       Expires: 2026-02-03 15:30 UTC
       
       You can now start monitoring sessions with /sms-start
```

## Errors

- "Invalid pairing code" - Code expired or wrong
- "Token expired" - Temporary token expired, restart with `/sms-setup`

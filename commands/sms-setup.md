# /sms-setup

Start the SMS authentication flow. This will:

1. Open your browser to the authentication page
2. Ask for your phone number
3. Send you a 6-digit pairing code via SMS
4. Wait for you to enter the code with `/sms-pair`

## Usage

```
/sms-setup
```

## What happens

After running this command:
1. Your browser opens to the auth server
2. You enter your phone number
3. You receive an SMS with a 6-digit code
4. You run `/sms-pair 123456` (with your actual code)
5. Authentication is complete!

## Authentication lasts

36 hours. After that, you'll need to run `/sms-setup` again.

## Environment Required

- `CLAUDE_SMS_AUTH_URL` - Your auth server URL

## Example

```
You: /sms-setup
Claude: Opening browser for SMS authentication...
       Check your phone for a 6-digit code.
       Then run: /sms-pair 123456
```

# /sms-logout

Revoke authentication and clear all stored credentials.

## Usage

```
/sms-logout
```

## Example

```
You: /sms-logout
Claude: ✅ Logged out successfully
       All sessions cleared: 3
       Your phone number has been unlinked.
```

## What it does

- Revokes the auth token on the server
- Clears local token storage
- Stops any active monitoring

## When to use

- Switching to a different phone number
- Uninstalling the plugin
- Security concerns

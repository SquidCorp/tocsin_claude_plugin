# /sms-start

Start monitoring this Claude session for SMS notifications.

## Usage

```
/sms-start "description"
```

## Arguments

- `description` (optional) - A brief description of what you're working on (max 100 chars)
  - If not provided, uses your first prompt as the description

## What triggers SMS

- **Error**: When a tool fails
- **Done**: When the session ends successfully
- **Waiting**: After 10 minutes of inactivity (Claude waiting for you)

## Rate Limits

- Maximum 1 SMS per 30 minutes per event type
- Different event types don't block each other

## Examples

```
You: /sms-start "Fixing Docker build on prod"
Claude: ✅ SMS monitoring started
       Session: "Fixing Docker build on prod"
       You'll receive SMS notifications for errors, completion, and inactivity.
       
You: /sms-start
Claude: ✅ SMS monitoring started
       Session: "How do I refactor this auth module?"
       (Auto-captured from your first prompt)
```

## Requirements

- Must be authenticated (`/sms-setup` first)
- Only one monitored session at a time per Claude instance

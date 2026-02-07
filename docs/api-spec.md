# Claude SMS Notifier - Server API Specification

## Overview

This document defines the API contract between the Claude Code plugin (`tocsin`) and the external authentication/SMS server.

## Base URL

All endpoints are relative to the auth server base URL (configured via `CLAUDE_SMS_AUTH_URL` env var).

```
https://auth.claude-sms.example.com
```

---

## Endpoints

### 1. Initiate OAuth Flow

**GET** `/login`

Redirects user to authentication page.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `src` | string | Yes | Must be `"claude"` |
| `callback_uri` | string | Yes | Local MCP server callback URL (e.g., `http://localhost:8765/callback`) |
| `state` | string | Yes | Random nonce for CSRF protection |

#### Flow

1. User visits `/login?src=claude&callback_uri=...&state=...`
2. Server renders phone number input form
3. User enters phone number
4. Server generates 6-digit pairing code
5. Server sends SMS with pairing code via Twilio
6. Server redirects to `callback_uri` with temporary token

---

### 2. OAuth Callback (MCP Server Handler)

**GET** `http://localhost:{port}/callback` (MCP Server Endpoint)

Called by auth server after user enters phone number.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `temp_token` | string | Temporary token (expires in 10 minutes) |
| `phone` | string | User's phone number (masked: `+1***5678`) |
| `state` | string | CSRF state nonce (must match) |

#### Response

Plugin shows in Claude:
```
✅ Phone verified: +1***5678
📱 Enter pairing code: _ _ _ _ _ _

Use /sms-pair <code> to complete setup
```

---

### 3. Exchange Pairing Code for Auth Token

**POST** `/auth/exchange`

Exchanges 6-digit pairing code for long-lived JWT.

#### Request Body

```json
{
  "temp_token": "temp_abc123",
  "pairing_code": "123456",
  "device_fingerprint": "claude-workspace-hash"
}
```

#### Response

**200 OK**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 129600,
  "expires_at": "2026-02-03T03:30:00Z",
  "phone": "+1234567890"
}
```

**400 Bad Request** - Invalid pairing code
```json
{
  "error": "invalid_pairing_code",
  "message": "Pairing code expired or invalid"
}
```

**401 Unauthorized** - Temp token expired
```json
{
  "error": "token_expired",
  "message": "Temporary token has expired, please restart authentication"
}
```

---

### 4. Refresh Token

**POST** `/auth/refresh`

Refresh access token before expiration (extends another 36h).

#### Request Headers

```
Authorization: Bearer {access_token}
```

#### Response

**200 OK** - New token issued
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 129600,
  "expires_at": "2026-02-05T03:30:00Z"
}
```

**401 Unauthorized** - Token invalid or expired
```json
{
  "error": "token_expired",
  "message": "Token has expired, please re-authenticate"
}
```

---

### 5. Start Session Monitoring

**POST** `/sessions/start`

Register a new Claude session for SMS monitoring.

#### Request Headers

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

#### Request Body

```json
{
  "claude_session_id": "claude-sess-abc123def456",
  "description": "Fixing Docker build on prod",
  "hostname": "server-prod-01",
  "started_at": "2026-02-01T15:30:00Z"
}
```

#### Response

**200 OK**
```json
{
  "session_token": "sess_token_xyz789",
  "monitoring_id": "mon_abc123",
  "webhook_url": "https://api.claude-sms.example.com/webhook/mon_abc123"
}
```

---

### 6. Report Session Event

**POST** `/sessions/{monitoring_id}/events`

Report an event (error, done, waiting) from the plugin.

#### Request Headers

```
Authorization: Bearer {session_token}
Content-Type: application/json
```

#### Request Body

```json
{
  "event_type": "error" | "done" | "waiting",
  "timestamp": "2026-02-01T15:45:00Z",
  "details": {
    "tool_name": "docker build",
    "error_message": "Dockerfile syntax error at line 23"
  }
}
```

#### Response

**200 OK** - SMS queued
```json
{
  "sms_sent": true,
  "sms_id": "sms_abc123",
  "rate_limited": false,
  "next_allowed_at": null
}
```

**429 Too Many Requests** - Rate limited
```json
{
  "sms_sent": false,
  "rate_limited": true,
  "next_allowed_at": "2026-02-01T16:15:00Z",
  "retry_after": 1800
}
```

---

### 7. Heartbeat (Keep-Alive)

**POST** `/sessions/{monitoring_id}/heartbeat`

Sent periodically to keep session alive and prevent false "waiting" SMS.

#### Request Headers

```
Authorization: Bearer {session_token}
```

#### Request Body

```json
{
  "timestamp": "2026-02-01T15:50:00Z",
  "last_activity": "2026-02-01T15:45:00Z"
}
```

#### Response

**200 OK**
```json
{
  "status": "active",
  "monitoring": true
}
```

---

### 8. Stop Session Monitoring

**POST** `/sessions/{monitoring_id}/stop`

End monitoring for this session.

#### Request Headers

```
Authorization: Bearer {session_token}
```

#### Request Body

```json
{
  "reason": "completed" | "user_stop" | "error",
  "final_state": "success" | "error" | "cancelled",
  "ended_at": "2026-02-01T16:00:00Z"
}
```

#### Response

**200 OK**
```json
{
  "stopped": true,
  "session_summary": {
    "duration_seconds": 1800,
    "sms_sent": 3,
    "errors_encountered": 1
  }
}
```

---

### 9. Logout / Revoke Token

**POST** `/auth/logout`

Revoke access token and clear all sessions.

#### Request Headers

```
Authorization: Bearer {access_token}
```

#### Response

**200 OK**
```json
{
  "revoked": true,
  "sessions_cleared": 5
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "error_code",
  "message": "Human readable description",
  "details": {},
  "request_id": "req_abc123"
}
```

Common error codes:
- `unauthorized` - Invalid or missing token
- `token_expired` - Token has expired
- `rate_limited` - Too many requests
- `invalid_request` - Malformed request body
- `session_not_found` - Monitoring ID doesn't exist
- `server_error` - Internal server error

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/exchange` | 5 attempts per temp token |
| `/sessions/{id}/events` | 1 per 30 min per event type (enforced server-side) |
| All other endpoints | 100 requests per minute per IP |

---

## Security Considerations

1. **HTTPS Only** - All endpoints must use TLS
2. **State Validation** - OAuth `state` parameter prevents CSRF
3. **Token Storage** - Access tokens stored in OS keychain when available
4. **Phone Masking** - Phone numbers masked in logs and UI
5. **Token Binding** - Tokens include device fingerprint

---

## Environment Variables (Plugin Side)

```bash
# Required
CLAUDE_SMS_AUTH_URL=https://auth.claude-sms.example.com

# Optional (with defaults)
CLAUDE_SMS_HEARTBEAT_INTERVAL=30000  # 30 seconds
CLAUDE_SMS_INACTIVITY_THRESHOLD=600000  # 10 minutes
```

---

## SMS Message Templates

Server renders SMS using these templates:

### Error
```
⚠️ Claude: "{description}"
Error: {brief_error}

Reply STOP to disable
```

### Done (Success)
```
✅ Claude: "{description}"
Completed successfully!

Reply STOP to disable
```

### Waiting (Inactive)
```
⏳ Claude: "{description}"
Waiting for input (10 min idle)

Reply STOP to disable
```

---

## Future: Monitoring Dashboard API

For the future dashboard feature, these endpoints will be added:

### List User Sessions
**GET** `/dashboard/sessions`

Returns all sessions for authenticated user.

### Get Session Details
**GET** `/dashboard/sessions/{id}`

Returns full timeline of session events.

### Real-time Updates
**WS** `/dashboard/ws`

WebSocket for live session updates.

---

*Version: 1.0.0*
*Last updated: 2026-02-01*

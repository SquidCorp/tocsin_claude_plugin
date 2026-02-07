# Claude SMS Server API - Agent Reference

Instructions for AI agents integrating with the Claude SMS Server API for phone-based authentication and SMS notifications.

## Agent Instructions

When working with this API, follow these rules:

1. **Always validate** phone numbers before submission (E.164 format required)
2. **Use polling flow** for CLI/terminal applications (callback flow for web)
3. **Handle rate limits** gracefully - wait the specified retry period
4. **Store tokens securely** - never log or expose session tokens
5. **Clean up sessions** - always stop sessions when tasks complete
6. **Respect SMS limits** - debounce event reports to avoid spam

## API Capabilities

- Phone-based authentication (SMS pairing codes)
- Session management (start, monitor, stop sessions)
- Event reporting (triggers SMS notifications)
- Rate limiting (prevents abuse)
- Token-based authentication (7-day expiry)

## Task: Authenticate User

**When to use:** User needs to authenticate with phone number

**Prerequisites:**
- Valid E.164 phone number
- SMS delivery configured (Twilio)

**Decision:** Use polling flow (CLI) or callback flow (web)

### Polling Flow (CLI) - RECOMMENDED

```typescript
// Step 1: Generate setup ID
const setupId = `setup_${Date.now()}_${crypto.randomUUID()}`;

// Step 2: Submit phone number
const response = await fetch(`${BASE_URL}/login/submit-with-setup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: phone,  // Must be E.164 format
    setup_id: setupId
  })
});

// Step 3: Handle response
if (response.status === 429) {
  // Rate limited - extract retry seconds from message
  const { message } = await response.json();
  const retrySeconds = parseInt(message.match(/(\d+) seconds/)?.[1] || '600');
  // Wait retrySeconds before retrying
  throw new Error(`Rate limited. Retry in ${retrySeconds}s`);
}

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

// Step 4: Prompt user for code
// Display: "Check your phone for the 6-digit SMS code"
const pairingCode = await getUserInput();  // Agent must prompt user

// Step 5: Exchange for token
const authResponse = await fetch(`${BASE_URL}/auth/exchange-by-setup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    setup_id: setupId,
    pairing_code: pairingCode
  })
});

if (!authResponse.ok) {
  const error = await authResponse.json();
  if (authResponse.status === 401) {
    throw new Error('Setup expired. Restart authentication.');
  }
  if (authResponse.status === 400) {
    throw new Error('Invalid pairing code. Try again.');
  }
  throw new Error(error.message);
}

const { access_token, user_id, expires_at } = await authResponse.json();

// Step 6: Store token securely (DO NOT LOG)
// Store: access_token, user_id, expires_at
```

### Callback Flow (Web Only)

```typescript
// Step 1: Submit phone with callback URI
const response = await fetch(`${BASE_URL}/login/submit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: phone,  // E.164 format
    callback_uri: callbackUrl,
    state: crypto.randomUUID()  // CSRF protection
  })
});

const { redirect_to } = await response.json();

// Step 2: Extract temp_token from redirect_to URL
const url = new URL(redirect_to);
const tempToken = url.searchParams.get('temp_token');

// Step 3: User enters code, then exchange
const authResponse = await fetch(`${BASE_URL}/auth/exchange`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    temp_token: tempToken,
    pairing_code: userCode
  })
});

const { access_token, user_id, expires_at } = await authResponse.json();
```

## Task: Start Monitoring Session

**When to use:** Starting a long-running task that should send SMS notifications

**Prerequisites:**
- Valid access_token from authentication
- Task description (max 100 characters)

**Steps:**

```typescript
const response = await fetch(`${BASE_URL}/sessions/start`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    claude_session_id: `session_${Date.now()}`,
    description: taskDescription,  // Max 100 chars
    hostname: os.hostname(),
    started_at: new Date().toISOString()
  })
});

if (response.status === 401) {
  throw new Error('Token expired. Re-authenticate required.');
}

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const { session_token, monitoring_id } = await response.json();

// Store monitoring_id and session_token for event reporting
// Use session_token for all session-related operations
```

## Task: Report Session Event (Send SMS)

**When to use:** Task error occurred, task completed, or waiting for user input

**Prerequisites:**
- Active session (monitoring_id and session_token from start session)
- Event type decision made

**Event Types:**
- `error` - Task encountered an error (triggers error SMS)
- `done` - Task completed successfully (triggers completion SMS)
- `waiting` - Task waiting for user input (triggers waiting SMS)

**Rate Limit:** 1 SMS per event type per 30 minutes per session

**Steps:**

```typescript
const response = await fetch(`${BASE_URL}/sessions/${monitoring_id}/events`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session_token}`
  },
  body: JSON.stringify({
    event_type: eventType,  // 'error' | 'done' | 'waiting'
    timestamp: new Date().toISOString(),
    details: eventDetails  // Optional metadata object
  })
});

if (response.status === 404) {
  throw new Error('Session not found or expired');
}

if (response.status === 401) {
  throw new Error('Session token invalid');
}

const result = await response.json();

if (result.rate_limited) {
  // SMS not sent due to rate limit
  // Continue execution - don't fail
  const nextAllowed = result.next_allowed_at;
  // Log: SMS rate limited, next allowed at ${nextAllowed}
} else {
  // SMS sent successfully
  const smsSent = result.sms_sent;
  const smsId = result.sms_id;
}
```

**Examples:**

```typescript
// Report error
await reportEvent('error', {
  error: error.message,
  stack: error.stack?.substring(0, 200),
  file: currentFile
});

// Report completion
await reportEvent('done', {
  result: 'success',
  files_modified: 5,
  duration_ms: 1234
});

// Report waiting
await reportEvent('waiting', {
  reason: 'user_approval_required',
  action: 'review_changes'
});
```

## Task: Send Heartbeat

**When to use:** During long-running tasks (every 5 minutes)

**Prerequisites:**
- Active session (monitoring_id and session_token)

**Steps:**

```typescript
const response = await fetch(`${BASE_URL}/sessions/${monitoring_id}/heartbeat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session_token}`
  },
  body: JSON.stringify({
    timestamp: new Date().toISOString(),
    last_activity: new Date().toISOString()
  })
});

if (response.status === 404) {
  // Session expired - stop task or restart session
  throw new Error('Session expired');
}

// Continue task
```

## Task: Stop Session

**When to use:** Task completed, failed, or cancelled

**Prerequisites:**
- Active session (monitoring_id and session_token)

**Steps:**

```typescript
const response = await fetch(`${BASE_URL}/sessions/${monitoring_id}/stop`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session_token}`
  },
  body: JSON.stringify({
    reason: reason,  // 'completed' | 'user_stop' | 'error'
    final_state: finalState,  // 'success' | 'error' | 'cancelled'
    ended_at: new Date().toISOString()
  })
});

if (!response.ok) {
  // Log error but don't fail - session may already be stopped
}

const { stopped, session_summary } = await response.json();
// Session cleanup complete
```

## Decision Trees

### When to Send SMS Events

```
Task State Check:
├─ Task errored?
│  └─ Send 'error' event (details: error message, stack)
├─ Task completed successfully?
│  └─ Send 'done' event (details: result summary)
├─ Task waiting for user input?
│  └─ Send 'waiting' event (details: what's needed)
└─ Task still running?
   └─ Send heartbeat (every 5 minutes)
```

### Token Validity Check

```
Before API Call:
├─ Token exists?
│  ├─ No → Start authentication flow
│  └─ Yes → Check expiry
│     ├─ Expired → Re-authenticate
│     └─ Valid → Use token
└─ After API Call:
   └─ Status 401?
      └─ Re-authenticate and retry
```

### Error Response Handling

```
HTTP Status:
├─ 400 Bad Request
│  └─ Invalid input - check phone format, required fields
├─ 401 Unauthorized
│  └─ Token expired/invalid - re-authenticate
├─ 404 Not Found
│  └─ Session expired - start new session
├─ 429 Too Many Requests
│  └─ Extract retry seconds from message, wait, then retry
└─ 500 Internal Server Error
   └─ Retry with exponential backoff (max 3 attempts)
```

## Agent Implementation Patterns

### Pattern 1: Complete Task with Monitoring

**Use this pattern for any long-running task that should send SMS updates.**

```typescript
async function executeMonitoredTask(
  taskFn: () => Promise<any>,
  description: string,
  accessToken: string
) {
  let monitoringId: string | null = null;
  let sessionToken: string | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  try {
    // Start session
    const startResponse = await fetch(`${BASE_URL}/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        claude_session_id: `session_${Date.now()}`,
        description: description.substring(0, 100),
        hostname: os.hostname(),
        started_at: new Date().toISOString()
      })
    });

    const sessionData = await startResponse.json();
    monitoringId = sessionData.monitoring_id;
    sessionToken = sessionData.session_token;

    // Start heartbeat (every 5 minutes)
    heartbeatInterval = setInterval(async () => {
      try {
        await fetch(`${BASE_URL}/sessions/${monitoringId}/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            last_activity: new Date().toISOString()
          })
        });
      } catch (err) {
        // Log but don't fail task
      }
    }, 5 * 60 * 1000);

    // Execute task
    const result = await taskFn();

    // Report success
    await fetch(`${BASE_URL}/sessions/${monitoringId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        event_type: 'done',
        timestamp: new Date().toISOString(),
        details: { result: 'success' }
      })
    });

    return result;

  } catch (error) {
    // Report error
    if (monitoringId && sessionToken) {
      await fetch(`${BASE_URL}/sessions/${monitoringId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          event_type: 'error',
          timestamp: new Date().toISOString(),
          details: {
            error: error.message,
            stack: error.stack?.substring(0, 200)
          }
        })
      });
    }
    throw error;

  } finally {
    // Cleanup
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    if (monitoringId && sessionToken) {
      await fetch(`${BASE_URL}/sessions/${monitoringId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          reason: 'completed',
          final_state: error ? 'error' : 'success',
          ended_at: new Date().toISOString()
        })
      }).catch(() => {}); // Ignore stop errors
    }
  }
}

// Usage
await executeMonitoredTask(
  async () => {
    // Your task logic here
    await buildProject();
    return { success: true };
  },
  'Building project',
  accessToken
);
```

### Pattern 2: Phone Number Validation

**Always validate phone numbers before submitting to API.**

```typescript
function validatePhoneNumber(input: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = input.replace(/[^\d+]/g, '');

  // Add + if missing
  if (!cleaned.startsWith('+')) {
    // Assume US/Canada if no country code
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else {
      throw new Error('Invalid phone number. Use format: +1234567890');
    }
  }

  // Validate E.164 format: + followed by 1-15 digits
  if (!/^\+[1-9]\d{1,14}$/.test(cleaned)) {
    throw new Error('Invalid phone number. Use E.164 format: +[country][number]');
  }

  return cleaned;
}

// Usage
const phone = validatePhoneNumber(userInput);  // '+14155551234'
```

### Pattern 3: Token Storage and Retrieval

**Store tokens securely. Never log or expose tokens.**

```typescript
interface TokenData {
  access_token: string;
  user_id: string;
  expires_at: string;
}

// Store token (implementation depends on environment)
async function storeToken(data: TokenData): Promise<void> {
  // Option 1: Environment variable (CLI)
  process.env.CLAUDE_SMS_TOKEN = JSON.stringify(data);

  // Option 2: File system (encrypted)
  const encrypted = encrypt(JSON.stringify(data));
  await fs.writeFile('~/.claude-sms-token', encrypted);

  // Option 3: Keychain (macOS/Linux)
  // await keytar.setPassword('claude-sms', data.user_id, data.access_token);
}

// Load token
async function loadToken(): Promise<TokenData | null> {
  try {
    // Load from storage
    const data = JSON.parse(process.env.CLAUDE_SMS_TOKEN || '{}');

    // Validate expiry
    if (new Date(data.expires_at) < new Date()) {
      return null; // Expired
    }

    return data;
  } catch {
    return null;
  }
}

// Use token with auto-refresh
async function getValidToken(): Promise<string> {
  const stored = await loadToken();

  if (!stored) {
    throw new Error('No valid token. Authentication required.');
  }

  return stored.access_token;
}
```

## Error Handling Rules

### HTTP Status Code Actions

```typescript
async function handleApiResponse(response: Response): Promise<any> {
  const status = response.status;

  // Success
  if (status >= 200 && status < 300) {
    return response.json();
  }

  const error = await response.json();

  // Handle specific status codes
  switch (status) {
    case 400: // Bad Request
      // Invalid input - check phone format, required fields
      throw new Error(`Invalid request: ${error.message}`);

    case 401: // Unauthorized
      // Token expired/invalid - re-authentication required
      throw new Error('AUTHENTICATION_REQUIRED');

    case 404: // Not Found
      // Session not found - may need to start new session
      throw new Error('SESSION_NOT_FOUND');

    case 429: // Rate Limited
      // Extract retry seconds from message
      const match = error.message.match(/(\d+) seconds/);
      const retryAfter = match ? parseInt(match[1]) : 600;
      throw new Error(`RATE_LIMITED:${retryAfter}`);

    case 500: // Server Error
      // Retry with backoff
      throw new Error('SERVER_ERROR');

    default:
      throw new Error(`HTTP ${status}: ${error.message}`);
  }
}

// Usage
try {
  const data = await handleApiResponse(response);
} catch (error) {
  if (error.message === 'AUTHENTICATION_REQUIRED') {
    // Re-authenticate
    await authenticateUser();
    // Retry request
  } else if (error.message.startsWith('RATE_LIMITED:')) {
    const seconds = parseInt(error.message.split(':')[1]);
    // Wait and retry
    await sleep(seconds * 1000);
  } else if (error.message === 'SESSION_NOT_FOUND') {
    // Start new session
    await startNewSession();
  }
}
```

### Retry Strategy

**Rule:** Only retry on 500 errors and network failures. DO NOT retry 4xx errors.

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry client errors (4xx)
      if (error.message.includes('AUTHENTICATION_REQUIRED') ||
          error.message.includes('RATE_LIMITED') ||
          error.message.startsWith('Invalid request')) {
        throw error;
      }

      // Last attempt - throw error
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}
```

## Rate Limits Reference

| Operation | Limit | Window | Applies To |
|-----------|-------|--------|-----------|
| SMS delivery | 3 | 10 minutes | Per phone number |
| Pairing code attempts | 5 | 10 minutes | Per temp_token or setup_id |
| Session events | 1 | 30 minutes | Per event type per session |

### Rate Limit Handling

```typescript
async function handleRateLimit(response: Response, operation: () => Promise<Response>): Promise<Response> {
  if (response.status !== 429) {
    return response;
  }

  const error = await response.json();

  // Extract retry seconds from message
  // Format: "Rate limit exceeded. Try again in 472 seconds"
  const match = error.message.match(/(\d+) seconds/);
  const retrySeconds = match ? parseInt(match[1]) : 600; // Default 10 min

  // Log rate limit
  console.error(`Rate limited. Waiting ${retrySeconds}s before retry.`);

  // Wait specified duration
  await new Promise(resolve => setTimeout(resolve, retrySeconds * 1000));

  // Retry operation
  return await operation();
}
```

### Event Reporting Rules

**Rule:** Don't spam SMS events. Follow these guidelines:

1. **Debounce rapid events** - Wait at least 30 seconds between same event types
2. **Only report significant events** - Not every minor status change
3. **Respect rate limits** - 1 SMS per event type per 30 minutes
4. **Use different event types** - `error`, `done`, `waiting` have independent limits

```typescript
class EventDebouncer {
  private lastEventTime: Map<string, number> = new Map();
  private readonly debounceMs = 30000; // 30 seconds

  shouldReport(eventType: string): boolean {
    const now = Date.now();
    const lastTime = this.lastEventTime.get(eventType) || 0;

    if (now - lastTime < this.debounceMs) {
      return false; // Too soon, skip
    }

    this.lastEventTime.set(eventType, now);
    return true;
  }
}

const debouncer = new EventDebouncer();

// Only report if debounced
if (debouncer.shouldReport('error')) {
  await reportEvent('error', errorDetails);
}
```

## Security Rules

### CRITICAL: Never Log or Expose

1. **Session tokens** - Never log `access_token` or `session_token`
2. **Pairing codes** - Never log the 6-digit SMS code
3. **Full phone numbers** - Only log masked format `+1415***1234`
4. **Temp tokens** - Never log `temp_token` values

### Secure Storage Requirements

```typescript
// DO: Store tokens in secure storage
await keytar.setPassword('claude-sms', userId, accessToken);

// DON'T: Store tokens in plain text
fs.writeFileSync('token.txt', accessToken); // NEVER DO THIS

// DO: Mask phone numbers in logs
console.log(`Auth for ${phone.substring(0, 4)}***${phone.slice(-4)}`);

// DON'T: Log full phone numbers
console.log(`Auth for ${phone}`); // NEVER DO THIS
```

## Configuration

### Required Environment Variables

```bash
# Base URL (set by deployment environment)
CLAUDE_SMS_BASE_URL=http://localhost:3000  # Development
CLAUDE_SMS_BASE_URL=https://api.example.com  # Production
```

### Optional Configuration

```typescript
interface Config {
  baseUrl: string;
  heartbeatIntervalMs: number;  // Default: 300000 (5 minutes)
  eventDebounceMs: number;      // Default: 30000 (30 seconds)
  maxRetries: number;            // Default: 3
}

const config: Config = {
  baseUrl: process.env.CLAUDE_SMS_BASE_URL || 'http://localhost:3000',
  heartbeatIntervalMs: 5 * 60 * 1000,
  eventDebounceMs: 30 * 1000,
  maxRetries: 3
};
```

## Quick Reference

### Endpoint Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | No | Health check |
| `/login/submit-with-setup` | POST | No | Request SMS code (polling) |
| `/auth/exchange-by-setup` | POST | No | Exchange code for token (polling) |
| `/sessions/start` | POST | Yes | Start monitoring session |
| `/sessions/:id/events` | POST | Yes | Report event (sends SMS) |
| `/sessions/:id/heartbeat` | POST | Yes | Keep session alive |
| `/sessions/:id/stop` | POST | Yes | End session |

### Data Types

```typescript
// Authentication Response
interface AuthResponse {
  access_token: string;      // Use for subsequent requests
  user_id: string;           // UUID
  expires_at: string;        // ISO 8601 timestamp
  token_type: "Bearer";
  expires_in: 604800;        // 7 days in seconds
}

// Start Session Response
interface StartSessionResponse {
  session_token: string;     // Use for session operations
  monitoring_id: string;     // Use in session URLs
}

// Event Types
type EventType = 'error' | 'done' | 'waiting';

// Stop Reasons
type StopReason = 'completed' | 'user_stop' | 'error';
type FinalState = 'success' | 'error' | 'cancelled';
```

### Common Mistakes to Avoid

1. ❌ Using callback flow in CLI applications
   ✅ Use polling flow (`/login/submit-with-setup`)

2. ❌ Not handling rate limits (429 responses)
   ✅ Extract retry seconds and wait before retrying

3. ❌ Forgetting to stop sessions
   ✅ Always call `/sessions/:id/stop` in finally block

4. ❌ Logging session tokens
   ✅ Never log sensitive data (tokens, codes, full phone numbers)

5. ❌ Sending events for every minor change
   ✅ Debounce events (30s minimum between same type)

6. ❌ Not validating phone numbers
   ✅ Always validate and convert to E.164 format

7. ❌ Retrying 4xx errors
   ✅ Only retry 500 errors and network failures

8. ❌ Ignoring token expiry
   ✅ Check `expires_at` before each request

## Reference Links

- **Detailed API Reference:** [docs/API.md](./docs/API.md)
- **Server README:** [README.md](./README.md)
- **E.164 Phone Format:** International phone number standard (+[country][number])
- **ISO 8601 Timestamps:** Standard datetime format (YYYY-MM-DDTHH:mm:ss.sssZ)

---

**Document Type:** Agent Reference Guide
**Last Updated:** February 2026
**API Version:** 1.0

# Authentication Error Flow

## Architecture Overview

This document describes how 401 Unauthorized errors are handled consistently across the Tocsin Claude plugin.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         SMS SERVER                              │
│                    (Returns 401 on auth failure)                │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP Request with Bearer token
                              │
                              │ 401 Unauthorized
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      lib/api.js                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  apiRequest(endpoint, options)                            │  │
│  │  ├─ Sends HTTP request                                    │  │
│  │  ├─ Checks response.status                                │  │
│  │  └─ If status === 401:                                    │  │
│  │     throw new AuthenticationError(...)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ throws AuthenticationError
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              CALLING SCRIPTS (10 total)                         │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │     COMMANDS (4)    │  │     HOOKS (5)       │              │
│  │  - sms-start.js     │  │  - handle-error.js  │              │
│  │  - sms-unpair.js    │  │  - handle-activity  │              │
│  │  - sms-login.js     │  │  - handle-idle.js   │              │
│  │  - sms-pair.js      │  │  - handle-completion│              │
│  └─────────────────────┘  │  - handle-session-end│             │
│                           └─────────────────────┘              │
│  ┌─────────────────────┐                                       │
│  │     DAEMON (1)      │                                       │
│  │  - heartbeat-daemon │                                       │
│  └─────────────────────┘                                       │
│                                                                 │
│  All catch blocks:                                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  try {                                                    │  │
│  │    await apiRequest(...)                                  │  │
│  │  } catch (error) {                                        │  │
│  │    if (error instanceof AuthenticationError) {            │  │
│  │      handleAuthenticationError({ ... })                   │  │
│  │      // Commands: exit(1)                                 │  │
│  │      // Hooks: exit(0) - never block                      │  │
│  │      // Daemon: return { fatal: true }                    │  │
│  │    }                                                       │  │
│  │  }                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ calls handleAuthenticationError()
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     lib/auth-utils.js                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  handleAuthenticationError({ silent, context })           │  │
│  │  ├─ Deletes auth.json (automatic logout)                  │  │
│  │  ├─ If !silent: Display user message                      │  │
│  │  └─ Log to console.error for debugging                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ~/.config/tocsin/auth.json                   │
│                         (DELETED)                               │
└─────────────────────────────────────────────────────────────────┘
```

## Flow by Context

### Commands (User-Initiated)

```
User runs command → API call fails with 401
    ↓
apiRequest() throws AuthenticationError
    ↓
Command catches error
    ↓
handleAuthenticationError({ silent: false })
    ↓
├─ Delete auth.json
├─ Display message to user:
│  "⚠️  Authentication Failed
│   Your session has expired or your token is invalid.
│   Please re-authenticate with: /sms-login +1234567890"
└─ Log to console.error
    ↓
Exit with code 1 (error)
```

**User sees**: Clear error message prompting re-authentication

### Hooks (Background Events)

```
Hook fires → API call fails with 401
    ↓
apiRequest() throws AuthenticationError
    ↓
Hook catches error silently
    ↓
handleAuthenticationError({ silent: true, context: 'hook-name' })
    ↓
├─ Delete auth.json
├─ NO user message (silent mode)
└─ Log to console.error
    ↓
Exit with code 0 (success - never block Claude Code)
```

**User sees**: Nothing immediately. Next command will show auth error.

### Daemon (Long-Running Process)

```
Heartbeat sends → API call fails with 401
    ↓
apiRequest() throws AuthenticationError
    ↓
sendHeartbeat() catches error
    ↓
handleAuthenticationError({ silent: true, context: 'heartbeat-daemon' })
    ↓
├─ Delete auth.json
├─ NO user message (silent mode)
└─ Log to console.error
    ↓
Return { success: false, fatal: true }
    ↓
Main loop detects fatal error
    ↓
Daemon exits gracefully (code 1)
```

**User sees**: Nothing immediately. Next command will show auth error.

## File Statistics

- **1** custom error class (`AuthenticationError`)
- **1** centralized handler function (`handleAuthenticationError`)
- **10** scripts updated to use centralized handling:
  - 4 commands
  - 5 hooks
  - 1 daemon

## Benefits

### Before Implementation

- ❌ Fragmented 401 handling (2 files had string-matching checks)
- ❌ 8 files had NO 401 handling at all
- ❌ No automatic logout on auth failure
- ❌ Inconsistent user messages
- ❌ Difficult to maintain and test

### After Implementation

- ✅ Centralized error detection in `api.js`
- ✅ Consistent handling via `auth-utils.js`
- ✅ Automatic logout on 401
- ✅ Clear user messages (commands only)
- ✅ Silent handling for hooks and daemon
- ✅ Type-safe with `instanceof` checks
- ✅ Easy to test and maintain
- ✅ Single source of truth

## Error Message Examples

### Command Error (User-Facing)

```
$ /sms-start "Deploy feature"
🔔 Starting SMS monitoring...
Description: Deploy feature

📡 Syncing with SMS server...

⚠️  Authentication Failed
Your session has expired or your token is invalid.
Please re-authenticate with: /sms-login +1234567890

[2026-02-08T12:34:56.789Z] Authentication error in sms-start, logged out user
```

### Hook Error (Silent)

```
# No user-visible output

# In console.error (for debugging):
[2026-02-08T12:34:56.789Z] Authentication error in handle-error, logged out user
```

### Status Command (Token Expired)

```
$ /sms-status
Tocsin_ - Status
================================

🔑 Authentication:
   Phone: +1234567890
   Expires: 2026-02-06T12:00:00.000Z
   ⚠️  Token expired - run /tocsin:sms-login to re-authenticate

ℹ️  No active session
   Run /tocsin:sms-start "description"

💤 Heartbeat Daemon: Not active

================================
```

## Testing Scenarios

### Scenario 1: Manual Token Expiry

1. Edit `~/.config/tocsin/auth.json`
2. Change `expires_at` to a past date
3. Run `/sms-start "Test"`
4. **Expected**: Auto-logout + error message

### Scenario 2: Token Revoked on Server

1. Start a session with valid token
2. Revoke token on server side
3. Trigger a hook event (error, idle, completion)
4. **Expected**: Silent logout (auth.json deleted)
5. Run `/sms-status`
6. **Expected**: Shows "Not authenticated"

### Scenario 3: Daemon Heartbeat Failure

1. Start session with valid token
2. Expire token manually
3. Wait for heartbeat interval (~30s)
4. **Expected**: Daemon exits gracefully
5. Check `~/.config/tocsin/heartbeat.log`
6. **Expected**: See "Authentication failed" message

### Scenario 4: Token Expiry Detection

1. Run `/sms-status` with expired token
2. **Expected**: Shows warning message
3. Token is NOT deleted (only API 401 triggers logout)
4. User can see when it expired

## Code Patterns

### Pattern 1: API Layer (Detection)

```javascript
// scripts/lib/api.js
if (!response.ok) {
  if (response.status === 401) {
    throw new AuthenticationError('Authentication failed: token expired or invalid', 401);
  }
  // ... other error handling
}
```

### Pattern 2: Utility Layer (Handling)

```javascript
// scripts/lib/auth-utils.js
export function handleAuthenticationError(options = {}) {
  const { silent = false, context = 'unknown' } = options;

  // Delete auth token
  if (fileExists(FILES.AUTH)) {
    deleteFile(FILES.AUTH);
  }

  // Display message (optional)
  if (!silent) {
    console.log('\n⚠️  Authentication Failed');
    console.log('Your session has expired or your token is invalid.');
    console.log('Please re-authenticate with: /sms-login +1234567890');
  }

  // Always log for debugging
  console.error(`[${new Date().toISOString()}] Authentication error in ${context}, logged out user`);
}
```

### Pattern 3: Consumer Layer (Commands)

```javascript
// scripts/sms-start.js
import { AuthenticationError } from './lib/api.js';
import { handleAuthenticationError } from './lib/auth-utils.js';

try {
  await authenticatedRequest('/sessions/start', authToken, { ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    handleAuthenticationError({ context: 'sms-start' });
    process.exit(1);
  }
  // ... other error handling
}
```

### Pattern 4: Consumer Layer (Hooks)

```javascript
// scripts/handle-error.js
import { AuthenticationError } from './lib/api.js';
import { handleAuthenticationError } from './lib/auth-utils.js';

try {
  await apiRequest(`/sessions/${monitoringId}/events`, { ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    handleAuthenticationError({ silent: true, context: 'handle-error' });
  }
  // Always exit 0 - hooks must never block
}

process.exit(0);
```

### Pattern 5: Consumer Layer (Daemon)

```javascript
// scripts/heartbeat-daemon.js
import { AuthenticationError } from './lib/api.js';
import { handleAuthenticationError } from './lib/auth-utils.js';

async function sendHeartbeat() {
  try {
    await apiRequest(`/sessions/${monitoringId}/heartbeat`, { ... });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      handleAuthenticationError({ silent: true, context: 'heartbeat-daemon' });
      return { success: false, fatal: true };
    }
    // ... other error handling
  }
}

// Main loop
const result = await sendHeartbeat();
if (result.fatal) {
  process.exit(1);
}
```

## Maintenance Notes

### Adding New Scripts

When adding new scripts that make API calls:

1. Import `AuthenticationError` from `./lib/api.js`
2. Import `handleAuthenticationError` from `./lib/auth-utils.js`
3. Wrap API calls in try-catch
4. Check `error instanceof AuthenticationError`
5. Call `handleAuthenticationError()` with appropriate options:
   - Commands: `{ context: 'script-name' }` (silent=false by default)
   - Hooks: `{ silent: true, context: 'script-name' }`
   - Daemons: `{ silent: true, context: 'script-name' }` + return fatal flag

### Modifying Error Handling

To change logout behavior:
- Edit `scripts/lib/auth-utils.js`
- All 10 scripts will automatically use new logic

To change error detection:
- Edit `scripts/lib/api.js`
- All 10 scripts will automatically get new detection logic

## Related Documentation

- `CLAUDE.md` - Project overview and development guide
- `CENTRALIZED_401_HANDLING.md` - Implementation summary
- `docs/api-spec.md` - Server API specification
- `AUDIT_REPORT.md` - Security and functionality audit

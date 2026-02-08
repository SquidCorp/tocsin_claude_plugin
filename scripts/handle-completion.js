#!/usr/bin/env node

/**
 * Stop Hook Handler
 *
 * Triggered when Claude finishes responding (not when session ends).
 * Sends completion notification via SMS.
 *
 * Official docs: https://code.claude.com/docs/en/hooks#stop
 */

import { FILES } from './lib/config.js';
import { readJSON, fileExists } from './lib/files.js';
import { apiRequest, AuthenticationError } from './lib/api.js';
import { readStdin } from './lib/stdin.js';
import { handleAuthenticationError } from './lib/auth-utils.js';

(async () => {
  try {
    // Read hook input from stdin (official Claude Code pattern)
    const input = await readStdin();

    // Extract Stop hook fields
    const stopHookActive = input.stop_hook_active || false;
    const sessionId = input.session_id || '';

    // Prevent infinite loops: if stop hook already ran, don't trigger again
    if (stopHookActive) {
      process.exit(0);
    }

    // Check if session file exists
    if (!fileExists(FILES.SESSION)) {
      // No active monitoring session
      process.exit(0);
    }

    // Extract session data
    const session = readJSON(FILES.SESSION);
    const monitoringId = session?.monitoring_id;
    const sessionToken = session?.session_token;

    if (!monitoringId || !sessionToken) {
      process.exit(0);
    }

    const timestamp = new Date().toISOString();

    // Send completion event to server
    try {
      await apiRequest(`/sessions/${monitoringId}/events`, {
        method: 'POST',
        token: sessionToken,
        body: {
          event_type: 'done',
          timestamp: timestamp,
          details: {
            session_id: sessionId,
            message: 'Claude finished responding'
          }
        }
      });
    } catch (error) {
      // Handle authentication errors silently
      if (error instanceof AuthenticationError) {
        handleAuthenticationError({ silent: true, context: 'handle-completion' });
      }
      // Suppress other errors - hooks must not block
    }

    process.exit(0);
  } catch (error) {
    // Suppress all errors - hooks must never block Claude Code
    process.exit(0);
  }
})();

#!/usr/bin/env node

/**
 * PostToolUseFailure Hook Handler
 *
 * Triggered when any tool execution fails.
 * Filters for "blocking" errors and sends SMS notification via server.
 *
 * Official docs: https://code.claude.com/docs/en/hooks#posttoolusefailure
 */

import { FILES, BLOCKING_PATTERNS } from './lib/config.js';
import { readJSON, fileExists } from './lib/files.js';
import { apiRequest, AuthenticationError } from './lib/api.js';
import { readStdin } from './lib/stdin.js';
import { handleAuthenticationError } from './lib/auth-utils.js';

(async () => {
  try {
    // Read hook input from stdin (official Claude Code pattern)
    const input = await readStdin();

    // Extract PostToolUseFailure fields
    const toolName = input.tool_name || 'unknown';
    const error = input.error || '';
    const toolUseId = input.tool_use_id || '';
    const isInterrupt = input.is_interrupt || false;
    const sessionId = input.session_id || '';
    const cwd = input.cwd || '';

    // Early exit if no error
    if (!error) {
      process.exit(0);
    }

    // Skip user-interrupted operations
    if (isInterrupt) {
      process.exit(0);
    }

    // Check if session file exists
    if (!fileExists(FILES.SESSION)) {
      // No active monitoring session, nothing to do
      process.exit(0);
    }

    // Extract session data
    const session = readJSON(FILES.SESSION);
    const monitoringId = session?.monitoring_id;
    const sessionToken = session?.session_token;

    if (!monitoringId || !sessionToken) {
      process.exit(0);
    }

    // Check if this is a blocking error (not file not found, syntax errors, etc.)
    if (!BLOCKING_PATTERNS.test(error)) {
      // Non-blocking error, don't send notification
      process.exit(0);
    }

    const timestamp = new Date().toISOString();

    // Send error event to server (fire and forget - don't block hook)
    try {
      await apiRequest(`/sessions/${monitoringId}/events`, {
        method: 'POST',
        token: sessionToken,
        body: {
          event_type: 'error',
          timestamp: timestamp,
          details: {
            tool_name: toolName,
            tool_use_id: toolUseId,
            error: error.substring(0, 500), // Truncate long errors
            session_id: sessionId,
            cwd: cwd
          }
        }
      });
    } catch (error) {
      // Handle authentication errors silently
      if (error instanceof AuthenticationError) {
        handleAuthenticationError({ silent: true, context: 'handle-error' });
      }
      // Suppress other errors - hooks must not block
    }

    process.exit(0);
  } catch (error) {
    // Suppress all errors - hooks must never block Claude Code
    process.exit(0);
  }
})();

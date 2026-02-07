#!/usr/bin/env node

/**
 * SessionEnd Hook Handler
 *
 * Triggered when Claude Code session terminates (user exits).
 * Cleans up session state and notifies server.
 *
 * Official docs: https://code.claude.com/docs/en/hooks#sessionend
 */

import fs from 'fs';
import { FILES } from './lib/config.js';
import { readJSON, deleteFile, fileExists } from './lib/files.js';
import { apiRequest } from './lib/api.js';
import { readStdin } from './lib/stdin.js';

(async () => {
  try {
    // Read hook input from stdin (official Claude Code pattern)
    const input = await readStdin();

    // Extract SessionEnd fields
    const reason = input.reason || 'unknown';
    const sessionId = input.session_id || '';
    const timestamp = new Date().toISOString();

    // Stop heartbeat daemon if running
    if (fileExists(FILES.HEARTBEAT_PID)) {
      try {
        const pidStr = fs.readFileSync(FILES.HEARTBEAT_PID, 'utf8').trim();
        const pid = parseInt(pidStr, 10);

        // Check if process is running and kill it
        try {
          process.kill(pid, 0); // Check if exists
          process.kill(pid, 'SIGTERM'); // Kill it
        } catch {
          // Process not running
        }
      } catch {
        // Ignore error reading PID file
      }

      deleteFile(FILES.HEARTBEAT_PID);
    }

    // Check if session file exists
    if (!fileExists(FILES.SESSION)) {
      process.exit(0);
    }

    // Extract session data
    const session = readJSON(FILES.SESSION);
    const monitoringId = session?.monitoring_id;
    const sessionToken = session?.session_token;

    if (!monitoringId || !sessionToken) {
      // Clean up orphaned session file
      deleteFile(FILES.SESSION);
      process.exit(0);
    }

    // Determine final state based on reason
    let finalState;
    switch (reason) {
      case 'clear':
      case 'logout':
        finalState = 'success';
        break;
      case 'bypass_permissions_disabled':
      case 'prompt_input_exit':
        finalState = 'interrupted';
        break;
      default:
        finalState = 'success';
        break;
    }

    // Send session stop to server (fire and forget)
    await apiRequest(`/sessions/${monitoringId}/stop`, {
      method: 'POST',
      token: sessionToken,
      body: {
        reason: reason,
        final_state: finalState,
        ended_at: timestamp,
        session_id: sessionId
      }
    }).catch(() => {
      // Suppress errors - cleanup must complete
    });

    // Clean up session file and logs
    deleteFile(FILES.SESSION);
    deleteFile(FILES.HEARTBEAT_LOG);

    process.exit(0);
  } catch (error) {
    // Always cleanup session file even on error
    try {
      deleteFile(FILES.SESSION);
      deleteFile(FILES.HEARTBEAT_LOG);
    } catch {
      // Ignore cleanup errors
    }
    process.exit(0);
  }
})();

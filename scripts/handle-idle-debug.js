#!/usr/bin/env node

/**
 * DEBUG VERSION - Notification Hook Handler
 *
 * This version logs ALL notification types to help debug the immediate SMS issue.
 * Replace handle-idle.js with this temporarily to see what notifications are firing.
 */

import fs from 'fs';
import { FILES } from './lib/config.js';
import { readJSON, fileExists } from './lib/files.js';
import { apiRequest } from './lib/api.js';
import { readStdin } from './lib/stdin.js';

const DEBUG_LOG = '/tmp/claude-notifications-debug.log';

function debugLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(DEBUG_LOG, logMessage);
}

(async () => {
  try {
    const input = await readStdin();

    // Extract Notification fields
    const notificationType = input.notification_type || '';
    const message = input.message || '';
    const title = input.title || '';
    const sessionId = input.session_id || '';

    // LOG EVERYTHING
    debugLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    debugLog(`Notification Hook Fired!`);
    debugLog(`  Type: "${notificationType}"`);
    debugLog(`  Title: "${title}"`);
    debugLog(`  Message: "${message}"`);
    debugLog(`  Session: "${sessionId}"`);
    debugLog(`  Full input: ${JSON.stringify(input, null, 2)}`);

    // Check if this would trigger SMS
    if (notificationType === 'idle_prompt') {
      debugLog(`  ⚠️  THIS WOULD SEND SMS (idle_prompt detected)`);

      // Check if session exists
      if (fileExists(FILES.SESSION)) {
        const session = readJSON(FILES.SESSION);
        debugLog(`  ✓ Session file exists: ${FILES.SESSION}`);
        debugLog(`  ✓ Monitoring ID: ${session?.monitoring_id}`);

        // Actually send the event
        const timestamp = new Date().toISOString();
        await apiRequest(`/sessions/${session.monitoring_id}/events`, {
          method: 'POST',
          token: session.session_token,
          body: {
            event_type: 'waiting',
            timestamp: timestamp,
            details: {
              notification_type: notificationType,
              message: message,
              title: title,
              session_id: sessionId
            }
          }
        }).catch(err => {
          debugLog(`  ✗ API request failed: ${err.message}`);
        });

        debugLog(`  ✓ Sent waiting event to server`);
      } else {
        debugLog(`  ✗ No session file - not sending SMS`);
      }
    } else {
      debugLog(`  ✓ Ignoring (not idle_prompt)`);
    }

    debugLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    process.exit(0);
  } catch (error) {
    debugLog(`ERROR: ${error.message}`);
    process.exit(0);
  }
})();

#!/usr/bin/env node

import fs from 'fs';
import { FILES, HEARTBEAT_INTERVAL } from './lib/config.js';
import { readJSON, writeJSON, fileExists } from './lib/files.js';
import { apiRequest } from './lib/api.js';

// Log with timestamp
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(FILES.HEARTBEAT_LOG, logMessage);
}

// Cleanup on exit
function cleanup() {
  log('Heartbeat daemon stopping');
  try {
    fs.unlinkSync(FILES.HEARTBEAT_PID);
  } catch {
    // Ignore error
  }
  process.exit(0);
}

// Register cleanup handlers
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', cleanup);

// Check if session file exists
if (!fileExists(FILES.SESSION)) {
  log(`ERROR: No session file found at ${FILES.SESSION}`);
  process.exit(1);
}

// Extract session data
const session = readJSON(FILES.SESSION);
const monitoringId = session?.monitoring_id;
const sessionToken = session?.session_token;

if (!monitoringId || !sessionToken) {
  log('ERROR: Invalid session data');
  process.exit(1);
}

// Store PID (already stored by sms-start.js, but update to be sure)
fs.writeFileSync(FILES.HEARTBEAT_PID, String(process.pid), { mode: 0o600 });
log(`Heartbeat daemon started (PID: ${process.pid}) for session ${monitoringId}`);
log(`Heartbeat interval: ${HEARTBEAT_INTERVAL / 1000}s`);

// Send heartbeat function
async function sendHeartbeat() {
  const timestamp = new Date().toISOString();

  try {
    await apiRequest(`/sessions/${monitoringId}/heartbeat`, {
      method: 'POST',
      token: sessionToken,
      body: {
        timestamp: timestamp,
        last_activity: timestamp
      }
    });

    log(`Heartbeat sent (${monitoringId.substring(0, 8)}...)`);
    return { success: true };
  } catch (error) {
    const message = error.message || 'Unknown error';

    if (message.includes('401') || message.includes('403')) {
      log('ERROR: Authentication failed, session may be expired');
      return { success: false, fatal: true };
    } else if (message.includes('404')) {
      log('ERROR: Session not found on server, stopping');
      return { success: false, fatal: true };
    } else {
      log(`WARNING: Heartbeat failed (${message}), will retry`);
      return { success: false, fatal: false };
    }
  }
}

// Send initial heartbeat
(async () => {
  const result = await sendHeartbeat();
  if (result.success) {
    log('Initial heartbeat sent successfully');
  } else {
    log(`WARNING: Initial heartbeat failed`);
    if (result.fatal) {
      process.exit(1);
    }
  }

  // Main heartbeat loop
  const intervalId = setInterval(async () => {
    // Check if session file still exists (stops if sms-stop was called)
    if (!fileExists(FILES.SESSION)) {
      log('Session file removed, exiting');
      clearInterval(intervalId);
      process.exit(0);
    }

    // Send heartbeat
    const result = await sendHeartbeat();
    if (result.fatal) {
      clearInterval(intervalId);
      process.exit(1);
    }
  }, HEARTBEAT_INTERVAL);

  // Keep process alive
  intervalId.unref(); // Allow process to exit naturally if needed
})();

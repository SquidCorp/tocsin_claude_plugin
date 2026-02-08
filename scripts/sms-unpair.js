#!/usr/bin/env node

import fs from "fs";
import { FILES } from "./lib/config.js";
import { readJSON, deleteFile, fileExists } from "./lib/files.js";
import { apiRequest, AuthenticationError } from "./lib/api.js";
import { handleAuthenticationError } from "./lib/auth-utils.js";

console.log("🔕 Stopping SMS monitoring...");

// Stop heartbeat daemon if running
if (fileExists(FILES.HEARTBEAT_PID)) {
  try {
    const pidStr = fs.readFileSync(FILES.HEARTBEAT_PID, "utf8").trim();
    const pid = parseInt(pidStr, 10);

    // Check if process is running
    try {
      process.kill(pid, 0); // Signal 0 checks existence
      console.log(`🔄 Stopping heartbeat daemon (PID: ${pid})...`);

      // Try graceful kill first
      process.kill(pid, "SIGTERM");

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Force kill if still running
      try {
        process.kill(pid, 0);
        process.kill(pid, "SIGKILL");
      } catch {
        // Process already stopped
      }
    } catch {
      // Process not running
    }
  } catch (error) {
    // Ignore errors reading PID file
  }

  deleteFile(FILES.HEARTBEAT_PID);
}

// Check if session file exists
if (!fileExists(FILES.SESSION)) {
  console.log("ℹ️  No active monitoring session.");
  process.exit(0);
}

// Extract session data
const session = readJSON(FILES.SESSION);
const monitoringId = session?.monitoring_id;
const sessionToken = session?.session_token;
const description = session?.description;

if (!monitoringId) {
  console.log("ℹ️  Invalid session data. Cleaning up...");
  deleteFile(FILES.SESSION);
  process.exit(0);
}

// Get current timestamp
const endedAt = new Date().toISOString();

console.log("📡 Notifying server...");

// Call server to stop session
try {
  await apiRequest(`/sessions/${monitoringId}/stop`, {
    method: "POST",
    token: sessionToken,
    body: {
      reason: "user_stop",
      final_state: "success",
      ended_at: endedAt,
    },
  });
} catch (error) {
  // Handle authentication errors
  if (error instanceof AuthenticationError) {
    handleAuthenticationError({ context: 'sms-unpair' });
    process.exit(1);
  }

  // Handle other errors - continue with cleanup
  console.log("⚠️  Could not reach server, but cleaning up locally...");
}

// Remove session file and logs
deleteFile(FILES.SESSION);
deleteFile(FILES.HEARTBEAT_LOG);

console.log("✅ Monitoring stopped.");
if (description) {
  console.log(`   Session: ${description}`);
}
console.log("");
console.log(
  "Note: Auth token preserved. Run /tocsin:sms-logout to clear authentication."
);

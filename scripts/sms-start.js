#!/usr/bin/env node

import fs from "fs";
import crypto from "crypto";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { FILES } from "./lib/config.js";
import { readJSON, writeJSON, fileExists } from "./lib/files.js";
import { authenticatedRequest, AuthenticationError } from "./lib/api.js";
import { handleAuthenticationError } from "./lib/auth-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const description = process.argv.slice(2).join(" ");

if (!description) {
  console.error("❌ Error: Description required");
  console.error('Usage: /tocsin:sms-start "What you\'re working on"');
  process.exit(1);
}

// Check authentication
if (!fileExists(FILES.AUTH)) {
  console.error("❌ Not authenticated!");
  console.error("Run /tocsin:sms-login first, then /tocsin:sms-pair");
  process.exit(1);
}

// Extract auth token
const auth = readJSON(FILES.AUTH);
const authToken = auth?.access_token;
if (!authToken) {
  console.error("❌ Invalid authentication token!");
  console.error("Run /tocsin:sms-login to re-authenticate.");
  process.exit(1);
}

// Get session from claude env or generate UUID
const claudeSessionId = process.env.CLAUDE_SESSION_ID || crypto.randomUUID();

// Get hostname
const hostname = os.hostname() || "unknown";

// Get current timestamp in ISO format
const startedAt = new Date().toISOString();

// Truncate description if too long (max 100 chars)
let finalDescription = description;
if (description.length > 100) {
  finalDescription = description.substring(0, 97) + "...";
  console.log("⚠️  Description truncated to 100 characters");
}

console.log("🔔 Starting SMS monitoring...");
console.log(`Description: ${finalDescription}`);
console.log("");
console.log("📡 Syncing with SMS server...");

try {
  // Call server API to register session
  const response = await authenticatedRequest("/sessions/start", authToken, {
    method: "POST",
    body: {
      claude_session_id: claudeSessionId,
      description: finalDescription,
      hostname: hostname,
      started_at: startedAt,
    },
  });

  // Check if response contains monitoring_id
  if (!response.monitoring_id) {
    throw new Error(response.message || "No monitoring_id in response");
  }

  const monitoringId = response.monitoring_id;
  const sessionToken = response.session_token;

  // Save session data to file
  const sessionData = {
    monitoring_id: monitoringId,
    session_token: sessionToken,
    claude_session_id: claudeSessionId,
    description: finalDescription,
    hostname: hostname,
    started_at: startedAt,
  };

  writeJSON(FILES.SESSION, sessionData);

  console.log(`✅ Session registered: ${monitoringId}`);
  console.log("");
  console.log("🔄 Starting heartbeat daemon...");

  // Start heartbeat daemon in background
  const daemonPath = path.join(__dirname, "heartbeat-daemon.js");
  const daemon = spawn("node", [daemonPath], {
    detached: true,
    stdio: "ignore",
  });
  daemon.unref();

  const heartbeatPid = daemon.pid;

  // Save PID immediately
  fs.writeFileSync(FILES.HEARTBEAT_PID, String(heartbeatPid), { mode: 0o600 });

  // Give it a moment to start
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Check if it's running
  try {
    process.kill(heartbeatPid, 0);
    console.log(`✅ Heartbeat active (PID: ${heartbeatPid})`);
  } catch {
    console.log("⚠️  Heartbeat daemon failed to start (session still active)");
  }

  console.log("");
  console.log("📱 Monitoring active for:");
  console.log(`  ${finalDescription}`);
  console.log("");
  console.log("You'll receive SMS for:");
  console.log("  • ❌ Errors (blocking only)");
  console.log("  • ⏳ Waiting for input");
  console.log("  • ✅ When session completes");
  console.log("");
  console.log("Run /tocsin:sms-unpair to stop monitoring.");
} catch (error) {
  console.log("");

  // Handle authentication errors
  if (error instanceof AuthenticationError) {
    handleAuthenticationError({ context: 'sms-start' });
    process.exit(1);
  }

  // Handle other errors
  console.error(`❌ Failed to start monitoring: ${error.message}`);
  console.log("");

  if (error.message.includes("Cannot connect")) {
    console.error("Could not reach SMS server!");
    console.error("Check your internet connection or try again later.");
  }

  process.exit(1);
}

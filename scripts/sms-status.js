#!/usr/bin/env node

import fs from "fs";
import { CONFIG_DIR, FILES } from "./lib/config.js";
import { readJSON, fileExists } from "./lib/files.js";

console.log("Tocsin_ - Status");
console.log("================================");
console.log("");

// Check authentication
if (fileExists(FILES.AUTH)) {
  const auth = readJSON(FILES.AUTH);
  const phone = auth?.phone || "unknown";
  const expiresAt = auth?.expires_at || "unknown";

  // Check if token is expired
  let isExpired = false;
  try {
    if (expiresAt !== "unknown") {
      const expiryDate = new Date(expiresAt);
      isExpired = expiryDate < new Date();
    }
  } catch {
    // Ignore parse errors
  }

  console.log("🔑 Authentication:");
  console.log(`   Phone: ${phone}`);
  console.log(`   Expires: ${expiresAt}`);

  if (isExpired) {
    console.log("   ⚠️  Token expired - run /tocsin:sms-login to re-authenticate");
  }
} else {
  console.log("❌ Not authenticated");
  console.log("   Run /tocsin:sms-login +phone");
}

console.log("");

// Check active session
if (fileExists(FILES.SESSION)) {
  const session = readJSON(FILES.SESSION);
  const monitoringId = session?.monitoring_id || "unknown";
  const description = session?.description || "No description";
  const startedAt = session?.started_at || "unknown";

  console.log("📱 Active Session:");
  console.log(`   ID: ${monitoringId}`);
  console.log(`   Description: ${description}`);
  console.log(`   Started: ${startedAt}`);
} else {
  console.log("ℹ️  No active session");
  console.log('   Run /tocsin:sms-start "description"');
}

console.log("");

// Check heartbeat daemon
if (fileExists(FILES.HEARTBEAT_PID)) {
  try {
    const pidStr = fs.readFileSync(FILES.HEARTBEAT_PID, "utf8").trim();
    const pid = parseInt(pidStr, 10);

    // Check if process is running (signal 0 doesn't kill, just checks)
    try {
      process.kill(pid, 0);
      console.log("💓 Heartbeat Daemon:");
      console.log("   Status: Running");
      console.log(`   PID: ${pid}`);

      // Show last log lines if available
      if (fileExists(FILES.HEARTBEAT_LOG)) {
        try {
          const logContent = fs.readFileSync(FILES.HEARTBEAT_LOG, "utf8");
          const lines = logContent.trim().split("\n");
          const lastLine = lines[lines.length - 1] || "";
          console.log(`   Last activity: ${lastLine}`);
          console.log("");
          console.log("   Recent logs (last 5):");
          const recentLines = lines.slice(-5);
          recentLines.forEach((line) => console.log(`     ${line}`));
        } catch (error) {
          // Ignore log read errors
        }
      }
    } catch (error) {
      console.log("⚠️  Heartbeat Daemon:");
      console.log("   Status: Not running (PID file exists but process dead)");
      console.log(`   PID file: ${pid}`);
      fs.unlinkSync(FILES.HEARTBEAT_PID);
    }
  } catch (error) {
    console.log("⚠️  Heartbeat Daemon: Error reading PID file");
  }
} else {
  console.log("💤 Heartbeat Daemon: Not active");
}

console.log("");
console.log("================================");

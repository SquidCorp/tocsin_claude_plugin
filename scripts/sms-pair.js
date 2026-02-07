#!/usr/bin/env node

import crypto from "crypto";
import os from "os";
import { FILES } from "./lib/config.js";
import { readText, writeJSON, deleteFile, fileExists } from "./lib/files.js";
import { apiRequest } from "./lib/api.js";

const code = process.argv[2];

// Validate code
if (!code || !/^[0-9]{6}$/.test(code)) {
  console.error("❌ Error: Invalid pairing code");
  console.error("Usage: /tocsin:sms-pair 123456");
  process.exit(1);
}

// Read temp_token
if (!fileExists(FILES.TEMP_TOKEN)) {
  console.error("❌ Error: No setup in progress.");
  console.error("   Run /tocsin:sms-login first.");
  process.exit(1);
}

const tempToken = readText(FILES.TEMP_TOKEN);
if (!tempToken) {
  console.error("❌ Error: Invalid temporary token.");
  deleteFile(FILES.TEMP_TOKEN);
  process.exit(1);
}

// Generate stable device fingerprint (workspace-based)
function generateDeviceFingerprint() {
  const workspacePath = process.cwd();
  const hostname = os.hostname() || "unknown";
  const fingerprintBase = `${workspacePath}:${hostname}`;

  // Create hash of workspace + hostname
  const hash = crypto.createHash("md5").update(fingerprintBase).digest("hex");
  return hash.substring(0, 16);
}

const deviceFingerprint = generateDeviceFingerprint();

console.log(`Exchanging pairing code ${code}...`);
console.log("");

try {
  // Call exchange endpoint with temp_token (spec-compliant)
  const response = await apiRequest("/auth/exchange", {
    method: "POST",
    body: {
      temp_token: tempToken,
      pairing_code: code,
      device_fingerprint: deviceFingerprint,
    },
  });

  // Validate response contains access_token (proper success indicator)
  if (!response.access_token) {
    throw new Error("No access_token in response");
  }

  // Save token
  writeJSON(FILES.AUTH, response);

  // Extract and validate required fields
  const phone = response.phone;
  const expires = response.expires_at;

  if (!phone || !expires) {
    console.error("❌ Error: Invalid response from server");
    console.error("Response received:", JSON.stringify(response));
    deleteFile(FILES.AUTH);
    process.exit(1);
  }

  // Only clean up temp_token after confirmed success
  deleteFile(FILES.TEMP_TOKEN);

  console.log("✅ Authentication successful!");
  console.log(`   Phone: ${phone}`);
  console.log(`   Expires: ${expires}`);
  console.log("");
  console.log('Next: Run /tocsin:sms-start "Your session description"');
} catch (error) {
  const errorMessage = error.message || "Unknown error";
  console.error(`❌ Exchange failed: ${errorMessage}`);
  console.error("");
  console.error("The pairing code may have expired or be invalid.");
  console.error("Run /tocsin:sms-login to generate a new code.");
  process.exit(1);
}

#!/usr/bin/env node

import crypto from "crypto";
import path from "path";
import { FILES, PHONE_REGEX } from "./lib/config.js";
import { fileExists, writeText, ensureDir } from "./lib/files.js";
import { apiRequest, AuthenticationError } from "./lib/api.js";
import { handleAuthenticationError } from "./lib/auth-utils.js";

// Parse arguments
const args = process.argv.slice(2);
const phone = args[0] || "";

if (!phone) {
  console.error("❌ Error: Phone number is required");
  console.error("Usage: /tocsin:sms-login +1234567890");
  process.exit(1);
}

console.log(" Tocsin_ - Login");
console.log("===============================");
console.log("");

// Check if already authenticated
if (fileExists(FILES.AUTH)) {
  console.log("✅ Already authenticated!");
  console.log("Run /tocsin:sms-logout to re-authenticate.");
  process.exit(0);
}

// Create config directory
ensureDir(path.dirname(FILES.AUTH));

// Generate CSRF state nonce
const state = crypto.randomUUID();

// Validate phone number format (E.164)
if (!PHONE_REGEX.test(phone)) {
  console.error("❌ Error: Invalid phone number format.");
  console.error("Use E.164 format: +1234567890");
  process.exit(1);
}

console.log("🔐 Initiating authentication flow...");
console.log(`📱 Sending SMS to ${phone}...`);
console.log("");

try {
  // Call server API directly (spec-compliant /login endpoint)
  const response = await apiRequest("/login", {
    method: "POST",
    body: {
      phone: phone,
      state: state,
      mode: "remote",
    },
  });

  // Extract temp_token from response (spec-compliant field)
  const tempToken = response.temp_token;

  if (!tempToken) {
    console.error("❌ Error: Failed to initiate authentication.");
    console.error("Response:", JSON.stringify(response));
    process.exit(1);
  }

  // Store temp_token securely
  writeText(FILES.TEMP_TOKEN, tempToken);

  console.log("✅ SMS sent successfully!");
  console.log("");
  console.log("Check your phone for a 6-digit code, then run:");
  console.log("  /tocsin:sms-pair <code>");
  console.log("");
  console.log("⏳ Pairing code valid for 10 minutes.");
  process.exit(0);
} catch (error) {
  // Handle authentication errors (unlikely for login, but defensive)
  if (error instanceof AuthenticationError) {
    console.error("❌ Authentication error during login.");
    console.error("This is unexpected. Please try again or contact support.");
    process.exit(1);
  }

  // Handle other errors
  console.error("❌ Error: Could not reach SMS server.");
  console.error(error.message);
  process.exit(1);
}

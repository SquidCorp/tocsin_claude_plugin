#!/usr/bin/env bun
// /sms-pair command handler
// Exchanges pairing code for auth token

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { AuthManager } from "./auth";
import { loadEnv, logger } from "./utils";

const TEMP_STATE_FILE = path.join(os.tmpdir(), "claude-sms-temp-state.json");
const TEMP_TOKEN_FILE = path.join(os.tmpdir(), "claude-sms-temp-state.json.token");

async function main() {
  const code = process.argv[2];
  
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    console.error("❌ Error: Invalid pairing code");
    console.error("Usage: /sms-pair 123456");
    console.error("       (6-digit number from your SMS)");
    process.exit(1);
  }
  
  console.log(`🦞 Exchanging pairing code ${code}...`);
  
  try {
    // Read temp token from callback
    let tempToken: string;
    try {
      tempToken = await fs.readFile(TEMP_TOKEN_FILE, "utf-8");
    } catch {
      console.error("❌ Error: No pending authentication found.");
      console.error("   Run /sms-setup first to start the authentication flow.");
      process.exit(1);
    }
    
    const env = loadEnv();
    const auth = new AuthManager(env.CLAUDE_SMS_AUTH_URL);
    
    // Exchange pairing code for auth token
    await auth.exchangePairingCode(tempToken, code);
    
    // Clean up temp files
    await fs.unlink(TEMP_TOKEN_FILE).catch(() => {});
    await fs.unlink(TEMP_STATE_FILE).catch(() => {});
    
    console.log("");
    console.log("✅ Authentication successful!");
    console.log("   Token stored securely.");
    console.log("   Valid for 36 hours.");
    console.log("");
    console.log("Next: Run /sms-start \"Your session description\"");
    
  } catch (err) {
    logger.error("Pairing failed", err);
    console.error("");
    console.error("❌ Authentication failed:");
    console.error("   ", err instanceof Error ? err.message : err);
    console.error("");
    console.error("Check your pairing code and try again.");
    process.exit(1);
  }
}

main();

#!/usr/bin/env bun
// /sms-logout command handler
// Logs out and clears authentication

import { AuthManager } from "./auth";
import { loadEnv, logger } from "./utils";

async function main() {
  console.log("🦞 Logging out...");
  
  try {
    const env = loadEnv();
    
    // Initialize auth
    const auth = new AuthManager(env.CLAUDE_SMS_AUTH_URL);
    
    // Clear token
    await auth.clearToken();
    
    console.log("✅ Logged out successfully.");
    console.log("   Auth token removed.");
    console.log("   Run /sms-setup to authenticate again.");
    
  } catch (err) {
    logger.error("Logout failed", err);
    console.error("");
    console.error("❌ Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

#!/usr/bin/env bun
// /sms-stop command handler
// Stops monitoring session

import { AuthManager } from "./auth";
import { SessionManager } from "./session";
import { loadEnv, logger } from "./utils";

async function main() {
  console.log("🦞 Stopping SMS monitoring...");
  
  try {
    const env = loadEnv();
    
    // Initialize auth
    const auth = new AuthManager(env.CLAUDE_SMS_AUTH_URL);
    const isAuth = await auth.init();
    
    if (!isAuth) {
      console.log("ℹ️  Not authenticated - no session to stop.");
      return;
    }
    
    // Get API client from auth
    const client = auth.getClient();
    
    // Create session manager
    const session = new SessionManager(client);
    
    // Try to load existing session
    // Note: This requires session file to exist from sms-start
    // For now, we just stop any active session
    
    try {
      await session.stopSession("user_stop");
      console.log("✅ Session monitoring stopped.");
    } catch (err) {
      if (err instanceof Error && err.message.includes("No active session")) {
        console.log("ℹ️  No active monitoring session.");
      } else {
        throw err;
      }
    }
    
  } catch (err) {
    logger.error("Failed to stop session", err);
    console.error("");
    console.error("❌ Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

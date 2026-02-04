#!/usr/bin/env bun
// /sms-start command handler
// Starts monitoring session

import { AuthManager } from "./auth";
import { SessionManager } from "./session";
import { loadEnv, logger } from "./utils";

async function main() {
  const description = process.argv.slice(2).join(" ");
  
  if (!description) {
    console.error("❌ Error: Description required");
    console.error("Usage: /sms-start \"What you're working on\"");
    process.exit(1);
  }
  
  console.log("🦞 Starting SMS monitoring...");
  console.log(`Description: ${description}`);
  
  try {
    const env = loadEnv();
    
    // Initialize auth
    const auth = new AuthManager(env.CLAUDE_SMS_AUTH_URL);
    const isAuth = await auth.init();
    
    if (!isAuth) {
      console.error("");
      console.error("❌ Not authenticated!");
      console.error("   Run /sms-setup first, then /sms-pair");
      process.exit(1);
    }
    
    // Get API client from auth
    const client = auth.getClient();
    
    // Create session manager
    const session = new SessionManager(client);
    
    // Generate unique session ID
    const claudeSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Start monitoring
    await session.startSession(claudeSessionId, description);
    
    console.log("");
    console.log("✅ Session monitoring started!");
    console.log("");
    console.log("You'll receive SMS for:");
    console.log("  • ⚠️  Errors (blocking only)");
    console.log("  • ⏳ Waiting for input (>10 min idle)");
    console.log("  • ✅ When session completes");
    console.log("");
    console.log("Rate limit: 1 SMS per 30 min per event type");
    console.log("");
    console.log("Run /sms-stop to stop monitoring.");
    
  } catch (err) {
    logger.error("Failed to start session", err);
    console.error("");
    console.error("❌ Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

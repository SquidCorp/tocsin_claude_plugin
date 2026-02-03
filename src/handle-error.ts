import { loadEnv, logger } from "./utils";
import { AuthManager } from "./auth";
import { SessionManager } from "./session";
import { isBlockingError, categorizeError } from "./error.filter";

async function main() {
  try {
    // Get error details from environment
    const errorOutput = process.env.CLAUDE_HOOK_ERROR_OUTPUT || "";
    const toolName = process.env.CLAUDE_HOOK_TOOL_NAME || "unknown";
    
    // Check if this is a blocking error
    if (!isBlockingError(errorOutput)) {
      logger.debug("Non-blocking error, skipping SMS", { 
        tool: toolName,
        preview: errorOutput.slice(0, 100)
      });
      process.exit(0);
    }
    
    logger.info("Blocking error detected, reporting...", {
      category: categorizeError(errorOutput),
      tool: toolName
    });

    const env = loadEnv();
    const auth = new AuthManager(env.CLAUDE_SMS_AUTH_URL);
    const isAuth = await auth.init();

    if (!isAuth) {
      logger.debug("Not authenticated, skipping error report");
      process.exit(0);
    }

    const session = new SessionManager(auth.getClient());

    // Try to restore existing session
    const sessionId = process.env.CLAUDE_SESSION_ID || "unknown";
    const restored = await session.loadSession(sessionId);
    if (!restored && !session.isMonitoring()) {
      logger.debug("No active monitoring session");
      process.exit(0);
    }

    // Report the error with category
    const errorCategory = categorizeError(errorOutput);
    await session.reportEvent("error", {
      hook: "PostToolUseFailure",
      category: errorCategory,
      tool: toolName,
      preview: errorOutput.slice(0, 200), // First 200 chars
      timestamp: new Date().toISOString(),
    });

    logger.info("Error event reported", { category: errorCategory });
  } catch (err) {
    logger.error("Failed to handle error", err);
    process.exit(1);
  }
}

main();

import { loadEnv, logger } from "./utils";
import { AuthManager } from "./auth";
import { SessionManager } from "./session";

async function main() {
  try {
    const env = loadEnv();
    const auth = new AuthManager(env.CLAUDE_SMS_AUTH_URL);
    const isAuth = await auth.init();

    if (!isAuth) {
      logger.debug("Not authenticated, skipping activity record");
      process.exit(0);
    }

    const session = new SessionManager(auth.getClient());

    // Try to restore session
    const sessionId = process.env.CLAUDE_SESSION_ID || "unknown";
    const restored = await session.loadSession(sessionId);

    if (!restored && !session.isMonitoring()) {
      logger.debug("No active monitoring session");
      process.exit(0);
    }

    // Record activity (resets inactivity timer)
    session.recordActivity();
    logger.debug("Activity recorded");
  } catch (err) {
    logger.error("Failed to handle activity", err);
    process.exit(1);
  }
}

main();

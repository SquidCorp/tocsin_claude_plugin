import { loadEnv, logger } from './utils';
import { AuthManager } from './auth';
import { SessionManager } from './session';

async function main() {
  try {
    const env = loadEnv();
    const auth = new AuthManager(env.CLAUDE_SMS_AUTH_URL);
    const isAuth = await auth.init();

    if (!isAuth) {
      logger.debug('Not authenticated, skipping error report');
      process.exit(0);
    }

    const session = new SessionManager(auth.getClient());

    // Try to restore existing session
    // Note: In a real hook, we'd get the session ID from environment/context
    // For now, we scan for active sessions
    const sessionId = process.env.CLAUDE_SESSION_ID ?? 'unknown';

    const restored = await session.loadSession(sessionId);
    if (!restored && !session.isMonitoring()) {
      logger.debug('No active monitoring session');
      process.exit(0);
    }

    // Report the error
    await session.reportEvent('error', {
      hook: 'PostToolUseFailure',
      timestamp: new Date().toISOString(),
    });

    logger.info('Error event reported');
  } catch (err) {
    logger.error('Failed to handle error', err);
    process.exit(1);
  }
}

void main();

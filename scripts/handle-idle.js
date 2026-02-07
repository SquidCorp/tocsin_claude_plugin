#!/usr/bin/env node

/**
 * Notification Hook Handler (idle_prompt type ONLY)
 *
 * Triggered when Claude Code sends notifications.
 * ONLY processes idle_prompt (user has been idle for extended period).
 * IGNORES all other notification types (permission_prompt, elicitation_dialog, etc.)
 *
 * Official docs: https://code.claude.com/docs/en/hooks#notification
 */

import { FILES } from "./lib/config.js";
import { readJSON, fileExists } from "./lib/files.js";
import { apiRequest } from "./lib/api.js";
import { readStdin } from "./lib/stdin.js";

(async () => {
  try {
    // Read hook input from stdin (official Claude Code pattern)
    const input = await readStdin();

    // Extract Notification fields
    const notificationType = input.notification_type || "";
    const message = input.message || "";
    const title = input.title || "";
    const sessionId = input.session_id || "";

    // DEBUG: Log notification type (remove after debugging)
    // Uncomment to see what notifications are being sent:
    // console.error(`[handle-idle] Received notification_type: "${notificationType}"`);

    // CRITICAL: Only process idle_prompt notifications
    // Ignore all other notification types:
    // - permission_prompt (Claude needs permission)
    // - elicitation_dialog (Claude asking a question)
    // - auth_success (authentication succeeded)
    // - Any other notification types
    if (notificationType !== "idle_prompt") {
      // Not an idle notification - ignore it
      process.exit(0);
    }

    // At this point, we know it's genuinely an idle_prompt notification
    // This means Claude Code detected the user has been idle for a configured period

    // Check if session file exists
    if (!fileExists(FILES.SESSION)) {
      // No active monitoring session
      process.exit(0);
    }

    // Extract session data
    const session = readJSON(FILES.SESSION);
    const monitoringId = session?.monitoring_id;
    const sessionToken = session?.session_token;

    if (!monitoringId || !sessionToken) {
      process.exit(0);
    }

    const timestamp = new Date().toISOString();

    // Send idle/waiting event to server
    await apiRequest(`/sessions/${monitoringId}/events`, {
      method: "POST",
      token: sessionToken,
      body: {
        event_type: "waiting",
        timestamp: timestamp,
        details: {
          notification_type: notificationType,
          message: message,
          title: title,
          session_id: sessionId,
          source: "notification_hook",
        },
      },
    }).catch(() => {
      // Suppress errors - hooks must not block
    });

    process.exit(0);
  } catch (error) {
    // Suppress all errors - hooks must never block Claude Code
    process.exit(0);
  }
})();

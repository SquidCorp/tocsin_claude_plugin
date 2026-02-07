#!/usr/bin/env node

/**
 * UserPromptSubmit Hook Handler
 *
 * Triggered when user submits a prompt to Claude.
 * Sends heartbeat to server with activity timestamp.
 * Auto-starts monitoring session if none exists (uses first 25 chars of prompt as description).
 * Server handles all activity tracking and rate limiting.
 *
 * Official docs: https://code.claude.com/docs/en/hooks#userpromptsubmit
 */

import os from "os";
import { FILES } from "./lib/config.js";
import { readJSON, writeJSON, fileExists } from "./lib/files.js";
import { apiRequest } from "./lib/api.js";
import { readStdin } from "./lib/stdin.js";

(async () => {
  try {
    // Read hook input from stdin (official Claude Code pattern)
    const input = await readStdin();

    // Extract UserPromptSubmit fields
    const prompt = input.prompt || "";
    const sessionId = input.session_id || "";
    const cwd = input.cwd || process.cwd();

    // Check if session file exists
    if (!fileExists(FILES.SESSION)) {
      // No active monitoring session - try to auto-start

      // Only auto-start if authenticated
      if (!fileExists(FILES.AUTH)) {
        // Not authenticated - can't auto-start
        process.exit(0);
      }

      // Generate description from prompt (first 25 chars)
      let description;
      if (prompt.length > 0) {
        description = prompt.substring(0, 25);
        if (prompt.length > 25) {
          description += "...";
        }
      } else {
        // Fallback: use directory name
        const dirName = cwd.split("/").pop() || "unknown";
        description = dirName.substring(0, 25);
      }

      // Auto-start monitoring session
      try {
        const auth = readJSON(FILES.AUTH);
        const authToken = auth?.token;

        if (!authToken) {
          process.exit(0);
        }

        const startResponse = await apiRequest("/sessions/start", {
          method: "POST",
          token: authToken,
          body: {
            claude_session_id: sessionId,
            description: description,
            hostname: os.hostname(),
            started_at: new Date().toISOString(),
          },
        });

        // Save session data
        writeJSON(FILES.SESSION, {
          monitoring_id: startResponse.monitoring_id,
          session_token: startResponse.session_token,
          claude_session_id: sessionId,
          description: description,
          hostname: os.hostname(),
          started_at: new Date().toISOString(),
        });

        // Continue with heartbeat using the newly created session
        const monitoringId = startResponse.monitoring_id;
        const sessionToken = startResponse.session_token;

        await apiRequest(`/sessions/${monitoringId}/heartbeat`, {
          method: "POST",
          token: sessionToken,
          body: {
            timestamp: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            session_id: sessionId,
            prompt_length: prompt.length,
          },
        }).catch(() => {});

        process.exit(0);
      } catch (error) {
        // Auto-start failed - just exit
        process.exit(0);
      }
    }

    // Extract session data
    const session = readJSON(FILES.SESSION);
    const monitoringId = session?.monitoring_id;
    const sessionToken = session?.session_token;

    if (!monitoringId || !sessionToken) {
      process.exit(0);
    }

    const timestamp = new Date().toISOString();

    // Send heartbeat to server (fire and forget - don't block hook)
    await apiRequest(`/sessions/${monitoringId}/heartbeat`, {
      method: "POST",
      token: sessionToken,
      body: {
        timestamp: timestamp,
        last_activity: timestamp,
        session_id: sessionId,
        prompt_length: prompt.length,
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

#!/usr/bin/env bun
/**
 * MCP Auth Server
 * 
 * This server runs locally during the OAuth flow to:
 * 1. Receive the callback from the auth server with temp_token
 * 2. Display the pairing code prompt to the user
 * 3. Wait for user to enter pairing code via /sms-pair command
 * 4. Exchange pairing code for auth token
 */

import { createServer } from "http";
import { URL } from "url";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const PORT = 0; // Random available port
const STATE_FILE = path.join(os.tmpdir(), "claude-sms-auth-state.json");

interface AuthState {
  tempToken: string;
  phone: string;
  state: string;
  callbackReceived: boolean;
}

async function saveState(state: AuthState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function loadState(): Promise<AuthState | null> {
  try {
    const data = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function clearState(): Promise<void> {
  try {
    await fs.unlink(STATE_FILE);
  } catch {
    // Ignore
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/callback") {
    const tempToken = url.searchParams.get("temp_token");
    const phone = url.searchParams.get("phone");
    const state = url.searchParams.get("state");

    if (!tempToken || !phone || !state) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1>❌ Authentication Failed</h1>
            <p>Missing required parameters. Please try again.</p>
            <p>You can close this window.</p>
          </body>
        </html>
      `);
      return;
    }

    // Save state for the plugin to pick up
    await saveState({
      tempToken,
      phone,
      state,
      callbackReceived: true,
    });

    // Show success page
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
          <h1>✅ Phone Verified!</h1>
          <p>Phone: ${phone}</p>
          <p>Check your SMS for the 6-digit pairing code.</p>
          <p><strong>Then run in Claude:</strong></p>
          <code style="background: #f0f0f0; padding: 10px; border-radius: 4px;">
            /sms-pair <code>
          </code>
          <p>You can close this window.</p>
        </body>
      </html>
    `);

    // Shut down server after 5 seconds
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 5000);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  const address = server.address();
  if (address && typeof address !== "string") {
    const callbackUrl = `http://localhost:${address.port}/callback`;
    console.log(`MCP_AUTH_CALLBACK_URL=${callbackUrl}`);
  }
});

// Timeout after 10 minutes
setTimeout(async () => {
  await clearState();
  server.close();
  process.exit(1);
}, 10 * 60 * 1000);

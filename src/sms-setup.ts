#!/usr/bin/env bun
// /sms-setup command handler
// Opens browser for OAuth authentication

import { exec } from "child_process";
import { promisify } from "util";
import { loadEnv, logger } from "./utils";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// Temp state file for OAuth callback
const TEMP_STATE_FILE = path.join(os.tmpdir(), "claude-sms-temp-state.json");

async function saveTempState(phone: string, callbackUri: string, state: string): Promise<void> {
  await fs.writeFile(TEMP_STATE_FILE, JSON.stringify({
    phone,
    callbackUri,
    state,
    timestamp: Date.now()
  }));
}

async function main() {
  const env = loadEnv();
  
  console.log("🦞 Claude SMS Notifier - Setup");
  console.log("===============================");
  console.log("");
  
  // Check if already authenticated
  const { ensureConfigDir, loadTokenFromFile } = await import("./token.storage");
  await ensureConfigDir();
  const existingToken = await loadTokenFromFile();
  
  if (existingToken) {
    console.log("✅ Already authenticated!");
    console.log(`Token expires: ${new Date(existingToken.expires_at).toLocaleString()}`);
    console.log("");
    console.log("Run /sms-logout to re-authenticate.");
    return;
  }
  
  // Build auth URL with callback to local server
  const callbackPort = 8765;
  const callbackUri = `http://localhost:${callbackPort}/callback`;
  const authUrl = `${env.CLAUDE_SMS_AUTH_URL}/login?callback_uri=${encodeURIComponent(callbackUri)}`;
  
  console.log("📱 Step 1: Opening browser for authentication...");
  console.log(`URL: ${authUrl}`);
  console.log("");
  
  // Start local callback server
  const { createServer } = await import("http");
  const { URL } = await import("url");
  
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${callbackPort}`);
    
    if (url.pathname === "/callback") {
      const tempToken = url.searchParams.get("temp_token");
      const phone = url.searchParams.get("phone");
      const state = url.searchParams.get("state");
      
      if (tempToken && phone && state) {
        // Save temp state for sms-pair to use
        await saveTempState(phone, callbackUri, state);
        await fs.writeFile(TEMP_STATE_FILE + ".token", tempToken);
        
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
              <h1>✅ Phone Verified!</h1>
              <p>Phone: ${phone}</p>
              <p>Check your SMS for the 6-digit pairing code.</p>
              <p><strong>Then run in Claude:</strong></p>
              <code style="background: #f0f0f0; padding: 10px; border-radius: 4px; font-size: 18px;">
                /sms-pair YOUR_CODE
              </code>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        
        // Shut down server
        setTimeout(() => {
          server.close();
          console.log("\n✅ Callback received! Check your SMS for the pairing code.");
          console.log("Run: /sms-pair YOUR_6_DIGIT_CODE\n");
        }, 1000);
      } else {
        res.writeHead(400);
        res.end("Missing parameters");
      }
    }
  });
  
  server.listen(callbackPort, async () => {
    console.log(`📡 Callback server listening on port ${callbackPort}`);
    
    // Open browser
    const platform = process.platform;
    let openCmd: string;
    
    if (platform === "darwin") {
      openCmd = `open "${authUrl}"`;
    } else if (platform === "win32") {
      openCmd = `start "${authUrl}"`;
    } else {
      openCmd = `xdg-open "${authUrl}" 2>/dev/null || sensible-browser "${authUrl}" 2>/dev/null || x-www-browser "${authUrl}"`;
    }
    
    try {
      await execAsync(openCmd);
    } catch {
      console.log("⚠️  Could not open browser automatically.");
      console.log("Please open this URL manually:");
      console.log(authUrl);
    }
    
    console.log("");
    console.log("⏳ Waiting for authentication callback...");
    console.log("(Server will close after receiving callback)");
  });
  
  // Timeout after 5 minutes
  setTimeout(() => {
    server.close();
    console.log("\n⏰ Timeout: Authentication window closed.");
    console.log("Run /sms-setup to try again.\n");
    process.exit(1);
  }, 5 * 60 * 1000);
}

main().catch(err => {
  logger.error("Setup failed", err);
  console.error("❌ Error:", err.message);
  process.exit(1);
});

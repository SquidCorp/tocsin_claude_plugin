/**
 * Mock Auth Server for Testing
 * Run with: bun run mock-server.ts
 */

import { serve } from "bun";

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Login endpoint
    if (url.pathname === "/login" && req.method === "GET") {
      const callbackUri = url.searchParams.get("callback_uri");
      const state = url.searchParams.get("state");
      
      console.log("📱 Login request received");
      console.log("   Callback:", callbackUri);
      console.log("   State:", state);
      
      // Simulate redirect to callback with temp token
      // In real testing, you'd open this URL in browser
      return new Response(
        JSON.stringify({
          message: "Mock auth server",
          nextStep: `Open browser and go to: ${callbackUri}?temp_token=temp_abc123&phone=%2B1***1234&state=${state}`,
        }),
        { headers }
      );
    }

    // Auth exchange
    if (url.pathname === "/auth/exchange" && req.method === "POST") {
      const body = await req.json();
      console.log("🔑 Exchange request:", body);

      // Simulate successful auth
      return new Response(
        JSON.stringify({
          access_token: "eyJhbGciOiJIUzI1NiIs.mock.token",
          token_type: "Bearer",
          expires_in: 129600,
          expires_at: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
          phone: "+1234567890",
        }),
        { headers }
      );
    }

    // Start session
    if (url.pathname === "/sessions/start" && req.method === "POST") {
      const body = await req.json();
      console.log("▶️  Session start:", body);

      return new Response(
        JSON.stringify({
          session_token: "sess_token_xyz789",
          monitoring_id: "mon_test_123",
        }),
        { headers }
      );
    }

    // Report event
    if (url.pathname.match(/\/sessions\/.*\/events/) && req.method === "POST") {
      const body = await req.json();
      console.log("📤 Event reported:", body);

      return new Response(
        JSON.stringify({
          sms_sent: true,
          sms_id: "sms_test_123",
          rate_limited: false,
          next_allowed_at: null,
        }),
        { headers }
      );
    }

    // Heartbeat
    if (url.pathname.match(/\/sessions\/.*\/heartbeat/) && req.method === "POST") {
      return new Response(
        JSON.stringify({ status: "active", monitoring: true }),
        { headers }
      );
    }

    // Stop session
    if (url.pathname.match(/\/sessions\/.*\/stop/) && req.method === "POST") {
      console.log("⏹️  Session stopped");
      return new Response(
        JSON.stringify({
          stopped: true,
          session_summary: {
            duration_seconds: 1800,
            sms_sent: 3,
            errors_encountered: 1,
          },
        }),
        { headers }
      );
    }

    return new Response("Not found", { status: 404, headers });
  },
});

console.log(`🚀 Mock auth server running at http://localhost:${server.port}`);
console.log("");
console.log("Test commands:");
console.log("  /sms-setup     - Triggers OAuth flow");
console.log("  /sms-pair 123456 - Completes auth");
console.log("  /sms-start     - Starts monitoring");
console.log("  /sms-stop      - Stops monitoring");
console.log("");
console.log("Press Ctrl+C to stop");

import { describe, it, expect } from "bun:test";
import {
  EnvSchema,
  AuthTokenSchema,
  EventRequestSchema,
  StartSessionRequestSchema,
} from "../src/types";

describe("Zod Schemas", () => {
  describe("EnvSchema", () => {
    it("should validate valid environment", () => {
      const env = {
        CLAUDE_SMS_AUTH_URL: "https://example.com",
        CLAUDE_SMS_HEARTBEAT_INTERVAL: "30000",
        CLAUDE_SMS_INACTIVITY_THRESHOLD: "600000",
        CLAUDE_SMS_LOG_LEVEL: "info",
      };

      const result = EnvSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.CLAUDE_SMS_AUTH_URL).toBe("https://example.com");
        expect(result.data.CLAUDE_SMS_HEARTBEAT_INTERVAL).toBe(30000);
        expect(result.data.CLAUDE_SMS_INACTIVITY_THRESHOLD).toBe(600000);
        expect(result.data.CLAUDE_SMS_LOG_LEVEL).toBe("info");
      }
    });

    it("should use defaults for optional fields", () => {
      const env = {
        CLAUDE_SMS_AUTH_URL: "https://example.com",
      };

      const result = EnvSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.CLAUDE_SMS_HEARTBEAT_INTERVAL).toBe(30000);
        expect(result.data.CLAUDE_SMS_INACTIVITY_THRESHOLD).toBe(600000);
        expect(result.data.CLAUDE_SMS_LOG_LEVEL).toBe("info");
      }
    });

    it("should reject invalid URL", () => {
      const env = {
        CLAUDE_SMS_AUTH_URL: "not-a-url",
      };

      const result = EnvSchema.safeParse(env);
      expect(result.success).toBe(false);
    });

    it("should reject missing required field", () => {
      const env = {};

      const result = EnvSchema.safeParse(env);
      expect(result.success).toBe(false);
    });
  });

  describe("AuthTokenSchema", () => {
    it("should validate valid token", () => {
      const token = {
        access_token: "eyJhbGciOiJIUzI1NiIs...",
        token_type: "Bearer",
        expires_in: 129600,
        expires_at: "2026-02-03T15:30:00Z",
        phone: "+1234567890",
      };

      const result = AuthTokenSchema.safeParse(token);
      expect(result.success).toBe(true);
    });

    it("should reject invalid expires_at", () => {
      const token = {
        access_token: "eyJ...",
        token_type: "Bearer",
        expires_in: 129600,
        expires_at: "not-a-date",
        phone: "+1234567890",
      };

      const result = AuthTokenSchema.safeParse(token);
      expect(result.success).toBe(false);
    });
  });

  describe("EventRequestSchema", () => {
    it("should validate error event", () => {
      const event = {
        event_type: "error" as const,
        timestamp: "2026-02-01T15:30:00Z",
        details: { tool_name: "docker build" },
      };

      const result = EventRequestSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should validate done event without details", () => {
      const event = {
        event_type: "done" as const,
        timestamp: "2026-02-01T15:30:00Z",
      };

      const result = EventRequestSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should reject invalid event type", () => {
      const event = {
        event_type: "invalid",
        timestamp: "2026-02-01T15:30:00Z",
      };

      const result = EventRequestSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe("StartSessionRequestSchema", () => {
    it("should validate valid request", () => {
      const request = {
        claude_session_id: "claude-abc123",
        description: "Fixing bug",
        hostname: "my-server",
        started_at: "2026-02-01T15:30:00Z",
      };

      const result = StartSessionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should reject description over 100 chars", () => {
      const request = {
        claude_session_id: "claude-abc123",
        description: "a".repeat(101),
        hostname: "my-server",
        started_at: "2026-02-01T15:30:00Z",
      };

      const result = StartSessionRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });
});

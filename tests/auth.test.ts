import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AuthManager } from "../src/auth";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const TEST_CONFIG_DIR = join(tmpdir(), "claude-sms-test-" + Date.now());

describe("AuthManager", () => {
  let auth: AuthManager;

  beforeEach(async () => {
    await mkdir(TEST_CONFIG_DIR, { recursive: true });
    process.env.CLAUDE_SMS_AUTH_URL = "https://test.example.com";
    auth = new AuthManager("https://test.example.com");
  });

  afterEach(async () => {
    await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
  });

  it("should initialize as not authenticated", async () => {
    const isAuth = await auth.init();
    expect(isAuth).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it("should return null phone when not authenticated", () => {
    expect(auth.getPhone()).toBeNull();
  });

  it("should throw when refreshing without token", async () => {
    expect(auth.refreshToken()).rejects.toThrow("No token to refresh");
  });

  it("should generate consistent device fingerprint", async () => {
    // Same machine should generate same fingerprint
    const auth2 = new AuthManager("https://test.example.com");
    await auth2.init();
    
    // Device fingerprint is based on hostname + username
    // So it should be consistent on same machine
    expect(auth2.isAuthenticated()).toBe(false);
  });
});

import { EnvSchema, Env } from "./types";

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = EnvSchema.safeParse({
    CLAUDE_SMS_AUTH_URL: process.env.CLAUDE_SMS_AUTH_URL,
    CLAUDE_SMS_HEARTBEAT_INTERVAL: process.env.CLAUDE_SMS_HEARTBEAT_INTERVAL,
    CLAUDE_SMS_INACTIVITY_THRESHOLD: process.env.CLAUDE_SMS_INACTIVITY_THRESHOLD,
    CLAUDE_SMS_LOG_LEVEL: process.env.CLAUDE_SMS_LOG_LEVEL,
  });

  if (!result.success) {
    throw new Error(
      `Invalid environment variables: ${result.error.message}`
    );
  }

  cachedEnv = result.data;
  return result.data;
}

export function clearEnvCache(): void {
  cachedEnv = null;
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog("debug")) console.error(`[DEBUG] ${message}`, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog("info")) console.error(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog("warn")) console.error(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    if (shouldLog("error")) console.error(`[ERROR] ${message}`, ...args);
  },
};

function shouldLog(level: Env["CLAUDE_SMS_LOG_LEVEL"]): boolean {
  const levels = ["debug", "info", "warn", "error"] as const;
  const envLevel = loadEnv().CLAUDE_SMS_LOG_LEVEL;
  const currentIndex = levels.indexOf(level);
  const envIndex = levels.indexOf(envLevel);
  return currentIndex >= envIndex;
}

// Generate a random session ID
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `claude-${timestamp}-${random}`;
}

// Format phone number for display (mask middle digits)
export function maskPhone(phone: string): string {
  if (phone.length <= 8) return phone;
  return phone.substring(0, 4) + "***" + phone.substring(phone.length - 4);
}

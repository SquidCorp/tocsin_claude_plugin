// Configuration loader
import { loadEnv } from "./utils";

export interface Config {
  authUrl: string;
  logLevel: string;
}

export function loadConfig(): Config {
  const env = loadEnv();
  
  return {
    authUrl: env.CLAUDE_SMS_AUTH_URL || "https://sms.shadowemployee.xyz",
    logLevel: env.CLAUDE_SMS_LOG_LEVEL || "info",
  };
}

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { AuthToken, AuthTokenSchema } from "./types";
import { logger } from "./utils";

const CONFIG_DIR = path.join(os.homedir(), ".config", "claude-sms-notifier");
const TOKEN_FILE = path.join(CONFIG_DIR, "auth.json");

export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

export async function loadTokenFromFile(): Promise<AuthToken | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf-8");
    const parsed = JSON.parse(data);
    const result = AuthTokenSchema.safeParse(parsed);

    if (result.success) {
      logger.debug("Token loaded successfully");
      return result.data;
    } else {
      logger.warn("Invalid token file format");
      await clearTokenFile();
      return null;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("Failed to load token", err);
    }
    return null;
  }
}

export async function saveTokenToFile(token: AuthToken): Promise<void> {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), {
    mode: 0o600,
  });
  logger.debug("Token saved");
}

export async function clearTokenFile(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

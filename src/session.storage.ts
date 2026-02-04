import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { SessionState, SessionStateSchema } from "./types";
import { logger } from "./utils";

const SESSION_DIR = path.join(os.tmpdir(), "claude-sms-sessions");

export async function ensureSessionDir(): Promise<void> {
  await fs.mkdir(SESSION_DIR, { recursive: true });
}

export function getSessionFilePath(claudeSessionId: string): string {
  return path.join(SESSION_DIR, `${claudeSessionId}.json`);
}

export async function saveSessionToFile(
  sessionFile: string,
  state: SessionState
): Promise<void> {
  await fs.writeFile(sessionFile, JSON.stringify(state, null, 2));
}

export async function loadSessionFromFile(
  sessionFile: string
): Promise<SessionState | null> {
  try {
    const data = await fs.readFile(sessionFile, "utf-8");
    const parsed = JSON.parse(data);
    const result = SessionStateSchema.safeParse(parsed);

    if (result.success && result.data.is_monitoring) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteSessionFile(sessionFile: string): Promise<void> {
  try {
    await fs.unlink(sessionFile);
  } catch {
    // Ignore
  }
}

export function scheduleSessionFileDeletion(sessionFile: string): void {
  setTimeout(async () => {
    await deleteSessionFile(sessionFile);
  }, 60000);
}

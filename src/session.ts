import * as os from "os";
import { SessionState } from "./types";
import { SmsApiClient } from "./api-client";
import { logger } from "./utils";
import {
  ensureSessionDir,
  getSessionFilePath,
  saveSessionToFile,
  loadSessionFromFile,
  scheduleSessionFileDeletion,
} from "./session.storage";
import {
  TimerManager,
  startTimers,
  resetInactivityTimer,
  stopTimers,
} from "./session.timers";
import { stopSessionOnServer } from "./session.lifecycle";
import { reportEventToServer } from "./session.events";

export class SessionManager {
  private client: SmsApiClient;
  private state: SessionState | null = null;
  private timerManager: TimerManager = { heartbeatInterval: null, inactivityTimer: null };
  private sessionFile: string | null = null;

  constructor(client: SmsApiClient) {
    this.client = client;
  }

  async startSession(claudeSessionId: string, description: string): Promise<void> {
    if (this.state?.is_monitoring) {
      throw new Error("Session already being monitored. Use /sms-stop first.");
    }

    const hostname = os.hostname();
    const startedAt = new Date().toISOString();

    const response = await this.client.startSession({
      claude_session_id: claudeSessionId,
      description: description.substring(0, 100),
      hostname,
      started_at: startedAt,
    });

    this.state = {
      monitoring_id: response.monitoring_id,
      session_token: response.session_token,
      claude_session_id: claudeSessionId,
      description,
      hostname,
      started_at: startedAt,
      last_activity: startedAt,
      last_sms_sent: {},
      is_monitoring: true,
    };

    this.client.setAccessToken(response.session_token);
    this.sessionFile = getSessionFilePath(claudeSessionId);
    await ensureSessionDir();
    await this.saveState();
    this.startTimers();

    logger.info(`Session monitoring started: ${response.monitoring_id}`);
  }

  async stopSession(reason: "completed" | "user_stop" | "error" = "user_stop"): Promise<void> {
    if (!this.state?.is_monitoring) {
      throw new Error("No active session to stop");
    }

    stopTimers(this.timerManager);
    await stopSessionOnServer(this.client, this.state.monitoring_id, reason);

    this.state.is_monitoring = false;
    await this.saveState();

    if (this.sessionFile) {
      scheduleSessionFileDeletion(this.sessionFile);
    }

    logger.info("Session monitoring stopped");
  }

  async reportEvent(eventType: "error" | "done" | "waiting", details?: Record<string, unknown>): Promise<void> {
    if (!this.state?.is_monitoring) {
      logger.debug(`Event ${eventType} ignored - no active monitoring`);
      return;
    }

    await reportEventToServer(this.client, this.state.monitoring_id, eventType, details);
  }

  recordActivity(): void {
    if (!this.state?.is_monitoring) return;

    this.state.last_activity = new Date().toISOString();
    resetInactivityTimer(
      this.timerManager,
      () => this.reportEvent("waiting", { reason: "10_minutes_inactivity" }),
      this.getEnv().CLAUDE_SMS_INACTIVITY_THRESHOLD
    );
    this.saveState().catch((err) => logger.error("Failed to save state", err));
  }

  private startTimers(): void {
    startTimers(
      this.timerManager,
      this.state,
      this.client,
      () => this.reportEvent("waiting", { reason: "10_minutes_inactivity" }),
      () => this.getEnv().CLAUDE_SMS_HEARTBEAT_INTERVAL,
      () => this.getEnv().CLAUDE_SMS_INACTIVITY_THRESHOLD
    );
  }

  private async saveState(): Promise<void> {
    if (!this.sessionFile || !this.state) return;
    await saveSessionToFile(this.sessionFile, this.state);
  }

  async loadSession(claudeSessionId: string): Promise<boolean> {
    const sessionFile = getSessionFilePath(claudeSessionId);
    const loadedState = await loadSessionFromFile(sessionFile);

    if (loadedState) {
      this.state = loadedState;
      this.sessionFile = sessionFile;
      this.client.setAccessToken(loadedState.session_token);
      this.startTimers();
      logger.info("Session restored from file");
      return true;
    }
    return false;
  }

  isMonitoring(): boolean {
    return this.state?.is_monitoring ?? false;
  }

  getDescription(): string | null {
    return this.state?.description ?? null;
  }

  private getEnv() {
    const { loadEnv } = require("./utils");
    return loadEnv();
  }
}

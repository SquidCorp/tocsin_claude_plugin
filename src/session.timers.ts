import { SmsApiClient } from "./api-client";
import { SessionState } from "./types";
import { logger } from "./utils";

export interface TimerManager {
  heartbeatInterval: Timer | null;
  inactivityTimer: Timer | null;
}

export function startTimers(
  manager: TimerManager,
  state: SessionState | null,
  client: SmsApiClient,
  onInactivity: () => Promise<void>,
  getHeartbeatInterval: () => number,
  getInactivityThreshold: () => number
): void {
  if (!state?.is_monitoring) return;

  // Heartbeat every 30 seconds
  manager.heartbeatInterval = setInterval(async () => {
    try {
      if (state?.is_monitoring) {
        await client.sendHeartbeat(state.monitoring_id, {
          timestamp: new Date().toISOString(),
          last_activity: state.last_activity,
        });
      }
    } catch (err) {
      logger.error("Heartbeat failed", err);
    }
  }, getHeartbeatInterval());

  // Inactivity check
  resetInactivityTimer(manager, onInactivity, getInactivityThreshold());
}

export function resetInactivityTimer(
  manager: TimerManager,
  onInactivity: () => Promise<void>,
  threshold: number
): void {
  if (manager.inactivityTimer) {
    clearTimeout(manager.inactivityTimer);
  }

  manager.inactivityTimer = setTimeout(async () => {
    logger.info("Inactivity detected, sending waiting notification");
    await onInactivity();
  }, threshold);
}

export function stopTimers(manager: TimerManager): void {
  if (manager.heartbeatInterval) {
    clearInterval(manager.heartbeatInterval);
    manager.heartbeatInterval = null;
  }
  if (manager.inactivityTimer) {
    clearTimeout(manager.inactivityTimer);
    manager.inactivityTimer = null;
  }
}

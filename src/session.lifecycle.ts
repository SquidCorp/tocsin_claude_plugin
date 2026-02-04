import { SessionState } from "./types";
import { SmsApiClient } from "./api-client";
import { logger } from "./utils";

export async function stopSessionOnServer(
  client: SmsApiClient,
  monitoringId: string,
  reason: "completed" | "user_stop" | "error"
): Promise<void> {
  let finalState: "success" | "error" | "cancelled" = "cancelled";
  if (reason === "completed") finalState = "success";
  if (reason === "error") finalState = "error";

  try {
    await client.stopSession(monitoringId, {
      reason,
      final_state: finalState,
      ended_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Failed to notify server of session stop", err);
  }
}

export function determineFinalState(
  reason: "completed" | "user_stop" | "error"
): "success" | "error" | "cancelled" {
  if (reason === "completed") return "success";
  if (reason === "error") return "error";
  return "cancelled";
}

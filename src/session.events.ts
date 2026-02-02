import type { EventRequest } from './types';
import type { SmsApiClient } from './api-client';
import { logger } from './utils';

export async function reportEventToServer(
  client: SmsApiClient,
  monitoringId: string,
  eventType: 'error' | 'done' | 'waiting',
  details?: Record<string, unknown>,
): Promise<{ smsSent: boolean; rateLimited: boolean }> {
  const request: EventRequest = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  try {
    const response = await client.reportEvent(monitoringId, request);

    if (response.sms_sent) {
      logger.info(`SMS sent for ${eventType} event`);
    } else if (response.rate_limited) {
      logger.debug(`SMS rate limited for ${eventType}`);
    }

    return {
      smsSent: response.sms_sent ?? false,
      rateLimited: response.rate_limited ?? false,
    };
  } catch (err) {
    logger.error(`Failed to report ${eventType} event`, err);
    return { smsSent: false, rateLimited: false };
  }
}

import {
  AuthToken,
  StartSessionRequest,
  StartSessionResponse,
  EventRequest,
  EventResponse,
  HeartbeatRequest,
  StopSessionRequest,
  ApiError,
  ApiErrorSchema,
} from "./types";
import { logger } from "./utils";

export class SmsApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(authUrl: string) {
    this.baseUrl = authUrl.replace(/\/$/, "");
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        const error = ApiErrorSchema.safeParse(data);
        if (error.success) {
          throw new SmsApiError(error.data);
        }
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      }

      return data as T;
    } catch (err) {
      logger.error(`API request failed: ${endpoint}`, err);
      throw err;
    }
  }

  // Exchange pairing code for auth token
  async exchangePairingCode(
    tempToken: string,
    pairingCode: string,
    deviceFingerprint: string
  ): Promise<AuthToken> {
    return this.request<AuthToken>("/auth/exchange", {
      method: "POST",
      body: JSON.stringify({
        temp_token: tempToken,
        pairing_code: pairingCode,
        device_fingerprint: deviceFingerprint,
      }),
    });
  }

  // Refresh access token
  async refreshToken(): Promise<AuthToken> {
    return this.request<AuthToken>("/auth/refresh", {
      method: "POST",
    });
  }

  // Start session monitoring
  async startSession(
    request: StartSessionRequest
  ): Promise<StartSessionResponse> {
    return this.request<StartSessionResponse>("/sessions/start", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Report event (error, done, waiting)
  async reportEvent(
    monitoringId: string,
    request: EventRequest
  ): Promise<EventResponse> {
    return this.request<EventResponse>(
      `/sessions/${monitoringId}/events`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  // Send heartbeat
  async sendHeartbeat(
    monitoringId: string,
    request: HeartbeatRequest
  ): Promise<void> {
    await this.request<void>(`/sessions/${monitoringId}/heartbeat`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Stop session monitoring
  async stopSession(
    monitoringId: string,
    request: StopSessionRequest
  ): Promise<void> {
    await this.request<void>(`/sessions/${monitoringId}/stop`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Logout / revoke token
  async logout(): Promise<void> {
    await this.request<void>("/auth/logout", {
      method: "POST",
    });
  }
}

export class SmsApiError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
    this.name = "SmsApiError";
  }
}

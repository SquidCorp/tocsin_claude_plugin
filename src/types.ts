import { z } from 'zod/v4';

// Environment variables schema
export const EnvSchema = z.object({
  CLAUDE_SMS_AUTH_URL: z.string().url(),
  CLAUDE_SMS_HEARTBEAT_INTERVAL: z.coerce.number().default(30000),
  CLAUDE_SMS_INACTIVITY_THRESHOLD: z.coerce.number().default(600000),
  CLAUDE_SMS_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

// Token storage
export const AuthTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  expires_at: z.string().datetime(),
  phone: z.string(),
});

export type AuthToken = z.infer<typeof AuthTokenSchema>;

// Session state
export const SessionStateSchema = z.object({
  monitoring_id: z.string(),
  session_token: z.string(),
  claude_session_id: z.string(),
  description: z.string(),
  hostname: z.string(),
  started_at: z.string().datetime(),
  last_activity: z.string().datetime(),
  last_sms_sent: z.object({
    error: z.string().datetime().optional(),
    done: z.string().datetime().optional(),
    waiting: z.string().datetime().optional(),
  }).default({}),
  is_monitoring: z.boolean(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

// API Request/Response schemas
export const StartSessionRequestSchema = z.object({
  claude_session_id: z.string(),
  description: z.string().max(100),
  hostname: z.string(),
  started_at: z.string().datetime(),
});

export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export const StartSessionResponseSchema = z.object({
  session_token: z.string(),
  monitoring_id: z.string(),
});

export type StartSessionResponse = z.infer<typeof StartSessionResponseSchema>;

export const EventRequestSchema = z.object({
  event_type: z.enum(['error', 'done', 'waiting']),
  timestamp: z.string().datetime(),
  details: z.record(z.unknown()).optional(),
});

export type EventRequest = z.infer<typeof EventRequestSchema>;

export const EventResponseSchema = z.object({
  sms_sent: z.boolean(),
  sms_id: z.string().optional(),
  rate_limited: z.boolean(),
  next_allowed_at: z.string().datetime().optional(),
});

export type EventResponse = z.infer<typeof EventResponseSchema>;

export const HeartbeatRequestSchema = z.object({
  timestamp: z.string().datetime(),
  last_activity: z.string().datetime(),
});

export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>;

export const StopSessionRequestSchema = z.object({
  reason: z.enum(['completed', 'user_stop', 'error']),
  final_state: z.enum(['success', 'error', 'cancelled']),
  ended_at: z.string().datetime(),
});

export type StopSessionRequest = z.infer<typeof StopSessionRequestSchema>;

// Error response
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  request_id: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export type ApiError = z.infer<typeof ApiErrorSchema>;

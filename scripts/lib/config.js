#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration directory
export const CONFIG_DIR = path.join(process.env.HOME, '.config/tocsin');

// Server URL
export const SERVER_URL = process.env.CLAUDE_SMS_SERVER_URL || 'http://localhost:3000';

// Heartbeat configuration
export const HEARTBEAT_INTERVAL = parseInt(process.env.CLAUDE_SMS_HEARTBEAT_INTERVAL || '30000', 10);

// File paths
export const FILES = {
  AUTH: path.join(CONFIG_DIR, 'auth.json'),
  SESSION: path.join(CONFIG_DIR, 'session.json'),
  SETUP_ID: path.join(CONFIG_DIR, '.setup_id'),
  TEMP_TOKEN: path.join(CONFIG_DIR, '.temp_token'),
  HEARTBEAT_PID: path.join(CONFIG_DIR, 'heartbeat.pid'),
  HEARTBEAT_LOG: path.join(CONFIG_DIR, 'heartbeat.log')
};

// Error patterns for blocking detection
export const BLOCKING_PATTERNS = /permission denied|rate limit|fatal|crash|connection refused|unauthorized|authentication failed/i;

// Phone validation (E.164 format)
export const PHONE_REGEX = /^\+[1-9][0-9]{1,14}$/;

// Log levels
export const LOG_LEVEL = process.env.CLAUDE_SMS_LOG_LEVEL || 'info';

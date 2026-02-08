#!/usr/bin/env node

import { FILES } from './config.js';
import { fileExists, deleteFile } from './files.js';

/**
 * Handle authentication errors by logging out the user
 * @param {object} options - Configuration options
 * @param {boolean} options.silent - If true, don't display console messages (for hooks)
 * @param {string} options.context - Name of the calling script (for logging)
 */
export function handleAuthenticationError(options = {}) {
  const { silent = false, context = 'unknown' } = options;

  // 1. Delete auth.json (logout)
  if (fileExists(FILES.AUTH)) {
    deleteFile(FILES.AUTH);
  }

  // 2. Display message (unless silent mode)
  if (!silent) {
    console.log('\n⚠️  Authentication Failed');
    console.log('Your session has expired or your token is invalid.');
    console.log('Please re-authenticate with: /sms-login +1234567890');
    console.log('');
  }

  // 3. Log for debugging (use console.error for async contexts)
  console.error(`[${new Date().toISOString()}] Authentication error in ${context}, logged out user`);
}

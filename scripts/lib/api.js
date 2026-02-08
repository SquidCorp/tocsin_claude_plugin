#!/usr/bin/env node

import { SERVER_URL } from './config.js';

/**
 * Custom error class for authentication failures (401)
 */
export class AuthenticationError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

/**
 * Make an HTTP request to the SMS server
 * @param {string} endpoint - API endpoint (e.g., '/sessions/start')
 * @param {object} options - Fetch options
 * @param {string} options.method - HTTP method
 * @param {object} options.headers - Additional headers
 * @param {object} options.body - Request body (will be JSON stringified)
 * @param {string} options.token - Auth token for Authorization header
 * @returns {Promise<object>} Response data
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${SERVER_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add authorization header if token provided
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  // Add body if provided
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchOptions);

    // Try to parse JSON response
    let data;
    try {
      data = await response.json();
    } catch {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      // Check for 401 Unauthorized - authentication failed
      if (response.status === 401) {
        throw new AuthenticationError('Authentication failed: token expired or invalid', 401);
      }

      // Generic error handling for other status codes
      const errorMessage = data.error || data.message || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    // Re-throw with more context
    if (error.message.includes('fetch failed')) {
      throw new Error(`Cannot connect to server at ${SERVER_URL}`);
    }
    throw error;
  }
}

/**
 * Make an authenticated API request using token from auth.json
 * @param {string} endpoint - API endpoint
 * @param {string} token - Auth token
 * @param {object} options - Additional fetch options
 * @returns {Promise<object>} Response data
 */
export async function authenticatedRequest(endpoint, token, options = {}) {
  return apiRequest(endpoint, {
    ...options,
    token
  });
}

#!/usr/bin/env node

/**
 * Read and parse JSON from stdin
 * According to Claude Code official documentation, hooks receive JSON data via stdin
 * @returns {Promise<object>} Parsed hook input
 */
export async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Failed to parse hook input JSON: ${error.message}`));
      }
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Extract common hook fields from input
 * All hook events receive these standard fields
 * @param {object} input - Parsed hook input
 * @returns {object} Common fields
 */
export function extractCommonFields(input) {
  return {
    sessionId: input.session_id || '',
    transcriptPath: input.transcript_path || '',
    cwd: input.cwd || '',
    permissionMode: input.permission_mode || '',
    hookEventName: input.hook_event_name || ''
  };
}

/**
 * Error filtering configuration
 * Only report errors that are blocking/need user attention
 */

// Error patterns that indicate blocking issues (should trigger SMS)
export const BLOCKING_ERROR_PATTERNS = [
  // Permission/auth issues
  /permission denied/i,
  /access denied/i,
  /authentication failed/i,
  /unauthorized/i,
  /403 forbidden/i,
  
  // Connection issues (can't proceed)
  /connection refused/i,
  /connection timed out/i,
  /network unreachable/i,
  /econnrefused/i,
  
  // Fatal errors
  /fatal error/i,
  /panic:/i,
  /segmentation fault/i,
  /core dumped/i,
  
  // Resource exhaustion
  /out of memory/i,
  /no space left/i,
  /disk full/i,
  
  // Command/tool not available
  /command not found/i,
  /not installed/i,
  /is not recognized/i,
  
  // API rate limiting (user needs to wait or upgrade)
  /rate limit exceeded/i,
  /too many requests/i,
  /quota exceeded/i,
  
  // Claude-specific: token/rate limit errors
  /maximum context length/i,
  /token limit exceeded/i,
  /context window full/i,
  /rate limit.*claude/i,
  /billing.*quota/i,
  /insufficient.*quota/i,
  
  // Git errors that block
  /merge conflict/i,
  /unresolved conflict/i,
  /needs merge/i,
  
  // Build/compile errors that stop progress
  /compilation failed/i,
  /build failed/i,
  /syntax error/i,
];

// Error patterns to ignore (Claude handles gracefully, will retry/fix)
export const IGNORE_ERROR_PATTERNS = [
  // File not found - Claude will often try alternatives
  /file.*not found.*but/i,
  /no such file.*trying/i,
  
  // Minor network issues - Claude retries
  /network timeout.*retrying/i,
  /temporary failure.*retry/i,
  
  // Warnings that aren't blocking
  /warning:/i,
  /deprecated/i,
  
  // Claude's own internal handling
  /let me try/i,
  /i'll try/i,
  /attempting alternative/i,
];

/**
 * Check if an error is blocking and should trigger SMS
 */
export function isBlockingError(errorMessage: string): boolean {
  // First check if it's explicitly ignorable
  for (const pattern of IGNORE_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return false;
    }
  }
  
  // Then check if it's blocking
  for (const pattern of BLOCKING_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return true;
    }
  }
  
  // Default: non-blocking (Claude usually handles unknown errors)
  return false;
}

/**
 * Categorize error for better SMS messages
 */
export function categorizeError(errorMessage: string): string {
  if (/rate limit|quota|token.*limit|maximum context/i.test(errorMessage)) {
    return "rate_limit";
  }
  if (/permission|access|unauthorized|forbidden/i.test(errorMessage)) {
    return "permission";
  }
  if (/connection|network/i.test(errorMessage)) {
    return "network";
  }
  if (/fatal|panic|segmentation/i.test(errorMessage)) {
    return "fatal";
  }
  return "error";
}

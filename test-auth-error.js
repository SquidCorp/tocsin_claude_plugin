#!/usr/bin/env node

/**
 * Test script for centralized 401 authentication error handling
 *
 * This script verifies that:
 * 1. AuthenticationError is properly exported and throwable
 * 2. handleAuthenticationError function works correctly
 * 3. Mock API requests properly detect and throw 401 errors
 */

import { AuthenticationError } from './scripts/lib/api.js';
import { handleAuthenticationError } from './scripts/lib/auth-utils.js';
import { FILES } from './scripts/lib/config.js';
import { writeJSON, fileExists, deleteFile } from './scripts/lib/files.js';

console.log('Testing Centralized 401 Authentication Error Handling');
console.log('='.repeat(60));
console.log('');

// Test 1: AuthenticationError class
console.log('Test 1: AuthenticationError class');
try {
  const error = new AuthenticationError('Token expired', 401);
  console.log('  ✓ AuthenticationError created successfully');
  console.log(`    - name: ${error.name}`);
  console.log(`    - message: ${error.message}`);
  console.log(`    - statusCode: ${error.statusCode}`);

  if (error instanceof AuthenticationError) {
    console.log('  ✓ instanceof check works');
  } else {
    console.log('  ✗ instanceof check failed');
    process.exit(1);
  }

  if (error instanceof Error) {
    console.log('  ✓ extends Error class');
  } else {
    console.log('  ✗ does not extend Error');
    process.exit(1);
  }
} catch (error) {
  console.log(`  ✗ Failed to create AuthenticationError: ${error.message}`);
  process.exit(1);
}

console.log('');

// Test 2: handleAuthenticationError with silent mode
console.log('Test 2: handleAuthenticationError (silent mode)');
try {
  // Create a fake auth.json for testing
  const fakeAuth = {
    access_token: 'fake-token-for-testing',
    phone: '+1234567890',
    expires_at: '2026-12-31T23:59:59Z'
  };

  writeJSON(FILES.AUTH, fakeAuth);
  console.log('  ✓ Created fake auth.json');

  // Verify it exists
  if (fileExists(FILES.AUTH)) {
    console.log('  ✓ auth.json exists before handler');
  } else {
    console.log('  ✗ auth.json was not created');
    process.exit(1);
  }

  // Call handler in silent mode
  handleAuthenticationError({ silent: true, context: 'test-script' });
  console.log('  ✓ handleAuthenticationError called (silent mode)');

  // Verify auth.json was deleted
  if (!fileExists(FILES.AUTH)) {
    console.log('  ✓ auth.json deleted successfully');
  } else {
    console.log('  ✗ auth.json still exists after handler');
    process.exit(1);
  }
} catch (error) {
  console.log(`  ✗ Test failed: ${error.message}`);
  process.exit(1);
}

console.log('');

// Test 3: handleAuthenticationError with message display (visual check)
console.log('Test 3: handleAuthenticationError (with message)');
console.log('  Expected output:');
console.log('  --------------');
try {
  // Create fake auth.json again
  const fakeAuth = {
    access_token: 'fake-token-for-testing',
    phone: '+1234567890',
    expires_at: '2026-12-31T23:59:59Z'
  };

  writeJSON(FILES.AUTH, fakeAuth);

  // Call handler with message display
  handleAuthenticationError({ silent: false, context: 'test-script-verbose' });

  console.log('  --------------');
  console.log('  ✓ Handler executed (check output above)');

  // Verify auth.json was deleted
  if (!fileExists(FILES.AUTH)) {
    console.log('  ✓ auth.json deleted successfully');
  } else {
    console.log('  ✗ auth.json still exists');
    process.exit(1);
  }
} catch (error) {
  console.log(`  ✗ Test failed: ${error.message}`);
  process.exit(1);
}

console.log('');

// Test 4: Error handling pattern (simulated)
console.log('Test 4: Simulated error handling pattern');
try {
  async function simulateApiCall() {
    // Simulate a 401 response
    throw new AuthenticationError('Authentication failed: token expired or invalid', 401);
  }

  let caught = false;

  try {
    await simulateApiCall();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log('  ✓ AuthenticationError caught correctly');
      caught = true;

      // In real code, we'd call handleAuthenticationError here
      // For testing, just verify the error properties
      if (error.statusCode === 401) {
        console.log('  ✓ statusCode is 401');
      } else {
        console.log(`  ✗ statusCode is ${error.statusCode}, expected 401`);
        process.exit(1);
      }

      if (error.name === 'AuthenticationError') {
        console.log('  ✓ error.name is AuthenticationError');
      } else {
        console.log(`  ✗ error.name is ${error.name}`);
        process.exit(1);
      }
    } else {
      console.log('  ✗ Caught wrong error type');
      process.exit(1);
    }
  }

  if (!caught) {
    console.log('  ✗ Error was not caught');
    process.exit(1);
  }
} catch (error) {
  console.log(`  ✗ Test failed: ${error.message}`);
  process.exit(1);
}

console.log('');

// Cleanup
console.log('Cleanup');
if (fileExists(FILES.AUTH)) {
  deleteFile(FILES.AUTH);
  console.log('  ✓ Cleaned up any remaining auth.json');
} else {
  console.log('  ✓ No cleanup needed');
}

console.log('');
console.log('='.repeat(60));
console.log('✅ All tests passed!');
console.log('');
console.log('Next steps:');
console.log('1. Test with actual server (expire token manually)');
console.log('2. Test hooks silently handle 401 errors');
console.log('3. Test daemon exits on 401 errors');
console.log('4. Test /sms-status shows expired token warning');

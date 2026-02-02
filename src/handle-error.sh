#!/bin/bash
# Handle PostToolUseFailure hook
# This script is called when a Claude tool fails

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Run the TypeScript handler
bun run handle-error.ts

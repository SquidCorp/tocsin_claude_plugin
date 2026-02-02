#!/bin/bash
# Handle SessionEnd hook
# This script notifies that the session has completed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

bun run handle-session-end.ts

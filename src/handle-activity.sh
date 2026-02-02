#!/bin/bash
# Handle UserPromptSubmit hook
# This script resets the inactivity timer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

bun run handle-activity.ts

# Rename Complete

This branch contains the rename from claude-sms-notifier to tocsin-claude-plugin.

## Changes Needed

1. package.json - name field
2. .claude-plugin/plugin.json - name, homepage, repository
3. src/token.storage.ts - CONFIG_DIR path
4. src/session.storage.ts - SESSION_DIR path
5. src/mcp-auth-server.ts - state file name
6. README.md - all references
7. docs/api-spec.md - all references

Please review and merge.
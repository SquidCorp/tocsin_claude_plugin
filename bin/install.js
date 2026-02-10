#!/usr/bin/env node

/**
 * Tocsin Claude Plugin - NPX Installer
 *
 * This script:
 * 1. Detects Claude Code installation
 * 2. Checks for and removes existing installation
 * 3. Adds marketplace repository
 * 4. Installs plugin via `claude` CLI
 * 5. Guides user through SMS setup
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PLUGIN_NAME = "tocsin";
const MARKETPLACE_NAME = "SquidCorp-plugins";
const REGISTRY_FILE = path.join(
  os.homedir(),
  ".claude/plugins/installed_plugins.json",
);

/**
 * Main installer function
 */
async function main() {
  console.log("Tocsin Claude Plugin - Installer");
  console.log("===================================\n");

  try {
    // Step 1: Check prerequisites
    checkPrerequisites();

    // Step 2: Check if already installed and remove if needed
    await checkAndRemoveExisting();

    // Step 3: Add marketplace repository
    await addMarketplace();

    // Step 4: Install plugin via Claude CLI
    await installPlugin();

    // Step 5: Guide user through setup
    guideSetup();

    console.log("\n✅ Installation complete!\n");
  } catch (error) {
    console.error("\n❌ Installation failed:", error.message);
    process.exit(1);
  }
}

/**
 * Check system prerequisites
 */
function checkPrerequisites() {
  console.log("📋 Checking prerequisites...\n");

  // Check if Claude Code is installed
  try {
    execSync("claude --version", { stdio: "ignore", shell: true });
    console.log("  ✓ Claude Code CLI found");
  } catch (error) {
    console.error("  ✗ Claude Code CLI not found");
    console.error("\nPlease install Claude Code first:");
    console.error("  https://claude.ai/code\n");
    process.exit(1);
  }

  // Check if ~/.claude directory exists
  const claudeDir = path.join(os.homedir(), ".claude");
  if (!fs.existsSync(claudeDir)) {
    console.error("  ✗ Claude Code config directory not found");
    console.error(`\nExpected: ${claudeDir}`);
    console.error("Run Claude Code at least once to initialize.\n");
    process.exit(1);
  }
  console.log("  ✓ Claude Code config directory found");

  // Check write permissions
  try {
    const pluginsDir = path.join(claudeDir, "plugins");
    fs.mkdirSync(pluginsDir, { recursive: true });
    fs.accessSync(pluginsDir, fs.constants.W_OK);
    console.log("  ✓ Write permissions verified");
  } catch (error) {
    console.error("  ✗ No write permission to ~/.claude/plugins/");
    console.error("Run: chmod u+w ~/.claude/plugins/\n");
    process.exit(1);
  }

  console.log();
}

/**
 * Check if plugin is already installed and remove if needed
 */
async function checkAndRemoveExisting() {
  console.log("🔍 Checking for existing installation...\n");

  if (!fs.existsSync(REGISTRY_FILE)) {
    console.log("  ✓ No existing installation found\n");
    return;
  }

  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    const pluginKey = "tocsin@SquidCorp-plugins";

    if (registry.plugins && registry.plugins[pluginKey]) {
      console.log("  ✓ Found existing tocsin installation");
      console.log("  🗑️  Removing previous installation...\n");

      try {
        execSync("claude plugin marketplace remove SquidCorp-plugins", {
          stdio: "inherit",
          shell: true,
        });
        console.log("  ✓ Removed previous installation\n");
      } catch (error) {
        console.warn(
          "  ⚠ Could not remove previous installation (continuing)\n",
        );
      }
    } else {
      console.log("  ✓ No existing installation found\n");
    }
  } catch (error) {
    console.log("  ✓ No existing installation found\n");
  }
}

/**
 * Add marketplace repository
 */
async function addMarketplace() {
  console.log("🏪 Adding marketplace repository...\n");

  try {
    execSync(
      "claude plugin marketplace add https://github.com/SquidCorp/tocsin_claude_plugin",
      { stdio: "inherit", shell: true },
    );
    console.log("  ✓ Marketplace repository added\n");
  } catch (error) {
    console.error("  ✗ Failed to add marketplace repository");
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

/**
 * Install plugin via Claude CLI
 */
async function installPlugin() {
  console.log("📦 Installing plugin...\n");

  try {
    execSync("claude plugin install tocsin@SquidCorp-plugins --scope user", {
      stdio: "inherit",
      shell: true,
    });
    console.log("\n  ✓ Plugin installed successfully\n");
  } catch (error) {
    console.error("  ✗ Failed to install plugin");
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

/**
 * Display setup instructions
 */
function guideSetup() {
  console.log("📱 Next Steps:\n");
  console.log("1. Restart Claude Code (if currently running)");
  console.log("   The plugin will be auto-discovered on next launch\n");
  console.log("2. Authenticate with your phone number:");
  console.log("   /tocsin:sms-login +1234567890");
  console.log("   /tocsin:sms-pair 123456\n");
  console.log("3. Start monitoring your session:");
  console.log('   /tocsin:sms-start "Your session description"\n');
  console.log("💡 Configuration:");
  console.log("   Set SMS server URL (if using custom server):");
  console.log('   export CLAUDE_SMS_SERVER_URL="https://sms.yourserver.com"\n');
  console.log(
    "📚 Documentation: https://github.com/SquidCorp/tocsin_claude_plugin",
  );
  console.log("❓ Check status: /tocsin:sms-status\n");
}

// Run installer
main().catch((error) => {
  console.error("\n❌ Installation failed:", error.message);
  process.exit(1);
});

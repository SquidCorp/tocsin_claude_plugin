#!/usr/bin/env node

/**
 * Tocsin Claude Plugin - NPX Installer
 *
 * This script:
 * 1. Detects Claude Code installation
 * 2. Copies plugin files to ~/.claude/plugins/
 * 3. Installs plugin via `claude` CLI
 * 4. Guides user through SMS setup
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PLUGIN_NAME = "tocsin";
const PLUGIN_VERSION = "1.0.0";
// Claude Code caches plugins in this structure
const PLUGIN_DIR = path.join(
  os.homedir(),
  ".claude/plugins/cache/local",
  PLUGIN_NAME,
  PLUGIN_VERSION
);
const SOURCE_DIR = path.join(__dirname, "..");

/**
 * Main installer function
 */
async function main() {
  console.log("🦞 Tocsin Claude Plugin - Installer");
  console.log("===================================\n");

  try {
    // Step 1: Check prerequisites
    checkPrerequisites();

    // Step 2: Copy plugin files
    copyPluginFiles();

    // Step 3: Install plugin in Claude Code
    installPlugin();

    // Step 4: Guide user through setup
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
 * Copy plugin files to installation directory
 */
function copyPluginFiles() {
  console.log("📂 Copying plugin files...\n");

  // Clean up old orphaned installation if it exists
  const oldPluginDir = path.join(os.homedir(), ".claude", "plugins", "tocsin-claude-plugin");
  if (fs.existsSync(oldPluginDir)) {
    try {
      fs.rmSync(oldPluginDir, { recursive: true, force: true });
      console.log("  ✓ Cleaned up old installation");
    } catch (error) {
      // Continue even if cleanup fails
    }
  }

  // Create plugin directory (Claude Code cache structure)
  if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  }

  // Copy directories
  const directories = [".claude-plugin", "commands", "scripts", "hooks"];

  directories.forEach((dir) => {
    const src = path.join(SOURCE_DIR, dir);
    const dest = path.join(PLUGIN_DIR, dir);

    if (fs.existsSync(src)) {
      copyRecursiveSync(src, dest);
      console.log(`  ✓ Copied ${dir}/`);
    }
  });

  // Copy files
  const files = ["LICENSE", "README.md"];
  files.forEach((file) => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(PLUGIN_DIR, file);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  ✓ Copied ${file}`);
    }
  });

  // Make scripts executable
  makeScriptsExecutable(PLUGIN_DIR);

  console.log();
}

/**
 * Recursively copy directories
 */
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Make all scripts in scripts/ directory executable
 */
function makeScriptsExecutable(pluginDir) {
  const scriptsDir = path.join(pluginDir, "scripts");
  if (fs.existsSync(scriptsDir)) {
    fs.readdirSync(scriptsDir).forEach((file) => {
      if (file.endsWith(".js") || file.endsWith(".sh")) {
        const scriptPath = path.join(scriptsDir, file);
        fs.chmodSync(scriptPath, 0o755);
      }
    });
    console.log("  ✓ Made scripts executable");
  }
}

/**
 * Verify plugin installation
 */
function installPlugin() {
  console.log("🔧 Verifying plugin installation...\n");

  // Check if plugin files exist
  const pluginJsonPath = path.join(PLUGIN_DIR, ".claude-plugin", "plugin.json");
  const hooksPath = path.join(PLUGIN_DIR, "hooks", "hooks.json");

  if (!fs.existsSync(pluginJsonPath)) {
    console.error("  ✗ Plugin manifest not found");
    process.exit(1);
  }

  if (!fs.existsSync(hooksPath)) {
    console.error("  ✗ Hooks configuration not found");
    process.exit(1);
  }

  // Remove orphaned marker if it exists
  const orphanedMarker = path.join(PLUGIN_DIR, ".orphaned_at");
  if (fs.existsSync(orphanedMarker)) {
    try {
      fs.unlinkSync(orphanedMarker);
    } catch (error) {
      // Continue if we can't remove it
    }
  }

  console.log("  ✓ Plugin files verified");
  console.log(`  ✓ Installed to: ${PLUGIN_DIR}`);
  console.log();
}

/**
 * Display setup instructions
 */
function guideSetup() {
  console.log("📱 Next Steps:\n");
  console.log("1. Restart Claude Code (so it discovers the plugin)");
  console.log("2. Run: /sms-login +1234567890");
  console.log("3. Enter the SMS code: /sms-pair 123456");
  console.log('4. Start monitoring: /sms-start "Your session description"\n');
  console.log("For help: /sms-status\n");
  console.log(
    "Documentation: https://github.com/SquidCorp/tocsin_claude_plugin\n"
  );
}

// Run installer
main().catch((error) => {
  console.error("\n❌ Installation failed:", error.message);
  process.exit(1);
});

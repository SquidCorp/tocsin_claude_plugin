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
const MARKETPLACE_NAME = "local";

// SOURCE_DIR is where this npm package is installed (when run via npx, this is in the npm cache)
const SOURCE_DIR = path.join(__dirname, "..");

// Target installation directory in Claude Code's cache
const INSTALL_DIR = path.join(
  os.homedir(),
  ".claude/plugins/cache",
  MARKETPLACE_NAME,
  PLUGIN_NAME,
  PLUGIN_VERSION
);

// Claude Code's plugin registry file
const REGISTRY_FILE = path.join(
  os.homedir(),
  ".claude/plugins/installed_plugins.json"
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

    // Step 2: Clean up old installations
    cleanupOldInstallations();

    // Step 3: Copy plugin files to install directory
    copyPluginFiles();

    // Step 4: Make scripts executable
    makeScriptsExecutable(INSTALL_DIR);

    // Step 5: Register plugin in Claude Code
    registerPlugin();

    // Step 6: Guide user through setup
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
 * Clean up old plugin installations
 */
function cleanupOldInstallations() {
  console.log("🧹 Cleaning up old installations...\n");

  // Unregister from plugin registry first
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
      const pluginKey = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

      if (registry.plugins && registry.plugins[pluginKey]) {
        delete registry.plugins[pluginKey];
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
        console.log("  ✓ Unregistered previous version from registry");
      }
    }
  } catch (error) {
    // Continue if we can't update registry
  }

  // Remove old installation directories
  const oldLocations = [
    INSTALL_DIR, // Current install location
    path.join(os.homedir(), ".claude", "plugins", "tocsin-claude-plugin"),
    path.join(os.homedir(), ".claude", "plugins", "tocsin"),
  ];

  let cleaned = false;
  oldLocations.forEach((dir) => {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`  ✓ Removed ${path.basename(dir)}`);
        cleaned = true;
      } catch (error) {
        // Continue even if cleanup fails
      }
    }
  });

  if (!cleaned) {
    console.log("  ✓ No old installations found");
  }

  console.log();
}

/**
 * Copy plugin files to installation directory
 */
function copyPluginFiles() {
  console.log("📂 Installing plugin files...\n");

  // Create install directory
  fs.mkdirSync(INSTALL_DIR, { recursive: true });

  // Copy directories
  const directories = [".claude-plugin", "commands", "scripts", "hooks"];

  directories.forEach((dir) => {
    const src = path.join(SOURCE_DIR, dir);
    const dest = path.join(INSTALL_DIR, dir);

    if (fs.existsSync(src)) {
      copyRecursiveSync(src, dest);
      console.log(`  ✓ Copied ${dir}/`);
    } else {
      console.warn(`  ⚠ Missing ${dir}/ directory`);
    }
  });

  // Copy files
  const files = ["LICENSE", "README.md"];
  files.forEach((file) => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(INSTALL_DIR, file);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  ✓ Copied ${file}`);
    }
  });

  console.log(`\n  📁 Installed to: ${INSTALL_DIR}\n`);
}

/**
 * Recursively copy directory
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
 * Make all scripts executable
 */
function makeScriptsExecutable(pluginDir) {
  console.log("🔐 Setting script permissions...\n");

  const scriptsDir = path.join(pluginDir, "scripts");
  let count = 0;

  if (fs.existsSync(scriptsDir)) {
    // Make all .js files in scripts/ executable
    const processDir = (dir) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          processDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          try {
            fs.chmodSync(fullPath, 0o755);
            count++;
          } catch (error) {
            console.warn(`  ⚠ Could not set permissions for ${entry.name}`);
          }
        }
      });
    };

    processDir(scriptsDir);
    console.log(`  ✓ Made ${count} scripts executable\n`);
  } else {
    console.warn("  ⚠ Scripts directory not found\n");
  }
}

/**
 * Register plugin in Claude Code's registry
 */
function registerPlugin() {
  console.log("🔧 Registering plugin with Claude Code...\n");

  // Verify plugin files were installed
  const pluginJsonPath = path.join(
    INSTALL_DIR,
    ".claude-plugin",
    "plugin.json"
  );
  const hooksPath = path.join(INSTALL_DIR, "hooks", "hooks.json");

  if (!fs.existsSync(pluginJsonPath)) {
    console.error("  ✗ Plugin manifest not found");
    console.error(`  Expected: ${pluginJsonPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(hooksPath)) {
    console.error("  ✗ Hooks configuration not found");
    console.error(`  Expected: ${hooksPath}`);
    process.exit(1);
  }

  // Read or create registry file
  let registry;
  if (fs.existsSync(REGISTRY_FILE)) {
    try {
      registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    } catch (error) {
      console.error("  ✗ Failed to read plugin registry");
      console.error(`  ${error.message}`);
      process.exit(1);
    }
  } else {
    // Create new registry file
    registry = {
      version: 2,
      plugins: {},
    };
  }

  // Add plugin entry
  const pluginKey = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;
  const now = new Date().toISOString();

  registry.plugins[pluginKey] = [
    {
      scope: "user",
      installPath: INSTALL_DIR,
      version: PLUGIN_VERSION,
      installedAt: now,
      lastUpdated: now,
      gitCommitSha: null,
      projectPath: null,
    },
  ];

  // Write registry file
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
    console.log(`  ✓ Registered ${pluginKey}`);
    console.log(`  ✓ Plugin will be available after Claude Code restart\n`);
  } catch (error) {
    console.error("  ✗ Failed to update plugin registry");
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
  console.log("   /sms-login +1234567890");
  console.log("   /sms-pair 123456\n");
  console.log("3. Start monitoring your session:");
  console.log('   /sms-start "Your session description"\n');
  console.log("💡 Configuration:");
  console.log("   Set SMS server URL (if using custom server):");
  console.log('   export CLAUDE_SMS_SERVER_URL="https://sms.yourserver.com"\n');
  console.log(
    "📚 Documentation: https://github.com/SquidCorp/tocsin_claude_plugin"
  );
  console.log("❓ Check status: /sms-status\n");
}

// Run installer
main().catch((error) => {
  console.error("\n❌ Installation failed:", error.message);
  process.exit(1);
});

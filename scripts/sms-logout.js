#!/usr/bin/env node

import { FILES } from "./lib/config.js";
import { deleteFile, fileExists } from "./lib/files.js";

console.log("🔕 Logging out...");

if (fileExists(FILES.AUTH)) {
  deleteFile(FILES.AUTH);
  console.log("✅ Logged out.");
} else {
  console.log("Already logged out.");
}

console.log("");
console.log("Run /tocsin:sms-login to authenticate again.");

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Read and parse a JSON file
 * @param {string} filepath - Path to JSON file
 * @returns {object|null} Parsed JSON or null if file doesn't exist/invalid
 */
export function readJSON(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Write data to JSON file with secure permissions (600)
 * @param {string} filepath - Path to JSON file
 * @param {object} data - Data to write
 */
export function writeJSON(filepath, data) {
  // Ensure directory exists
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });

  // Write file with 600 permissions
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filepath, content, { mode: 0o600 });
}

/**
 * Write text to file with secure permissions (600)
 * @param {string} filepath - Path to file
 * @param {string} text - Text content to write
 */
export function writeText(filepath, text) {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, text, { mode: 0o600 });
}

/**
 * Read text from file
 * @param {string} filepath - Path to file
 * @returns {string|null} File content or null if doesn't exist
 */
export function readText(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf8').trim();
  } catch (error) {
    return null;
  }
}

/**
 * Delete file if it exists
 * @param {string} filepath - Path to file
 */
export function deleteFile(filepath) {
  try {
    fs.unlinkSync(filepath);
  } catch (error) {
    // Ignore error if file doesn't exist
  }
}

/**
 * Check if file exists
 * @param {string} filepath - Path to file
 * @returns {boolean} True if file exists
 */
export function fileExists(filepath) {
  try {
    fs.accessSync(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 * @param {string} dirpath - Path to directory
 */
export function ensureDir(dirpath) {
  fs.mkdirSync(dirpath, { recursive: true });
}

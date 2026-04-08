import { promises as fs } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE_PREFIX = "proxy-";
const LOG_DATE_FORMAT = "%Y-%m-%d";
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const LOG_ROTATION_INTERVAL = 86400000; // 24 hours in ms

let currentLogFile = null;
let lastRotationTime = Date.now();
let logQueue = [];
let isFlushing = false;

/**
 * Get current date string for log filename
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get current timestamp string
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Get log file path for current date
 */
function getLogFilePath() {
  const date = getDateString();
  return join(LOG_DIR, `${LOG_FILE_PREFIX}${date}.log`);
}

/**
 * Rotate log file if needed (size or time based)
 */
async function rotateIfNeeded() {
  const now = Date.now();
  
  // Check time-based rotation
  if (now - lastRotationTime > LOG_ROTATION_INTERVAL) {
    currentLogFile = null;
    lastRotationTime = now;
  }
  
  // Check size-based rotation
  if (currentLogFile) {
    try {
      const stats = await fs.stat(currentLogFile);
      if (stats.size > MAX_LOG_SIZE) {
        currentLogFile = null;
      }
    } catch (e) {
      // File doesn't exist yet, that's fine
    }
  }
  
  if (!currentLogFile) {
    currentLogFile = getLogFilePath();
  }
}

/**
 * Format log entry as human-readable string
 */
function formatLogEntry(entry) {
  const timestamp = getTimestamp();
  const level = entry.level || "INFO";
  const message = entry.message || "";
  const details = entry.details || "";
  
  let formatted = `[${timestamp}] ${level} ${message}`;
  if (details) {
    formatted += ` | ${details}`;
  }
  
  return formatted;
}

/**
 * Write a single log entry to file
 */
async function writeLogEntry(entry) {
  await rotateIfNeeded();
  
  const formatted = formatLogEntry(entry);
  const line = formatted + "\n";
  
  try {
    await fs.appendFile(currentLogFile, line);
  } catch (e) {
    console.error(`Logger write error:`, e);
  }
}

/**
 * Flush the log queue
 */
async function flushQueue() {
  if (isFlushing || logQueue.length === 0) return;
  
  isFlushing = true;
  
  try {
    const entries = [...logQueue];
    logQueue = [];
    
    // Write entries sequentially to maintain order
    for (const entry of entries) {
      await writeLogEntry(entry);
    }
  } finally {
    isFlushing = false;
  }
}

/**
 * Add entry to queue and flush periodically
 */
function queueLog(entry) {
  logQueue.push(entry);
  
  // Flush every 10 entries or after a short delay
  if (logQueue.length >= 10) {
    flushQueue();
  } else {
    setImmediate(flushQueue);
  }
}

/**
 * Log an info message
 */
export function info(message, details = "") {
  queueLog({ level: "INFO", message, details });
}

/**
 * Log an error message
 */
export function error(message, details = "") {
  queueLog({ level: "ERROR", message, details });
}

/**
 * Check if data is JSON-serializable and readable
 */
function isReadableJSON(data) {
  if (!data || typeof data !== 'object') return false;
  try {
    JSON.stringify(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format payload for logging (no truncation for file logs)
 */
function formatPayload(payload) {
  if (!payload) return '';
  
  try {
    return typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * Format thinking status for display
 */
function formatThinking(thinking) {
  if (thinking === undefined || thinking === null) return "-";
  return thinking ? "✓" : "✗";
}

/**
 * Format status with indicator
 */
function formatStatus(status) {
  if (!status) return "-";
  return status === 200 ? `✓${status}` : `✗${status}`;
}

/**
 * Log a request log entry to console (compressed format)
 */
export function requestLogConsole(entry) {
  const timestamp = getTimestamp().split(" ")[1].split(".")[0]; // HH:MM:SS
  const method = entry.method || "-";
  const path = entry.path || "-";
  const incoming = entry.incomingModel || "-";
  const upstream = entry.upstreamModel || "-";
  const thinking = formatThinking(entry.thinking);
  const status = formatStatus(entry.status);
  const duration = entry.duration ? `${entry.duration}ms` : "-";

  console.log(
    `[${timestamp}] REQ   ${method.padEnd(5)} ${path} | ` +
    `model=${incoming} -> ${upstream} | ` +
    `thinking=${thinking} | ` +
    `status=${status} | ` +
    `duration=${duration}`
  );
}

/**
 * Log a request log entry to file (full format with payloads)
 */
export function requestLog(entry) {
  const details = [
    entry.method && `method=${entry.method}`,
    entry.path && `path=${entry.path}`,
    entry.incomingModel && `incoming=${entry.incomingModel}`,
    entry.upstreamModel && `upstream=${entry.upstreamModel}`,
    entry.thinking !== undefined && `thinking=${entry.thinking}`,
    entry.status && `status=${entry.status}`,
    entry.duration && `duration=${entry.duration}ms`,
    entry.requestPayload && `request=${formatPayload(entry.requestPayload)}`,
    entry.responsePayload && `response=${formatPayload(entry.responsePayload)}`,
  ]
    .filter(Boolean)
    .join(" | ");
  
  queueLog({
    level: "REQUEST",
    message: `${entry.method} ${entry.path}`,
    details,
  });
}

/**
 * Initialize the logger (create logs directory if needed)
 */
export async function initLogger() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    currentLogFile = getLogFilePath();
    lastRotationTime = Date.now();
    info("Logger initialized");
  } catch (e) {
    console.error("Failed to initialize logger:", e);
  }
}

/**
 * Flush all pending logs (for graceful shutdown)
 */
export async function flushLogs() {
  await flushQueue();
}

// Auto-initialize on import
initLogger();

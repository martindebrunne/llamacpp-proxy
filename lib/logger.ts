/**
 * Logger module for the proxy application
 * Handles structured logging to files and console
 */

import { promises as fs } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE_PREFIX = "proxy-";
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const LOG_ROTATION_INTERVAL = 86400000; // 24 hours in ms

let currentLogFile: string | null = null;
let lastRotationTime = Date.now();
let logQueue: LogEntry[] = [];
let isFlushing = false;

interface LogEntry {
  level: string;
  message: string;
  details: string;
}

/**
 * Get current date string for log filename
 */
function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get current timestamp string
 */
function getTimestamp(): string {
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
function getLogFilePath(): string {
  const date = getDateString();
  return join(LOG_DIR, `${LOG_FILE_PREFIX}${date}.log`);
}

/**
 * Rotate log file if needed (size or time based)
 */
async function rotateIfNeeded(): Promise<void> {
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
    } catch {
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
function formatLogEntry(entry: LogEntry): string {
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
async function writeLogEntry(entry: LogEntry): Promise<void> {
  await rotateIfNeeded();
  
  const formatted = formatLogEntry(entry);
  const line = formatted + "\n";
  
  try {
    await fs.appendFile(currentLogFile!, line);
  } catch (e) {
    console.error("Logger write error:", e);
  }
}

/**
 * Flush the log queue
 */
async function flushQueue(): Promise<void> {
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
function queueLog(entry: LogEntry): void {
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
export function info(message: string, details: string = ""): void {
  queueLog({ level: "INFO", message, details });
}

/**
 * Log an error message
 */
export function error(message: string, details: string = ""): void {
  queueLog({ level: "ERROR", message, details });
}

/**
 * Format payload for logging (no truncation for file logs)
 */
function formatPayload(payload: unknown): string {
  if (!payload) return '';
  
  try {
    return typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * Log an info message to console (TTY only, minified format)
 */
export function consoleInfo(message: string, details: string = ""): void {
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00"; // HH:MM:SS
  const msg = message || "";
  const detail = details || "";
  
  console.log(`[${timestamp}] ${msg} ${detail}`);
}

/**
 * Log a request log entry to console (TTY only, minified format)
 */
export interface RequestLogConsoleEntry {
  method: string;
  path: string;
  incomingModel: string | undefined;
  upstreamModel: string | undefined;
  thinking: boolean | undefined;
  status: number;
  duration: number;
}

export function consoleRequestLog(entry: RequestLogConsoleEntry): void {
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00"; // HH:MM:SS
  const method = entry.method || "-";
  const path = entry.path || "-";
  const incoming = entry.incomingModel || "-";
  const upstream = entry.upstreamModel || "-";
  const thinking = entry.thinking === true ? "true" : entry.thinking === false ? "false" : "-";
  const status = entry.status || "-";
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
 * Log a response log entry to console (TTY only, minified format)
 */
export interface ResponseLogConsoleEntry {
  method: string;
  path: string;
  model: string | undefined;
  status: number;
  size: number;
  duration: number;
}

export function consoleResponseLog(entry: ResponseLogConsoleEntry): void {
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00"; // HH:MM:SS
  const method = entry.method || "-";
  const path = entry.path || "-";
  const model = entry.model || "-";
  const status = entry.status || "-";
  const size = formatSize(entry.size);
  const duration = entry.duration ? `${entry.duration}ms` : "-";

  console.log(
    `[${timestamp}] RESP  ${method.padEnd(5)} ${path} | ` +
    `model=${model} | ` +
    `status=${status} | ` +
    `size=${size} | ` +
    `duration=${duration}`
  );
}

/**
 * Format size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Log a request log entry to console (compressed format) - DEPRECATED, use consoleRequestLog instead
 */
export function requestLogConsole(entry: RequestLogConsoleEntry): void {
  consoleRequestLog(entry);
}

/**
 * Log a request log entry to file (full format with payloads)
 */
export interface RequestLogEntry {
  method: string;
  path: string;
  incomingModel: string | undefined;
  upstreamModel: string | undefined;
  thinking: boolean | undefined;
  status: number;
  duration: number;
  requestPayload: unknown;
  responsePayload: unknown;
}

export function requestLog(entry: RequestLogEntry): Promise<void> {
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
  
  return new Promise((resolve) => {
    queueLog({
      level: "REQUEST",
      message: `${entry.method} ${entry.path}`,
      details,
    });
    // Flush immediately for request logs
    setImmediate(() => {
      flushQueue().then(resolve);
    });
  });
}

/**
 * Initialize the logger (create logs directory if needed)
 */
export async function initLogger(): Promise<void> {
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
export async function flushLogs(): Promise<void> {
  await flushQueue();
}

// Auto-initialize on import
initLogger();
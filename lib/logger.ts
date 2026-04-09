/**
 * Logger module for the proxy application
 * Handles structured logging to files and console
 */

import { promises as fs } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE_PREFIX = "proxy-";
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const LOG_ROTATION_INTERVAL = 86400000; // 24 hours in ms
const MAX_ROTATION_SUFFIX = 3; // Maximum rotation suffix (_1, _2, _3)

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
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
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
 * Get log file path with timestamp (for startup rotation)
 * Format: proxy-YYYY-MM-DD-HHmmss.log
 */
function getLogFilePathWithTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const timestamp = `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  return join(LOG_DIR, `${LOG_FILE_PREFIX}${timestamp}.log`);
}

/**
 * Get the next available rotation suffix (_1, _2, _3)
 */
async function getNextRotationSuffix(basePath: string): Promise<string> {
  for (let i = 1; i <= MAX_ROTATION_SUFFIX; i++) {
    const rotatedPath = `${basePath}_${i}.log`;
    try {
      await fs.stat(rotatedPath);
      // File exists, try next suffix
      continue;
    } catch {
      // File doesn't exist, this is the next available suffix
      return i === 1 ? `_1` : `_${i}`;
    }
  }
  // All suffixes up to MAX_ROTATION_SUFFIX are taken, return the last one
  return `_${MAX_ROTATION_SUFFIX}`;
}

/**
 * Rotate log file based on size (with suffix naming _1, _2, _3)
 */
async function rotateBySize(): Promise<string | null> {
  if (!currentLogFile) {
    return null;
  }
  
  try {
    const stats = await fs.stat(currentLogFile);
    if (stats.size <= MAX_LOG_SIZE) {
      return currentLogFile; // No rotation needed
    }
  } catch {
    return currentLogFile; // File doesn't exist, no rotation needed
  }
  
  // File exceeds MAX_LOG_SIZE, perform rotation with suffix naming
  // Get the base path without .log extension
  const baseName = currentLogFile.replace(/\.log$/, "");
  const suffix = await getNextRotationSuffix(baseName);
  const rotatedPath = `${baseName}${suffix}.log`;
  
  // Rename the current log file to the rotated path
  try {
    await fs.rename(currentLogFile, rotatedPath);
    // Return the new rotated path so caller can use it
    return rotatedPath;
  } catch (e) {
    console.error("Logger rotation error:", e);
    return currentLogFile;
  }
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
  
  // Check size-based rotation with suffix naming
  if (currentLogFile) {
    const newLogFile = await rotateBySize();
    if (newLogFile && newLogFile !== currentLogFile) {
      currentLogFile = newLogFile;
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
 * Write a JSON log entry to file (one JSON object per line)
 */
async function writeJsonLogEntry(entry: unknown): Promise<void> {
  await rotateIfNeeded();
  
  const jsonLine = JSON.stringify(entry) + "\n";
  
  try {
    await fs.appendFile(currentLogFile!, jsonLine);
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
 * Format payload for logging (truncate for console, full for file)
 */
export function formatPayload(payload: unknown, truncate = false): string {
  if (payload === null || payload === undefined) return '';
  
  try {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    if (truncate && str.length > 200) {
      return str.substring(0, 200) + '...';
    }
    return str;
  } catch {
    return String(payload);
  }
}

/**
 * Format size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Log a request log entry to console (TTY only, minified format) - Request Start
 */
export interface RequestLogConsoleStartEntry {
  method: string;
  path: string;
  incomingModel: string | undefined;
  thinkingMode: string | undefined;
  correlationId: string;
}

export function consoleRequestLogStart(entry: RequestLogConsoleStartEntry): void {
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00"; // HH:MM:SS
  const method = entry.method || "-";
  const path = entry.path || "-";
  const incoming = entry.incomingModel || "-";
  const thinking = entry.thinkingMode || "-";
  const correlation = entry.correlationId;

  console.log(
    `[${timestamp}] REQ_IN  ${method.padEnd(5)} ${path} | ` +
    `model=${incoming} | thinking=${thinking} | correlation=${correlation}`
  );
}

/**
 * Log a request log entry to console (TTY only, minified format) - Request End
 */
export interface RequestLogConsoleEndEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  size: number;
  upstreamModel: string | undefined;
  thinkingMode: string | undefined;
  stream: boolean | undefined;
  correlationId: string;
}

export function consoleRequestLogEnd(entry: RequestLogConsoleEndEntry): void {
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00"; // HH:MM:SS
  const method = entry.method || "-";
  const path = entry.path || "-";
  const status = entry.status || "-";
  const duration = entry.duration ? `${entry.duration}ms` : "-";
  const size = formatSize(entry.size);
  const upstream = entry.upstreamModel || "-";
  const thinking = entry.thinkingMode || "-";
  const streamFlag = entry.stream === true ? "true" : "-";
  const correlation = entry.correlationId;

  console.log(
    `[${timestamp}] REQ_OUT ${method.padEnd(5)} ${path} | ` +
    `status=${status} | duration=${duration} | size=${size} | ` +
    `upstream=${upstream} | thinking=${thinking} | stream=${streamFlag} | correlation=${correlation}`
  );
}

/**
 * Log a stream chunk to console (optional, for debugging)
 */
export function consoleStreamChunk(correlationId: string, chunkIndex: number): void {
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
  console.log(
    `[${timestamp}] STREAM  correlation=${correlationId} | chunk=${chunkIndex}`
  );
}

/**
 * Log an info message to console (TTY only, minified format) - DEPRECATED, kept for backward compatibility
 */
export function consoleInfo(message: string, details: string = ""): void {
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
  const msg = message || "";
  const detail = details || "";
  console.log(`[${timestamp}] ${msg} ${detail}`);
}

/**
 * Log a request log entry to console (TTY only, minified format) - DEPRECATED, kept for backward compatibility
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
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
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
 * Log a response log entry to console (TTY only, minified format) - DEPRECATED, kept for backward compatibility
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
  const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
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
 * Log a request log entry to console (compressed format) - DEPRECATED, use consoleRequestLog instead
 */
export function requestLogConsole(entry: RequestLogConsoleEntry): void {
  consoleRequestLog(entry);
}

/**
 * Log a request log entry to file (full format with payloads) - DEPRECATED, kept for backward compatibility
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
    setImmediate(() => {
      flushQueue().then(resolve);
    });
  });
}

/**
 * Log a request log entry to file (JSON format, one line per entry)
 */
export interface RequestLogStartEntry {
  timestamp: string;
  type: "REQUEST_START";
  correlationId: string;
  method: string;
  path: string;
  stream: boolean;
  incomingModel: string | undefined;
  upstreamModel: string | undefined;
  thinkingMode: string | undefined;
  requestPayload: unknown;
}

export async function logRequestStart(entry: RequestLogStartEntry): Promise<void> {
  await writeJsonLogEntry(entry);
}

/**
 * Log a request log entry to file (JSON format, one line per entry)
 */
export interface RequestLogEndEntry {
  timestamp: string;
  type: "REQUEST_END";
  correlationId: string;
  status: number;
  duration: number;
  responseSize: number;
  stream: boolean;
  upstreamModel: string | undefined;
  thinkingMode: string | undefined;
  responsePayload: unknown;
}

export async function logRequestEnd(entry: RequestLogEndEntry): Promise<void> {
  await writeJsonLogEntry(entry);
}

/**
 * Log a stream chunk to file (JSON format)
 */
export interface StreamChunkEntry {
  timestamp: string;
  type: "STREAM_CHUNK";
  correlationId: string;
  chunkIndex: number;
  data: unknown;
}

export async function logStreamChunk(entry: StreamChunkEntry): Promise<void> {
  await writeJsonLogEntry(entry);
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
 * Initialize the logger (create logs directory if needed)
 * Rotates existing log file on startup with timestamp suffix
 */
export async function initLogger(): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    
    // Perform startup rotation: create a new log file with timestamp
    // This ensures each startup gets a unique log file
    const timestampedLogPath = getLogFilePathWithTimestamp();
    currentLogFile = timestampedLogPath;
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
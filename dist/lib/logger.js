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
const SENSITIVE_KEY_PATTERN = /authorization|api[-_]?key|token|secret|password|passwd|jwt/i;
const REDACTED_VALUE = "[REDACTED]";
const TOKEN_METRIC_KEYS = new Set(["prompt_tokens", "completion_tokens", "total_tokens", "max_tokens"]);
let currentLogFile = null;
let lastRotationTime = Date.now();
let logQueue = [];
let isFlushing = false;
let fileWriteChain = Promise.resolve();
function isNodeErrorLike(value) {
    return !!value && typeof value === "object";
}
/**
 * Run file writes sequentially to avoid concurrent rotation/write races
 */
async function enqueueFileWrite(task) {
    const next = fileWriteChain.then(task, task);
    fileWriteChain = next.catch(() => {
        // Keep the chain alive after a failure
    });
    return next;
}
/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}
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
 * Get log file path with timestamp (for startup rotation)
 * Format: proxy-YYYY-MM-DD-HHmmss.log
 */
function getLogFilePathWithTimestamp() {
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
 * Normalize a log base path by removing repeated numeric suffixes
 * Example: proxy-2026-04-13-192436_1_1 -> proxy-2026-04-13-192436
 */
function normalizeRotationBase(logFilePath) {
    const withoutExtension = logFilePath.replace(/\.log$/i, "");
    return withoutExtension.replace(/(?:_\d+)+$/, "");
}
/**
 * Redact sensitive fields recursively in structured payloads
 */
function redactSensitiveData(value, seen = new WeakSet()) {
    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveData(item, seen));
    }
    if (value && typeof value === "object") {
        if (seen.has(value)) {
            return "[Circular]";
        }
        seen.add(value);
        const record = value;
        const output = {};
        for (const [key, child] of Object.entries(record)) {
            const normalizedKey = key.toLowerCase();
            const shouldPreserveTokenMetric = TOKEN_METRIC_KEYS.has(normalizedKey);
            if (!shouldPreserveTokenMetric && SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
                output[key] = REDACTED_VALUE;
            }
            else {
                output[key] = redactSensitiveData(child, seen);
            }
        }
        return output;
    }
    return value;
}
/**
 * Get the next available rotation suffix (_1, _2, _3)
 */
async function getNextRotationSuffix(basePath) {
    for (let i = 1; i <= MAX_ROTATION_SUFFIX; i++) {
        const rotatedPath = `${basePath}_${i}.log`;
        try {
            await fs.stat(rotatedPath);
            // File exists, try next suffix
            continue;
        }
        catch (e) {
            if (isNodeErrorLike(e) && e.code === "ENOENT") {
                // File doesn't exist, this suffix is available
                return `_${i}`;
            }
            throw e;
        }
    }
    // All suffixes up to MAX_ROTATION_SUFFIX are taken, return empty string
    // The caller should handle this case
    return "";
}
/**
 * Rotate log file based on size (with suffix naming _1, _2, _3)
 */
async function rotateBySize() {
    if (!currentLogFile) {
        return null;
    }
    try {
        const stats = await fs.stat(currentLogFile);
        if (stats.size <= MAX_LOG_SIZE) {
            return null; // No rotation needed
        }
    }
    catch {
        return null; // File doesn't exist, no rotation needed
    }
    // File exceeds MAX_LOG_SIZE, perform rotation with suffix naming
    // Get the base path without .log extension
    const baseName = normalizeRotationBase(currentLogFile);
    const activeLogFile = `${baseName}.log`;
    currentLogFile = activeLogFile;
    const suffix = await getNextRotationSuffix(baseName);
    // If no suffix available, don't rotate
    if (!suffix) {
        console.warn(`Logger: All rotation slots taken for ${currentLogFile}`);
        return null;
    }
    const rotatedPath = `${baseName}${suffix}.log`;
    // Rename the current log file to the rotated path
    try {
        await fs.rename(activeLogFile, rotatedPath);
        // Keep writing to the active (unsuffixed) log file
        return activeLogFile;
    }
    catch (e) {
        if (isNodeErrorLike(e) && e.code === "ENOENT") {
            // Another write may have rotated/recreated in between; recover silently
            return activeLogFile;
        }
        console.error("Logger rotation error:", e);
        return null;
    }
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
    // Check size-based rotation with suffix naming
    if (currentLogFile) {
        currentLogFile = `${normalizeRotationBase(currentLogFile)}.log`;
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
    await enqueueFileWrite(async () => {
        await rotateIfNeeded();
        const formatted = formatLogEntry(entry);
        const line = formatted + "\n";
        try {
            await fs.appendFile(currentLogFile, line);
        }
        catch (e) {
            console.error("Logger write error:", e);
        }
    });
}
/**
 * Write a JSON log entry to file (one JSON object per line)
 */
async function writeJsonLogEntry(entry) {
    await enqueueFileWrite(async () => {
        await rotateIfNeeded();
        const sanitized = redactSensitiveData(entry);
        const jsonLine = JSON.stringify(sanitized) + "\n";
        try {
            await fs.appendFile(currentLogFile, jsonLine);
        }
        catch (e) {
            console.error("Logger write error:", e);
        }
    });
}
/**
 * Flush the log queue
 */
async function flushQueue() {
    if (isFlushing || logQueue.length === 0)
        return;
    isFlushing = true;
    try {
        const entries = [...logQueue];
        logQueue = [];
        // Write entries sequentially to maintain order
        for (const entry of entries) {
            await writeLogEntry(entry);
        }
    }
    finally {
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
    }
    else {
        setImmediate(flushQueue);
    }
}
/**
 * Format payload for logging (truncate for console, full for file)
 */
export function formatPayload(payload, truncate = false) {
    if (payload === null || payload === undefined)
        return '';
    try {
        const sanitized = redactSensitiveData(payload);
        const str = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized, null, 2);
        if (truncate && str.length > 200) {
            return str.substring(0, 200) + '...';
        }
        return str;
    }
    catch {
        return String(payload);
    }
}
/**
 * Format size in human-readable format
 */
export function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
export function consoleRequestLogStart(entry) {
    const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00"; // HH:MM:SS
    const method = entry.method || "-";
    const path = entry.path || "-";
    const incoming = entry.incomingModel || "-";
    const thinking = entry.thinkingMode || "-";
    const correlation = entry.correlationId;
    console.log(`[${timestamp}] REQ_IN  ${method.padEnd(5)} ${path} | ` +
        `model=${incoming} | thinking=${thinking} | correlation=${correlation}`);
}
export function consoleRequestLogEnd(entry) {
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
    console.log(`[${timestamp}] REQ_OUT ${method.padEnd(5)} ${path} | ` +
        `status=${status} | duration=${duration} | size=${size} | ` +
        `upstream=${upstream} | thinking=${thinking} | stream=${streamFlag} | correlation=${correlation}`);
}
/**
 * Log a stream chunk to console (optional, for debugging)
 */
export function consoleStreamChunk(correlationId, chunkIndex) {
    const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
    console.log(`[${timestamp}] STREAM  correlation=${correlationId} | chunk=${chunkIndex}`);
}
/**
 * Log an info message to console (TTY only, minified format) - DEPRECATED, kept for backward compatibility
 */
export function consoleInfo(message, details = "") {
    const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
    const msg = message || "";
    const detail = details || "";
    console.log(`[${timestamp}] ${msg} ${detail}`);
}
export function consoleRequestLog(entry) {
    const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
    const method = entry.method || "-";
    const path = entry.path || "-";
    const incoming = entry.incomingModel || "-";
    const upstream = entry.upstreamModel || "-";
    const thinking = entry.thinking === true ? "true" : entry.thinking === false ? "false" : "-";
    const status = entry.status || "-";
    const duration = entry.duration ? `${entry.duration}ms` : "-";
    console.log(`[${timestamp}] REQ   ${method.padEnd(5)} ${path} | ` +
        `model=${incoming} -> ${upstream} | ` +
        `thinking=${thinking} | ` +
        `status=${status} | ` +
        `duration=${duration}`);
}
export function consoleResponseLog(entry) {
    const timestamp = getTimestamp().split(" ")[1]?.split(".")[0] ?? "00:00:00";
    const method = entry.method || "-";
    const path = entry.path || "-";
    const model = entry.model || "-";
    const status = entry.status || "-";
    const size = formatSize(entry.size);
    const duration = entry.duration ? `${entry.duration}ms` : "-";
    console.log(`[${timestamp}] RESP  ${method.padEnd(5)} ${path} | ` +
        `model=${model} | ` +
        `status=${status} | ` +
        `size=${size} | ` +
        `duration=${duration}`);
}
/**
 * Log a request log entry to console (compressed format) - DEPRECATED, use consoleRequestLog instead
 */
export function requestLogConsole(entry) {
    consoleRequestLog(entry);
}
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
export async function logRequestStart(entry) {
    await writeJsonLogEntry(entry);
}
export async function logRequestEnd(entry) {
    await writeJsonLogEntry(entry);
}
export async function logStreamChunk(entry) {
    await writeJsonLogEntry(entry);
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
 * Initialize the logger (create logs directory if needed)
 * Rotates existing log file on startup with timestamp suffix
 */
export async function initLogger() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        // Perform startup rotation: create a new log file with timestamp
        // This ensures each startup gets a unique log file
        const timestampedLogPath = getLogFilePathWithTimestamp();
        currentLogFile = timestampedLogPath;
        lastRotationTime = Date.now();
        info("Logger initialized");
    }
    catch (e) {
        console.error("Failed to initialize logger:", e);
    }
}
/**
 * Flush all pending logs (for graceful shutdown)
 */
export async function flushLogs() {
    await flushQueue();
    await fileWriteChain;
}
// Auto-initialize on import
initLogger();
//# sourceMappingURL=logger.js.map
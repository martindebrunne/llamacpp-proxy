/**
 * Logger module for the proxy application
 * Handles structured logging to files and console
 */
/**
 * Generate a unique correlation ID
 */
export declare function generateCorrelationId(): string;
/**
 * Format payload for logging (truncate for console, full for file)
 */
export declare function formatPayload(payload: unknown, truncate?: boolean): string;
/**
 * Format size in human-readable format
 */
export declare function formatSize(bytes: number): string;
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
export declare function consoleRequestLogStart(entry: RequestLogConsoleStartEntry): void;
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
export declare function consoleRequestLogEnd(entry: RequestLogConsoleEndEntry): void;
/**
 * Log a stream chunk to console (optional, for debugging)
 */
export declare function consoleStreamChunk(correlationId: string, chunkIndex: number): void;
/**
 * Log an info message to console (TTY only, minified format) - DEPRECATED, kept for backward compatibility
 */
export declare function consoleInfo(message: string, details?: string): void;
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
export declare function consoleRequestLog(entry: RequestLogConsoleEntry): void;
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
export declare function consoleResponseLog(entry: ResponseLogConsoleEntry): void;
/**
 * Log a request log entry to console (compressed format) - DEPRECATED, use consoleRequestLog instead
 */
export declare function requestLogConsole(entry: RequestLogConsoleEntry): void;
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
export declare function requestLog(entry: RequestLogEntry): Promise<void>;
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
export declare function logRequestStart(entry: RequestLogStartEntry): Promise<void>;
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
export declare function logRequestEnd(entry: RequestLogEndEntry): Promise<void>;
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
export declare function logStreamChunk(entry: StreamChunkEntry): Promise<void>;
/**
 * Log an info message
 */
export declare function info(message: string, details?: string): void;
/**
 * Log an error message
 */
export declare function error(message: string, details?: string): void;
/**
 * Initialize the logger (create logs directory if needed)
 * Rotates existing log file on startup with timestamp suffix
 */
export declare function initLogger(): Promise<void>;
/**
 * Flush all pending logs (for graceful shutdown)
 */
export declare function flushLogs(): Promise<void>;
//# sourceMappingURL=logger.d.ts.map
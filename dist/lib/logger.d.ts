/**
 * Logger module for the proxy application
 * Handles structured logging to files and console
 */
/**
 * Log an info message
 */
export declare function info(message: string, details?: string): void;
/**
 * Log an error message
 */
export declare function error(message: string, details?: string): void;
/**
 * Log an info message to console (TTY only, minified format)
 */
export declare function consoleInfo(message: string, details?: string): void;
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
export declare function consoleRequestLog(entry: RequestLogConsoleEntry): void;
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
export declare function consoleResponseLog(entry: ResponseLogConsoleEntry): void;
/**
 * Log a request log entry to console (compressed format) - DEPRECATED, use consoleRequestLog instead
 */
export declare function requestLogConsole(entry: RequestLogConsoleEntry): void;
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
export declare function requestLog(entry: RequestLogEntry): Promise<void>;
/**
 * Initialize the logger (create logs directory if needed)
 */
export declare function initLogger(): Promise<void>;
/**
 * Flush all pending logs (for graceful shutdown)
 */
export declare function flushLogs(): Promise<void>;
//# sourceMappingURL=logger.d.ts.map
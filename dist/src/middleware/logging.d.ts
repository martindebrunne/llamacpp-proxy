/**
 * Logging middleware
 * Logs incoming requests and responses with correlation IDs
 */
import type { Request, Response, NextFunction } from "express";
export declare function loggingMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Extract thinking mode from request body
 */
export declare function extractThinkingMode(body: unknown): string | undefined;
/**
 * Update logging state for streaming requests
 */
export declare function updateStreamingState(req: Request, stream: boolean, upstreamModel?: string): void;
/**
 * Set the request body for logging (called before upstream request)
 */
export declare function setRequestBodyForLogging(req: Request, body: unknown): void;
/**
 * Log a stream chunk (for streaming responses)
 */
export declare function logStreamChunk(correlationId: string, chunkIndex: number, data: unknown): Promise<void>;
//# sourceMappingURL=logging.d.ts.map
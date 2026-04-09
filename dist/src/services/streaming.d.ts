/**
 * Streaming service
 * Handles real-time SSE streaming with reasoning content recovery
 */
import type { Request, Response } from "express";
/**
 * Forward streaming response with real-time processing
 */
export declare function forwardStreamingResponse(req: Request, res: Response, upstream: Response, mapped: unknown, _upstreamPath: string, startTime: number): Promise<void>;
//# sourceMappingURL=streaming.d.ts.map
/**
 * Streaming service
 * Handles real-time SSE streaming with reasoning content recovery
 */
import type { Request, Response as ExpressResponse } from "express";
/**
 * Forward streaming response with real-time processing
 */
export declare function forwardStreamingResponse(req: Request, res: ExpressResponse, upstream: globalThis.Response, mapped: unknown, _upstreamPath: string, startTime: number): Promise<void>;
/**
 * Forward streaming response without transformation (No-Think passthrough)
 */
export declare function forwardRawStreamingResponse(req: Request, res: ExpressResponse, upstream: globalThis.Response, mapped: unknown, _upstreamPath: string, startTime: number): Promise<void>;
//# sourceMappingURL=streaming.d.ts.map
/**
 * Main proxy service
 * Handles JSON POST requests and response sanitization
 */
import type { Request, Response as ExpressResponse } from "express";
/**
 * Forward JSON POST request
 */
export declare function forwardJsonPost(req: Request, res: ExpressResponse, upstreamPath: string): Promise<void>;
//# sourceMappingURL=proxy.d.ts.map
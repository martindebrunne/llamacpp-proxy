/**
 * Main proxy service
 * Handles JSON POST requests and response sanitization
 */
import type { Request, Response } from "express";
/**
 * Forward JSON POST request
 */
export declare function forwardJsonPost(req: Request, res: Response, upstreamPath: string): Promise<void>;
//# sourceMappingURL=proxy.d.ts.map
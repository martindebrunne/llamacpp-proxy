/**
 * Error handler middleware
 */

import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(500).json({
    error: "proxy_error",
    message: err.message,
  });
}
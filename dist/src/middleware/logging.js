/**
 * Logging middleware
 * Logs passthrough requests and responses
 */
import { consoleRequestLog, consoleResponseLog } from "../../lib/index.js";
export function loggingMiddleware(req, res, next) {
    const startTime = Date.now();
    let responseBodySize = 0;
    // Hook to log after response
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - startTime;
        // Capture response body size (skip if chunk is a callback)
        if (chunk && typeof chunk !== 'function') {
            responseBodySize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding || 'utf8');
        }
        // Log request
        consoleRequestLog({
            method: req.method,
            path: req.originalUrl || req.url,
            incomingModel: req.body?.model,
            upstreamModel: "-",
            thinking: undefined,
            status: res.statusCode,
            duration,
        });
        // Log response
        consoleResponseLog({
            method: req.method,
            path: req.originalUrl || req.url,
            model: req.body?.model,
            status: res.statusCode,
            size: responseBodySize,
            duration,
        });
        return originalEnd.apply(this, [chunk, encoding, cb]);
    };
    next();
}
//# sourceMappingURL=logging.js.map
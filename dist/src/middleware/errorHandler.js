/**
 * Error handler middleware
 */
export function errorHandler(err, _req, res, _next) {
    res.status(500).json({
        error: "proxy_error",
        message: err.message,
    });
}
//# sourceMappingURL=errorHandler.js.map
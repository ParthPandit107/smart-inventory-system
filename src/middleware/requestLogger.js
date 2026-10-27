/**
 * Request Logging Middleware
 */

function requestLogger(req, res, next) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        console.log(`[HTTP] ${method} ${originalUrl} -> ${status} (${duration}ms)`);
    });

    next;
    next();
}

module.exports = requestLogger;

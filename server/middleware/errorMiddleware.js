/**
 * Centralized Production Error Handling Middleware for REDhope Express Backend
 * 
 * Guarantees:
 * - Consistent JSON response format: { success: false, message: "..." }
 * - Never leaks stack traces, file paths, or DB internals in production
 * - Preserves standard HTTP status codes (400, 401, 403, 404, 409, 429, 500)
 * - Safe sanitization of validation, duplicate-key, and casting errors
 */

// 404 Not Found Handler for unknown endpoints
function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
}

// Global Express Error Handler
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    const isProd = process.env.NODE_ENV === "production";
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || "Internal server error";

    // 1. Mongoose Schema Validation Error
    if (err.name === "ValidationError") {
        statusCode = 400;
        const messages = Object.values(err.errors || {}).map((e) => e.message);
        message = messages.length > 0 ? messages.join("; ") : "Validation failed";
    }

    // 2. Mongoose Invalid ObjectId (CastError)
    else if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err.path || "ID"} format`;
    }

    // 3. MongoDB Duplicate Key Error (E11000)
    else if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "record";
        message = `${field} already exists`;
    }

    // 4. JWT Authentication Errors
    else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid authentication token";
    } else if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Authentication token expired";
    }

    // 5. CORS Rejection
    else if (err.message && err.message.includes("CORS")) {
        statusCode = 403;
        message = "Cross-Origin Request Blocked by Security Policy";
    }

    // 6. Payload Too Large
    else if (err.type === "entity.too.large" || err.status === 413) {
        statusCode = 413;
        message = "Request payload too large";
    }

    // Safe error logging (never logs tokens, passwords, or medical bodies)
    if (statusCode >= 500) {
        console.error(`[SERVER ERROR 500] ${req.method} ${req.originalUrl} - ${err.message}`);
        if (!isProd && err.stack) {
            console.error(err.stack);
        }
    } else if (statusCode !== 404) {
        console.warn(`[CLIENT ERROR ${statusCode}] ${req.method} ${req.originalUrl} - ${message}`);
    }

    // Clean client response
    const responsePayload = {
        success: false,
        message: statusCode >= 500 && isProd ? "Internal server error" : message
    };

    if (!isProd && statusCode >= 500 && err.stack) {
        responsePayload.stack = err.stack;
    }

    return res.status(statusCode).json(responsePayload);
}

module.exports = {
    notFoundHandler,
    errorHandler
};


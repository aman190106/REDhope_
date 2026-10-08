/**
 * REDhope Rate Limiting Middleware Configuration
 * 
 * Configures express-rate-limit instances with sensible defaults.
 * Allows graceful bypass during automated test runs via process.env.NODE_ENV === "test"
 * or process.env.DISABLE_RATE_LIMIT === "true".
 */

const rateLimit = require("express-rate-limit");

const isTestEnv = process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true";

/**
 * Standard handler for 429 Too Many Requests response
 */
const rateLimitHandler = (req, res) => {
    return res.status(429).json({
        success: false,
        message: "too many requests from this IP, please try again later"
    });
};

/**
 * General API Limiter: 100 requests per 15 minutes window
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTestEnv ? 10000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: () => isTestEnv
});

/**
 * Sensitive Auth Limiter: protects /auth/login and /auth/register
 * 15 requests per 15 minutes window (relaxed in test/dev)
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTestEnv ? 10000 : 25,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "too many authentication attempts, please try again in 15 minutes"
        });
    },
    skip: () => isTestEnv
});

/**
 * Blood Matching & Emergency Request Limiter
 * 30 requests per 10 minutes window
 */
const matchingLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: isTestEnv ? 10000 : 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: () => isTestEnv
});

module.exports = {
    generalLimiter,
    authLimiter,
    matchingLimiter
};


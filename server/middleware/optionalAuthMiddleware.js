const jwt = require("jsonwebtoken");

/**
 * Optional authentication middleware.
 * If Authorization header is present and valid, sets req.user.
 * If missing or invalid, does not throw 401; req.user remains undefined.
 */
const optionalAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };
    } catch {
        // In optional auth, invalid token simply means unauthenticated
        req.user = undefined;
    }

    next();
};

module.exports = optionalAuthMiddleware;


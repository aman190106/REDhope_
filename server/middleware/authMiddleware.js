const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "authentication required"
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "authentication required"
        });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error("JWT_SECRET is not configured");
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);

        // Attach only the fields needed for authorization; never attach password
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "token expired"
            });
        }

        return res.status(401).json({
            success: false,
            message: "invalid token"
        });
    }
};

module.exports = authMiddleware;


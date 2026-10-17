/**
 * REDhope Environment Variable Validator
 * 
 * Validates required environment variables at application startup:
 * - Ensures critical secrets and connection strings are present
 * - Enforces minimum entropy for JWT_SECRET in production
 * - Enforces strict FRONTEND_URL in production
 * - Never prints or leaks actual secret values
 */

function validateEnv() {
    const isProd = process.env.NODE_ENV === "production";
    const isTest = process.env.NODE_ENV === "test";
    const errors = [];
    const warnings = [];

    // 1. Database URI
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
        errors.push("MONGODB_URI is required. Please provide a valid MongoDB connection string.");
    } else if (isProd && !mongoUri.startsWith("mongodb+srv://") && !mongoUri.startsWith("mongodb://")) {
        errors.push("MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'.");
    }

    // 2. JWT Secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        errors.push("JWT_SECRET is required to sign and verify user authentication tokens.");
    } else if (isProd && jwtSecret.length < 32) {
        errors.push("JWT_SECRET must be at least 32 characters long in production for cryptographic safety.");
    }

    // 3. CORS & Allowed Frontend Origins in Production
    if (isProd) {
        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl || !frontendUrl.trim()) {
            errors.push("FRONTEND_URL is required in production to configure strict CORS policy.");
        } else if (frontendUrl.includes("localhost") || frontendUrl.includes("127.0.0.1")) {
            warnings.push("FRONTEND_URL in production contains localhost/127.0.0.1. Ensure production domain is included.");
        }
    }

    // 4. Email notifications warning
    if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== "false") {
        if (!process.env.BREVO_API_KEY) {
            warnings.push("BREVO_API_KEY is not configured. Email notifications will be gracefully skipped in development/testing.");
        }
    }

    // Output warnings safely
    if (warnings.length > 0 && !isTest) {
        warnings.forEach((warn) => {
            console.warn(`[CONFIG WARNING] ${warn}`);
        });
    }

    // Fail fast on critical errors
    if (errors.length > 0) {
        const message = `[FATAL CONFIG ERROR] Environment validation failed:\n  - ${errors.join("\n  - ")}`;
        console.error(message);
        throw new Error(message);
    }

    return {
        port: parseInt(process.env.PORT, 10) || 5000,
        nodeEnv: process.env.NODE_ENV || "development",
        isProduction: isProd,
        dbName: process.env.DB_NAME || "REDhope"
    };
}

module.exports = validateEnv;


const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const { disconnectDB } = require("./config/db");
const validateEnv = require("./config/validateEnv");
const logger = require("./middleware/loggerMiddleware");
const { generalLimiter, authLimiter, matchingLimiter } = require("./middleware/rateLimitMiddleware");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");

const homeRoutes = require("./routes/homeRoutes");
const authRoutes = require("./routes/authRoutes");
const eligibilityRoutes = require("./routes/eligibilityRoutes");
const campRoutes = require("./routes/campRoutes");
const campRegistrationRoutes = require("./routes/campRegistrationRoutes");
const bloodMatchingRoutes = require("./routes/bloodMatchingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const donationRoutes = require("./routes/donationRoutes");
const healthScreeningRoutes = require("./routes/healthScreeningRoutes");
const adminHealthScreeningRoutes = require("./routes/adminHealthScreeningRoutes");
const testRoutes = require("./routes/testRoutes");
const notificationScheduler = require("./services/notificationScheduler");

const app = express();

const PORT = process.env.PORT || 5000;

// Trust reverse proxy (Render, Railway, Heroku, Cloudflare, Nginx) for accurate client IP & rate limiting
app.set("trust proxy", 1);

// Security Headers with Helmet (safe for API and SSR)
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: false // Disabled on API backend to prevent frontend script breakage
    })
);

// Environment-based CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
    : ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, postman)
            if (!origin) return callback(null, true);
            if (process.env.NODE_ENV !== "production" || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error("CORS policy violation: origin not allowed"));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

// Body parser limits to mitigate denial-of-service via huge payload
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: true, limit: "500kb" }));

// Request logging (sanitized, zero-secret logging)
app.use(logger);

// General rate limiter on all API routes
app.use(generalLimiter);

// Routes
app.use("/", homeRoutes);
app.use("/auth", authLimiter, authRoutes);
app.use("/eligibility", eligibilityRoutes);
app.use("/camps", campRegistrationRoutes);
app.use("/camps", campRoutes);
app.use("/donations", donationRoutes);
app.use("/matching", matchingLimiter, bloodMatchingRoutes);
app.use("/notifications", notificationRoutes);
app.use("/health-screening", express.json({ limit: "10mb" }), healthScreeningRoutes);
app.use("/admin/health-screenings", adminHealthScreeningRoutes);
app.use("/", testRoutes);

// Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Process-level crash guards
process.on("unhandledRejection", (reason) => {
    console.error("[PROCESS] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("[PROCESS FATAL] Uncaught Exception:", error.message);
    process.exit(1);
});

let serverInstance = null;

if (require.main === module) {
    // 1. Validate required environment configuration
    validateEnv();

    // 2. Connect to database and start HTTP listener
    connectDB()
        .then(() => {
            serverInstance = app.listen(PORT, () => {
                console.log(`[SERVER] REDhope server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
                if (process.env.ENABLE_NOTIFICATION_SCHEDULER !== "false") {
                    notificationScheduler.startScheduler();
                }
            });
        })
        .catch((error) => {
            console.error(`[SERVER BOOT FAILED] ${error.message}`);
            process.exit(1);
        });

    // Graceful shutdown handling (SIGINT / SIGTERM)
    const gracefulShutdown = async (signal) => {
        console.log(`\n[SHUTDOWN] Received ${signal}. Closing server gracefully...`);
        if (serverInstance) {
            serverInstance.close(async () => {
                console.log("[SHUTDOWN] HTTP server closed.");
                try {
                    await disconnectDB();
                } catch (err) {
                    console.error("[SHUTDOWN ERROR] Error while disconnecting database:", err.message);
                }
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = app;

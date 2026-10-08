const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const logger = require("./middleware/loggerMiddleware");
const { generalLimiter, authLimiter, matchingLimiter } = require("./middleware/rateLimitMiddleware");
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

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            if (process.env.ENABLE_NOTIFICATION_SCHEDULER !== "false") {
                notificationScheduler.startScheduler();
            }
        });
    })
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });

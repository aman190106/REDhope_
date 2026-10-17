const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Root ping
router.get("/", (req, res) => {
    res.send("❤️backend is working");
});

// Production-ready health check endpoint for load balancers & monitoring
router.get("/health", (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };

    const isHealthy = dbState === 1;

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: states[dbState] || "unknown",
        version: "1.0.0"
    });
});

module.exports = router;
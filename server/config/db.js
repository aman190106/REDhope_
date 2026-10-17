const mongoose = require("mongoose");
const dns = require("dns");

// Use reliable DNS servers for MongoDB Atlas SRV resolution
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Sanitize MongoDB URI to prevent password or credential exposure in logs
function sanitizeMongoUri(uri) {
    if (!uri || typeof uri !== "string") return "[invalid-uri]";
    return uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
}

let isInitialized = false;

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error("MongoDB connection string is missing. Set MONGODB_URI in your environment.");
    }

    if (!isInitialized) {
        mongoose.connection.on("connected", () => {
            console.log(`[DATABASE] MongoDB connected successfully [DB: ${mongoose.connection.name}]`);
        });

        mongoose.connection.on("error", (err) => {
            console.error(`[DATABASE ERROR] MongoDB runtime error: ${err.message}`);
        });

        mongoose.connection.on("disconnected", () => {
            console.warn("[DATABASE WARN] MongoDB connection disconnected.");
        });

        mongoose.connection.on("reconnected", () => {
            console.log("[DATABASE] MongoDB connection re-established.");
        });

        isInitialized = true;
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    try {
        const dbName = process.env.DB_NAME || "REDhope";

        await mongoose.connect(mongoUri, {
            dbName,
            maxPoolSize: 50,
            minPoolSize: 5,
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4 // IPv4 preference avoids latency on cloud hosts
        });

        return mongoose.connection;
    } catch (error) {
        const masked = sanitizeMongoUri(mongoUri);
        throw new Error(`MongoDB connection failed for ${masked}: ${error.message}`);
    }
};

const disconnectDB = async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("[DATABASE] MongoDB connection closed gracefully.");
    }
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;
module.exports.sanitizeMongoUri = sanitizeMongoUri;

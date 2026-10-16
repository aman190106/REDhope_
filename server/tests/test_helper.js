/**
 * REDhope Backend Test Suite - Test Helper & Harness
 * 
 * Configures isolated test environment:
 * - Isolated database: 'REDhope_test'
 * - DNS servers for Atlas SRV resolution
 * - Ephemeral HTTP server
 * - Fetch-based request wrapper
 * - Fixture factory and teardown
 */

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

process.env.NODE_ENV = "test";
process.env.DISABLE_RATE_LIMIT = "true";
process.env.DB_NAME = "REDhope_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "super_secret_test_jwt_key_redhope_test_suite_minimum_32_chars";
process.env.ENABLE_NOTIFICATION_SCHEDULER = "false";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

// Ensure DB_NAME is strictly REDhope_test for test execution
process.env.DB_NAME = "REDhope_test";

const mongoose = require("mongoose");
const app = require("../server");

let serverInstance = null;
let baseUrl = "";

/**
 * Starts test server on an ephemeral port and connects to test DB
 */
async function setupTestServer() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("MONGODB_URI is required to run test suite.");
    }

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri, {
            dbName: "REDhope_test",
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000
        });
    }

    return new Promise((resolve) => {
        serverInstance = app.listen(0, "127.0.0.1", () => {
            const port = serverInstance.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve({ server: serverInstance, baseUrl, db: mongoose.connection });
        });
    });
}

/**
 * Stops test server and disconnects from DB
 */
async function teardownTestServer() {
    if (serverInstance) {
        await new Promise((resolve) => serverInstance.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
}

/**
 * Cleans all test collections in REDhope_test
 */
async function clearTestDatabase() {
    if (mongoose.connection.name !== "REDhope_test") {
        throw new Error(`SAFETY BLOCK: Attempted to wipe non-test database: '${mongoose.connection.name}'! Aborting.`);
    }

    const collections = mongoose.connection.collections;
    for (const key in collections) {
        try {
            await collections[key].deleteMany({});
        } catch (e) {
            // Ignore collection not found errors
        }
    }
}

/**
 * Standard HTTP test request client
 */
async function request(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
    const headers = { ...options.headers };

    if (options.token) {
        headers["Authorization"] = `Bearer ${options.token}`;
    }

    let body = options.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
    }

    const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body
    });

    let data;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        try {
            data = await res.json();
        } catch (err) {
            data = null;
        }
    } else {
        data = await res.text();
    }

    return {
        status: res.status,
        ok: res.ok,
        headers: res.headers,
        body: data
    };
}

module.exports = {
    setupTestServer,
    teardownTestServer,
    clearTestDatabase,
    request,
    getBaseUrl: () => baseUrl,
    mongoose
};


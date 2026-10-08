const path = require("path");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config({ path: path.join(__dirname, "../server/.env"), quiet: true });
const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const user = require("../server/models/user");
const authRoutes = require("../server/routes/authRoutes");
const eligibilityRoutes = require("../server/routes/eligibilityRoutes");
const testRoutes = require("../server/routes/testRoutes");
const { evaluateEligibility } = require("../server/services/eligibilityService");
const { MIN_DONATION_INTERVAL_DAYS } = require("../server/rules/eligibilityRules");

// Spin up a test express app with actual routes
const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/eligibility", eligibilityRoutes);
app.use("/", testRoutes);

let server;
let baseUrl;

function makeRequest(method, endpoint, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, baseUrl);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                ...headers,
                ...(body ? { "Content-Type": "application/json" } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on("error", reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function generateToken(userObj) {
    return jwt.sign(
        { id: userObj._id, email: userObj.email, role: userObj.role },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: "1h" }
    );
}

async function runTests() {
    console.log("=== Starting Blood Donation Eligibility Engine Test Suite ===");

    const connectDB = require("../server/config/db");
    await connectDB();
    console.log("Connected to MongoDB");

    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            console.log(`Test server running at ${baseUrl}`);
            resolve();
        });
    });

    const testTimestamp = Date.now();
    const createdUserIds = [];

    async function createTestUser(overrides = {}) {
        const unique = `${testTimestamp}_${Math.floor(Math.random() * 100000)}`;
        const userData = {
            name: "Eligibility Test User",
            email: `elig_${unique}@example.com`,
            password: "hashedPassword123!",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1995-05-15"),
            isDonorAvailable: true,
            isEligible: true,
            lastDonationDate: null,
            ...overrides
        };

        const doc = await user.create(userData);
        createdUserIds.push(doc._id);
        return doc;
    }

    try {
        // --- Test 1: First-time donor (lastDonationDate = null) ---
        console.log("\n--- Test 1: First-time donor (lastDonationDate = null) ---");
        const user1 = await createTestUser({ lastDonationDate: null });
        const token1 = generateToken(user1);

        const res1 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${token1}`
        });

        console.log("Status:", res1.status, "| isMedicallyEligible:", res1.data.data?.isMedicallyEligible);
        if (res1.status === 200 && res1.data.data.isMedicallyEligible === true && res1.data.data.nextEligibleDate === null && res1.data.data.reasons.length === 0) {
            console.log("1. First-time donor: PASS");
        } else {
            console.error("1. First-time donor: FAIL", res1.data);
            process.exit(1);
        }

        // --- Test 2: Recent donor (lastDonationDate = 10 days ago) ---
        console.log("\n--- Test 2: Recent donor (lastDonationDate = 10 days ago) ---");
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const user2 = await createTestUser({ lastDonationDate: tenDaysAgo });
        const token2 = generateToken(user2);

        const res2 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${token2}`
        });

        console.log("Status:", res2.status, "| isMedicallyEligible:", res2.data.data?.isMedicallyEligible);
        console.log("Next eligible date:", res2.data.data?.nextEligibleDate);
        console.log("Reasons:", res2.data.data?.reasons);

        const expectedNext = new Date(tenDaysAgo);
        expectedNext.setDate(expectedNext.getDate() + MIN_DONATION_INTERVAL_DAYS);

        if (
            res2.status === 200 &&
            res2.data.data.isMedicallyEligible === false &&
            res2.data.data.nextEligibleDate &&
            res2.data.data.reasons.includes("Minimum donation interval has not passed.")
        ) {
            console.log("2. Recent donor: PASS");
        } else {
            console.error("2. Recent donor: FAIL", res2.data);
            process.exit(1);
        }

        // --- Test 3: Donor past the configured interval (lastDonationDate = 100 days ago) ---
        console.log("\n--- Test 3: Donor past configured interval (100 days ago) ---");
        const hundredDaysAgo = new Date();
        hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

        const user3 = await createTestUser({ lastDonationDate: hundredDaysAgo });
        const token3 = generateToken(user3);

        const res3 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${token3}`
        });

        console.log("Status:", res3.status, "| isMedicallyEligible:", res3.data.data?.isMedicallyEligible);
        if (res3.status === 200 && res3.data.data.isMedicallyEligible === true && res3.data.data.nextEligibleDate === null) {
            console.log("3. Donor past configured interval: PASS");
        } else {
            console.error("3. Donor past configured interval: FAIL", res3.data);
            process.exit(1);
        }

        // --- Test 4: Admin/system blocked (isEligible = false) ---
        console.log("\n--- Test 4: Admin/system blocked (isEligible = false) ---");
        const user4 = await createTestUser({ isEligible: false, lastDonationDate: null });
        const token4 = generateToken(user4);

        const res4 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${token4}`
        });

        console.log("Status:", res4.status, "| isMedicallyEligible:", res4.data.data?.isMedicallyEligible);
        console.log("Reasons:", res4.data.data?.reasons);
        if (
            res4.status === 200 &&
            res4.data.data.isMedicallyEligible === false &&
            res4.data.data.reasons.includes("Account marked ineligible by system or administrator.")
        ) {
            console.log("4. Admin blocked user: PASS");
        } else {
            console.error("4. Admin blocked user: FAIL", res4.data);
            process.exit(1);
        }

        // --- Test 5: Donor unavailable (isDonorAvailable = false) ---
        console.log("\n--- Test 5: Donor unavailable (isDonorAvailable = false) ---");
        const user5 = await createTestUser({ isDonorAvailable: false, lastDonationDate: null });
        const token5 = generateToken(user5);

        const res5 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${token5}`
        });

        console.log("Status:", res5.status, "| isMedicallyEligible:", res5.data.data?.isMedicallyEligible, "| isDonorAvailable:", res5.data.data?.isDonorAvailable);
        if (
            res5.status === 200 &&
            res5.data.data.isMedicallyEligible === true &&
            res5.data.data.isDonorAvailable === false
        ) {
            console.log("5. Donor unavailable: PASS");
        } else {
            console.error("5. Donor unavailable: FAIL", res5.data);
            process.exit(1);
        }

        // --- Test 6: Underage user (age 17 in service evaluation) ---
        console.log("\n--- Test 6: Underage user evaluation ---");
        const seventeenYearsAgo = new Date();
        seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);

        // Directly test service with age 17 object to verify rule logic
        const underageResult = evaluateEligibility({
            dateOfBirth: seventeenYearsAgo,
            isEligible: true,
            isDonorAvailable: true,
            lastDonationDate: null
        });

        console.log("Underage service result isMedicallyEligible:", underageResult.isMedicallyEligible, "| reasons:", underageResult.reasons);
        if (
            underageResult.isMedicallyEligible === false &&
            underageResult.reasons.includes("Donor must be at least 18 years old.")
        ) {
            console.log("6. Underage user check: PASS");
        } else {
            console.error("6. Underage user check: FAIL", underageResult);
            process.exit(1);
        }

        // --- Test 7: Missing authentication ---
        console.log("\n--- Test 7: Missing authentication ---");
        const res7 = await makeRequest("GET", "/eligibility/me");
        console.log("Status:", res7.status);
        if (res7.status === 401) {
            console.log("7. Missing authentication check: PASS (HTTP 401)");
        } else {
            console.error("7. Missing authentication check: FAIL", res7);
            process.exit(1);
        }

        // --- Test 8: Valid authentication ---
        console.log("\n--- Test 8: Valid authentication check ---");
        const user8 = await createTestUser();
        const token8 = generateToken(user8);

        const res8 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${token8}`
        });
        console.log("Status:", res8.status, "| success:", res8.data.success);
        if (res8.status === 200 && res8.data.success === true) {
            console.log("8. Valid authentication check: PASS (HTTP 200)");
        } else {
            console.error("8. Valid authentication check: FAIL", res8);
            process.exit(1);
        }

        // --- Test 9: Non-existent authenticated user ---
        console.log("\n--- Test 9: Non-existent authenticated user ---");
        const fakeUserId = new mongoose.Types.ObjectId();
        const fakeToken = jwt.sign(
            { id: fakeUserId, email: "ghost@example.com", role: "user" },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "1h" }
        );

        const res9 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${fakeToken}`
        });
        console.log("Status:", res9.status, "| message:", res9.data.message);
        if (res9.status === 404 && res9.data.message === "user not found") {
            console.log("9. Non-existent user check: PASS (HTTP 404)");
        } else {
            console.error("9. Non-existent user check: FAIL", res9);
            process.exit(1);
        }

        // --- Test 10: Password never returned ---
        console.log("\n--- Test 10: Password omission check ---");
        const res10 = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${token8}`
        });
        const hasPassword = "password" in res10.data || (res10.data.data && "password" in res10.data.data);
        console.log("Contains password field?", hasPassword);
        if (!hasPassword) {
            console.log("10. Password omission check: PASS");
        } else {
            console.error("10. Password omission check: FAIL");
            process.exit(1);
        }

        console.log("\n=== ALL ELIGIBILITY ENGINE TESTS PASSED ===");
    } finally {
        // Cleanup created test users
        if (createdUserIds.length > 0) {
            await user.deleteMany({ _id: { $in: createdUserIds } });
            console.log(`Cleaned up ${createdUserIds.length} test user records.`);
        }
        await mongoose.disconnect();
        if (server) server.close();
    }
}

runTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});


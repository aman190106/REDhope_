const http = require("http");
const path = require("path");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const bcrypt = require("c:/REDhope/REDhope/server/node_modules/bcrypt");
const jwt = require("c:/REDhope/REDhope/server/node_modules/jsonwebtoken");
const mongoose = require("c:/REDhope/REDhope/server/node_modules/mongoose");

require("c:/REDhope/REDhope/server/node_modules/dotenv").config({
    path: "c:/REDhope/REDhope/server/.env",
    quiet: true
});
const express = require("c:/REDhope/REDhope/server/node_modules/express");
const connectDB = require("c:/REDhope/REDhope/server/config/db");
const user = require("c:/REDhope/REDhope/server/models/user");
const camp = require("c:/REDhope/REDhope/server/models/camp");
const campRegistration = require("c:/REDhope/REDhope/server/models/campRegistration");

const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");
const campRegistrationRoutes = require("c:/REDhope/REDhope/server/routes/campRegistrationRoutes");

const app = express();
app.use(express.json());
app.use("/camps", campRegistrationRoutes);
app.use("/camps", campRoutes);

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
            res.on("data", (chunk) => {
                data += chunk;
            });
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
        { id: userObj._id.toString(), email: userObj.email, role: userObj.role },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: "1h" }
    );
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log("=== Starting Organizer Analytics Test Suite ===");

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
    const createdCampIds = [];
    const createdRegistrationIds = [];

    async function createTestUser(role = "user", overrides = {}) {
        const unique = `${testTimestamp}_${Math.floor(Math.random() * 100000)}`;
        const userData = {
            name: `${role.toUpperCase()} User`,
            email: `${role}_${unique}@example.com`,
            password: "hashedPassword123!",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role,
            dateOfBirth: new Date("1995-05-15"),
            isDonorAvailable: true,
            isEligible: true,
            ...overrides
        };
        const u = await user.create(userData);
        createdUserIds.push(u._id);
        return u;
    }

    async function createTestCamp(organizerId, overrides = {}) {
        const futureStart = overrides.startDate || new Date("2026-10-15T10:00:00.000Z");
        const futureEnd = overrides.endDate || new Date(new Date(futureStart).getTime() + 24 * 60 * 60 * 1000);
        const campData = {
            name: `Test Analytics Camp ${Date.now()}_${Math.random()}`,
            organizer: organizerId,
            location: {
                address: "123 Analytics St",
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380001"
            },
            startDate: futureStart,
            endDate: futureEnd,
            startTime: "09:00",
            endTime: "17:00",
            capacity: 20,
            status: "published",
            registrationCount: 0,
            ...overrides
        };
        const c = await camp.create(campData);
        createdCampIds.push(c._id);
        return c;
    }

    async function createTestRegistration(userId, campId, status = "registered", registeredAt = new Date()) {
        const reg = await campRegistration.create({
            user: userId,
            camp: campId,
            status,
            registeredAt
        });
        createdRegistrationIds.push(reg._id);
        await camp.findByIdAndUpdate(campId, {
            $inc: { registrationCount: status === "registered" ? 1 : 0 }
        });
        return reg;
    }

    try {
        // Create test actors
        const normalUser = await createTestUser("user");
        const normalToken = generateToken(normalUser);

        const org1 = await createTestUser("organizer", { name: "Org One" });
        const org1Token = generateToken(org1);

        const org2 = await createTestUser("organizer", { name: "Org Two" });
        const org2Token = generateToken(org2);

        const adminUser = await createTestUser("admin", { name: "Super Admin" });
        const adminToken = generateToken(adminUser);

        const donorA = await createTestUser("user", { bloodGroup: "A+" });
        const donorB = await createTestUser("user", { bloodGroup: "B+" });
        const donorO = await createTestUser("user", { bloodGroup: "O+" });
        const donorAB = await createTestUser("user", { bloodGroup: "AB-" });

        // ─────────────────────────────────────────────
        // 1. Authentication & Authorization Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 1: Authentication & Authorization ---");

        // 1.1 Unauthenticated request returns 401
        const unauthRes = await makeRequest("GET", "/camps/analytics");
        assert(unauthRes.status === 401, "GET /camps/analytics without token returns 401");
        assert(unauthRes.data.success === false, "401 response has success: false");

        // 1.2 Normal donor (role: user) returns 403
        const forbiddenRes = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${normalToken}`
        });
        assert(forbiddenRes.status === 403, "GET /camps/analytics with role 'user' returns 403");
        assert(forbiddenRes.data.success === false, "403 response has success: false");
        assert(
            forbiddenRes.data.message && forbiddenRes.data.message.includes("access denied"),
            "403 response has descriptive message"
        );

        // ─────────────────────────────────────────────
        // 2. Organizer Analytics Data Isolation
        // ─────────────────────────────────────────────
        console.log("\n--- Group 2: Organizer Analytics Scoping & Calculations ---");

        // Set up camps for Org 1:
        // Camp 1: Published, capacity 10, startDate: 2026-10-15
        const camp1 = await createTestCamp(org1._id, {
            name: "Alpha Camp",
            capacity: 10,
            status: "published",
            startDate: new Date("2026-10-15T09:00:00.000Z")
        });

        // Camp 2: Draft, capacity 10, startDate: 2026-10-20
        const camp2 = await createTestCamp(org1._id, {
            name: "Beta Camp",
            capacity: 10,
            status: "draft",
            startDate: new Date("2026-10-20T09:00:00.000Z")
        });

        // Camp 3: Completed, capacity 5, startDate: 2026-10-05
        const camp3 = await createTestCamp(org1._id, {
            name: "Gamma Camp",
            capacity: 5,
            status: "completed",
            startDate: new Date("2026-10-05T09:00:00.000Z")
        });

        // Set up camp for Org 2:
        // Camp 4: Published, capacity 50, startDate: 2026-10-15
        const camp4 = await createTestCamp(org2._id, {
            name: "Delta Camp (Org 2)",
            capacity: 50,
            status: "published",
            startDate: new Date("2026-10-15T09:00:00.000Z")
        });

        // Add registrations for Org 1's camps:
        // Camp 1: donorA (A+), donorB (B+), donorO (O+) -> 3 active
        await createTestRegistration(donorA._id, camp1._id, "registered", new Date("2026-10-01T10:00:00.000Z"));
        await createTestRegistration(donorB._id, camp1._id, "registered", new Date("2026-10-02T10:00:00.000Z"));
        await createTestRegistration(donorO._id, camp1._id, "registered", new Date("2026-10-03T10:00:00.000Z"));
        // Camp 1: donorAB (AB-) registered then cancelled -> 1 cancelled
        await createTestRegistration(donorAB._id, camp1._id, "cancelled", new Date("2026-10-04T10:00:00.000Z"));

        // Camp 3: donorA (A+) -> 1 active
        await createTestRegistration(donorA._id, camp3._id, "registered", new Date("2026-09-20T10:00:00.000Z"));

        // Add registrations for Org 2's Camp 4:
        // donorB (B+) registered for Org 2's camp (should NOT appear in Org 1's stats!)
        await createTestRegistration(donorB._id, camp4._id, "registered", new Date("2026-10-01T10:00:00.000Z"));

        // Request analytics for Org 1
        const org1Res = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${org1Token}`
        });

        assert(org1Res.status === 200, "GET /camps/analytics for organizer returns 200");
        assert(org1Res.data.success === true, "Response has success: true");

        const data1 = org1Res.data.data;
        assert(!!data1.summary, "Response contains summary object");

        // Org 1 has 3 camps total (1 published, 1 draft, 1 completed, 0 cancelled)
        assert(data1.summary.totalCamps === 3, `Org 1 totalCamps is 3 (got ${data1.summary.totalCamps})`);
        assert(data1.summary.publishedCamps === 1, `Org 1 publishedCamps is 1 (got ${data1.summary.publishedCamps})`);
        assert(data1.summary.draftCamps === 1, `Org 1 draftCamps is 1 (got ${data1.summary.draftCamps})`);
        assert(data1.summary.completedCamps === 1, `Org 1 completedCamps is 1 (got ${data1.summary.completedCamps})`);
        assert(data1.summary.cancelledCamps === 0, `Org 1 cancelledCamps is 0 (got ${data1.summary.cancelledCamps})`);

        // Total capacity for Org 1: 10 (Camp 1) + 10 (Camp 2) + 5 (Camp 3) = 25
        assert(data1.summary.totalCapacity === 25, `Org 1 totalCapacity is 25 (got ${data1.summary.totalCapacity})`);

        // Registrations for Org 1: 4 on Camp 1 (3 registered, 1 cancelled) + 1 on Camp 3 (registered) = 5 total
        assert(data1.summary.totalRegistrations === 5, `Org 1 totalRegistrations is 5 (got ${data1.summary.totalRegistrations})`);
        assert(data1.summary.activeRegistrations === 4, `Org 1 activeRegistrations is 4 (got ${data1.summary.activeRegistrations})`);
        assert(data1.summary.cancelledRegistrations === 1, `Org 1 cancelledRegistrations is 1 (got ${data1.summary.cancelledRegistrations})`);

        // Capacity utilization: (4 active / 25 capacity) * 100 = 16.0%
        assert(data1.summary.capacityUtilization === 16.0, `Org 1 capacityUtilization is 16.0% (got ${data1.summary.capacityUtilization})`);

        // Verify topCamps
        assert(Array.isArray(data1.topCamps), "topCamps is an array");
        assert(data1.topCamps.length === 3, "topCamps contains Org 1's 3 camps");
        assert(data1.topCamps[0].name === "Alpha Camp", "Top camp is Alpha Camp with 3 active registrations");
        assert(data1.topCamps[0].registrations === 3, "Alpha Camp registrations count is 3");
        assert(data1.topCamps[0].utilization === 30, `Alpha Camp utilization is 30% (got ${data1.topCamps[0].utilization}%)`);

        // Verify campStatusDistribution
        assert(Array.isArray(data1.campStatusDistribution), "campStatusDistribution is an array");
        const statusMap = Object.fromEntries(data1.campStatusDistribution.map((s) => [s.status, s.count]));
        assert(statusMap.published === 1 && statusMap.draft === 1 && statusMap.completed === 1, "campStatusDistribution reflects camp statuses correctly");

        // Verify bloodGroupDistribution
        assert(Array.isArray(data1.bloodGroupDistribution), "bloodGroupDistribution is an array");
        // Donors registered for Org 1 camps: donorA (2x), donorB (1x), donorO (1x), donorAB (1x cancelled reg)
        const bgMap = Object.fromEntries(data1.bloodGroupDistribution.map((b) => [b.bloodGroup, b.count]));
        assert(bgMap["A+"] === 2, `Blood group A+ count is 2 (got ${bgMap["A+"]})`);
        assert(bgMap["B+"] === 1, `Blood group B+ count is 1 (got ${bgMap["B+"]})`);
        assert(bgMap["O+"] === 1, `Blood group O+ count is 1 (got ${bgMap["O+"]})`);
        assert(bgMap["AB-"] === 1, `Blood group AB- count is 1 (got ${bgMap["AB-"]})`);

        // Verify registrationTrend
        assert(Array.isArray(data1.registrationTrend), "registrationTrend is an array");
        assert(data1.registrationTrend.length > 0, "registrationTrend has data entries");
        const sepTrend = data1.registrationTrend.find((t) => t.period === "2026-09");
        const octTrend = data1.registrationTrend.find((t) => t.period === "2026-10");
        assert(sepTrend && sepTrend.registrations === 1, "September 2026 trend has 1 registration");
        assert(octTrend && octTrend.registrations === 4, "October 2026 trend has 4 registrations");

        // ─────────────────────────────────────────────
        // 3. Admin Analytics (Global Scope)
        // ─────────────────────────────────────────────
        console.log("\n--- Group 3: Admin Analytics (Global Scope) ---");

        const adminRes = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${adminToken}`
        });

        assert(adminRes.status === 200, "GET /camps/analytics for admin returns 200");
        const adminData = adminRes.data.data;

        // Admin sees all camps globally across all organizers
        assert(adminData.summary.totalCamps >= data1.summary.totalCamps + 1, `Admin totalCamps (${adminData.summary.totalCamps}) exceeds Org 1 camps (${data1.summary.totalCamps})`);
        assert(adminData.summary.totalCapacity >= data1.summary.totalCapacity + 50, `Admin totalCapacity (${adminData.summary.totalCapacity}) includes Org 2 capacity`);
        assert(adminData.summary.totalRegistrations >= data1.summary.totalRegistrations + 1, `Admin totalRegistrations (${adminData.summary.totalRegistrations}) includes Org 2 registrations`);
        assert(adminData.summary.activeRegistrations >= data1.summary.activeRegistrations + 1, `Admin activeRegistrations (${adminData.summary.activeRegistrations}) includes Org 2 active registrations`);

        // ─────────────────────────────────────────────
        // 4. Zero-Capacity Utilization Safety
        // ─────────────────────────────────────────────
        console.log("\n--- Group 4: Zero Capacity Division Safety ---");

        const org3 = await createTestUser("organizer", { name: "Org Zero" });
        const org3Token = generateToken(org3);

        const zeroRes = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${org3Token}`
        });

        assert(zeroRes.status === 200, "GET /camps/analytics for org with 0 camps returns 200");
        assert(zeroRes.data.data.summary.totalCamps === 0, "totalCamps is 0");
        assert(zeroRes.data.data.summary.totalCapacity === 0, "totalCapacity is 0");
        assert(zeroRes.data.data.summary.capacityUtilization === 0, "capacityUtilization is safe 0 (not NaN or Infinity)");

        // ─────────────────────────────────────────────
        // 5. Date Filtering Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 5: Date Filtering on camp.startDate ---");

        // Filter from 2026-10-10:
        // Camps for Org 1: Camp 1 (2026-10-15) and Camp 2 (2026-10-20) are >= 2026-10-10.
        // Camp 3 (2026-10-05) is before, so excluded!
        const fromRes = await makeRequest("GET", "/camps/analytics?from=2026-10-10", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(fromRes.status === 200, "Filter with ?from=2026-10-10 returns 200");
        assert(fromRes.data.data.summary.totalCamps === 2, `Filtered totalCamps is 2 (got ${fromRes.data.data.summary.totalCamps})`);

        // Filter to 2026-10-10:
        // Camp 3 (2026-10-05) is <= 2026-10-10.
        // Camp 1 and Camp 2 are after, so excluded!
        const toRes = await makeRequest("GET", "/camps/analytics?to=2026-10-10", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(toRes.status === 200, "Filter with ?to=2026-10-10 returns 200");
        assert(toRes.data.data.summary.totalCamps === 1, `Filtered totalCamps is 1 (got ${toRes.data.data.summary.totalCamps})`);

        // Filter window from 2026-10-10 to 2026-10-18:
        // Only Camp 1 (2026-10-15) falls in this window.
        const rangeRes = await makeRequest("GET", "/camps/analytics?from=2026-10-10&to=2026-10-18", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(rangeRes.status === 200, "Filter with ?from and ?to returns 200");
        assert(rangeRes.data.data.summary.totalCamps === 1, `Window filtered totalCamps is 1 (got ${rangeRes.data.data.summary.totalCamps})`);

        // Invalid 'from' date returns 400
        const badFromRes = await makeRequest("GET", "/camps/analytics?from=invalid-date", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(badFromRes.status === 400, "Invalid 'from' date returns 400");
        assert(badFromRes.data.success === false, "Bad 'from' has success: false");

        // Invalid 'to' date returns 400
        const badToRes = await makeRequest("GET", "/camps/analytics?to=invalid-date", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(badToRes.status === 400, "Invalid 'to' date returns 400");
        assert(badToRes.data.success === false, "Bad 'to' has success: false");

        // from > to returns 400
        const invertedRes = await makeRequest("GET", "/camps/analytics?from=2026-10-25&to=2026-10-10", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(invertedRes.status === 400, "from > to returns 400");
        assert(invertedRes.data.message && invertedRes.data.message.includes("cannot be after"), "inverted dates error message is descriptive");

        // ─────────────────────────────────────────────
        // 6. Donor Privacy / PII Check
        // ─────────────────────────────────────────────
        console.log("\n--- Group 6: Donor Privacy & PII Protection ---");

        const fullJson = JSON.stringify(org1Res.data);
        const forbiddenFields = [
            donorA.email,
            donorA.phone,
            donorB.email,
            donorB.phone,
            donorO.email,
            donorO.phone,
            "password"
        ];

        let privacyViolation = false;
        for (const val of forbiddenFields) {
            if (fullJson.includes(val)) {
                privacyViolation = true;
                console.error(`  [FAIL] Donor PII leaked in analytics response: ${val}`);
                break;
            }
        }
        assert(!privacyViolation, "Analytics response strictly excludes donor PII (phone, email, password)");

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        // Cleanup created data
        console.log("\n--- Cleaning up test artifacts ---");
        try {
            if (createdRegistrationIds.length > 0) {
                await campRegistration.deleteMany({ _id: { $in: createdRegistrationIds } });
            }
            if (createdCampIds.length > 0) {
                await camp.deleteMany({ _id: { $in: createdCampIds } });
            }
            if (createdUserIds.length > 0) {
                await user.deleteMany({ _id: { $in: createdUserIds } });
            }
            console.log("Cleanup complete");
        } catch (cleanupErr) {
            console.error("Error during cleanup:", cleanupErr);
        }

        if (server) {
            server.close();
        }
        await mongoose.connection.close();
        console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests().catch((e) => {
    console.error("Unhandled rejection:", e);
    process.exit(1);
});

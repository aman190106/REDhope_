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
const donation = require("c:/REDhope/REDhope/server/models/donation");
const bloodRequest = require("c:/REDhope/REDhope/server/models/bloodRequest");

const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");

const app = express();
app.use(express.json());
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
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";

function createToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

let testAdminId;
let testOrganizer1Id;
let testOrganizer2Id;
let testUserId;

let adminToken;
let organizer1Token;
let organizer2Token;
let userToken;

let camp1Id;
let camp2Id;
let camp3Id; // organizer 2's camp

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  PASS: ${message}`);
        testsPassed++;
    } else {
        console.error(`  FAIL: ${message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log("==================================================");
    console.log("REDhope Analytics System Verification Suite");
    console.log("==================================================\n");

    try {
        await connectDB();

        server = http.createServer(app);
        await new Promise((resolve) => {
            server.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}`;
                console.log(`Test Express server listening on ${baseUrl}\n`);
                resolve();
            });
        });

        // 1. Setup Test Users
        const timestamp = Date.now();
        const hashedPassword = await bcrypt.hash("TestPass123!", 10);

        const adminDoc = await user.create({
            name: `Test Admin ${timestamp}`,
            email: `admin_${timestamp}@example.com`,
            password: hashedPassword,
            role: "admin",
            bloodGroup: "O+",
            city: "Delhi",
            state: "Delhi",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testAdminId = adminDoc._id;
        adminToken = createToken({ id: testAdminId.toString(), role: "admin", email: adminDoc.email });

        const org1Doc = await user.create({
            name: `Test Org1 ${timestamp}`,
            email: `org1_${timestamp}@example.com`,
            password: hashedPassword,
            role: "organizer",
            bloodGroup: "A+",
            city: "Mumbai",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testOrganizer1Id = org1Doc._id;
        organizer1Token = createToken({ id: testOrganizer1Id.toString(), role: "organizer", email: org1Doc.email });

        const org2Doc = await user.create({
            name: `Test Org2 ${timestamp}`,
            email: `org2_${timestamp}@example.com`,
            password: hashedPassword,
            role: "organizer",
            bloodGroup: "B+",
            city: "Pune",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testOrganizer2Id = org2Doc._id;
        organizer2Token = createToken({ id: testOrganizer2Id.toString(), role: "organizer", email: org2Doc.email });

        const userDoc = await user.create({
            name: `Test Donor ${timestamp}`,
            email: `donor_${timestamp}@example.com`,
            password: hashedPassword,
            role: "user",
            bloodGroup: "AB+",
            city: "Mumbai",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testUserId = userDoc._id;
        userToken = createToken({ id: testUserId.toString(), role: "user", email: userDoc.email });

        // 2. Setup Test Camps for Org1 and Org2
        const c1 = await camp.create({
            name: `Org1 Mega Blood Drive ${timestamp}`,
            description: "Camp 1 owned by Org 1",
            organizer: testOrganizer1Id,
            organizerName: org1Doc.name,
            organizerContact: org1Doc.phone,
            organizerEmail: org1Doc.email,
            venue: "City Hospital",
            location: {
                address: "123 Health Ave",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                type: "Point",
                coordinates: [72.8777, 19.0760]
            },
            startDate: new Date("2026-03-10T09:00:00Z"),
            endDate: new Date("2026-03-10T17:00:00Z"),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 100,
            status: "published"
        });
        camp1Id = c1._id;

        const c2 = await camp.create({
            name: `Org1 Completed Camp ${timestamp}`,
            description: "Camp 2 owned by Org 1",
            organizer: testOrganizer1Id,
            organizerName: org1Doc.name,
            organizerContact: org1Doc.phone,
            organizerEmail: org1Doc.email,
            venue: "Community Center",
            location: {
                address: "456 Main St",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400002",
                type: "Point",
                coordinates: [72.8777, 19.0760]
            },
            startDate: new Date("2026-04-15T09:00:00Z"),
            endDate: new Date("2026-04-15T17:00:00Z"),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            status: "completed"
        });
        camp2Id = c2._id;

        const c3 = await camp.create({
            name: `Org2 Independent Camp ${timestamp}`,
            description: "Camp 3 owned by Org 2",
            organizer: testOrganizer2Id,
            organizerName: org2Doc.name,
            organizerContact: org2Doc.phone,
            organizerEmail: org2Doc.email,
            venue: "Pune Clinic",
            location: {
                address: "789 High St",
                city: "Pune",
                state: "Maharashtra",
                pincode: "411001",
                type: "Point",
                coordinates: [73.8567, 18.5204]
            },
            startDate: new Date("2026-05-20T09:00:00Z"),
            endDate: new Date("2026-05-20T17:00:00Z"),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 80,
            status: "published"
        });
        camp3Id = c3._id;

        // 3. Setup Registrations
        const reg1 = await campRegistration.create({
            camp: camp1Id,
            user: testUserId,
            status: "registered",
            registeredAt: new Date("2026-03-01T10:00:00Z")
        });

        const reg2 = await campRegistration.create({
            camp: camp2Id,
            user: testUserId,
            status: "registered",
            registeredAt: new Date("2026-04-01T10:00:00Z")
        });

        const reg3 = await campRegistration.create({
            camp: camp3Id,
            user: testUserId,
            status: "registered",
            registeredAt: new Date("2026-05-01T10:00:00Z")
        });

        // 4. Setup Donations
        const don1 = await donation.create({
            camp: camp2Id,
            donor: testUserId,
            registration: reg2._id,
            bloodGroup: "AB+",
            units: 2,
            status: "completed",
            donationDate: new Date("2026-04-15T11:00:00Z"),
            recordedBy: testOrganizer1Id
        });

        const don2 = await donation.create({
            camp: camp1Id,
            donor: testUserId,
            registration: reg1._id,
            bloodGroup: "AB+",
            units: 1,
            status: "scheduled",
            donationDate: new Date("2026-03-10T10:00:00Z"),
            recordedBy: testOrganizer1Id
        });

        // 5. Setup Blood Request
        const reqDoc = await bloodRequest.create({
            bloodGroup: "O+",
            unitsNeeded: 3,
            urgency: "urgent",
            location: {
                city: "Delhi",
                state: "Delhi",
                address: "City Care Hospital"
            },
            status: "active",
            createdBy: testUserId
        });

        console.log("Test fixtures initialized successfully.\n");

        // ==========================================
        // TEST CASES EXECUTION (1 to 25)
        // ==========================================

        console.log("--- 1. Security & Authentication Checks ---");
        // Test 1: Unauthenticated request rejected with 401
        const resUnauth = await makeRequest("GET", "/camps/analytics");
        assert(resUnauth.status === 401, "Test 1: Unauthenticated request returns HTTP 401");

        // Test 2: Standard donor/user role rejected with 403
        const resUserRole = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${userToken}`
        });
        assert(resUserRole.status === 403, "Test 2: Normal user access returns HTTP 403 Forbidden");

        // Test 3: Organizer role authorized with 200
        const resOrg1 = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${organizer1Token}`
        });
        assert(resOrg1.status === 200 && resOrg1.data.success === true, "Test 3: Organizer role authorized with HTTP 200 and success: true");

        // Test 4: Admin role authorized with 200
        const resAdmin = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${adminToken}`
        });
        assert(resAdmin.status === 200 && resAdmin.data.success === true, "Test 4: Admin role authorized with HTTP 200 and success: true");

        console.log("\n--- 2. IDOR Isolation & Scoping Checks ---");
        // Test 5: Organizer 1 only sees their own camps (camp1, camp2 = 2 camps)
        const org1Summary = resOrg1.data.data.summary;
        assert(org1Summary.totalCamps === 2, `Test 5: Organizer 1 sees exactly their 2 camps (got ${org1Summary.totalCamps})`);

        // Test 6: Organizer 1 capacity reflects only camp1(100) + camp2(50) = 150
        assert(org1Summary.totalCapacity === 150, `Test 6: Organizer 1 totalCapacity is exactly 150 (got ${org1Summary.totalCapacity})`);

        // Test 7: Organizer 2 only sees camp 3 (1 camp)
        const resOrg2 = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${organizer2Token}`
        });
        assert(resOrg2.data.data.summary.totalCamps === 1, `Test 7: Organizer 2 sees exactly their 1 camp (got ${resOrg2.data.data.summary.totalCamps})`);
        assert(resOrg2.data.data.summary.totalCapacity === 80, `Test 7b: Organizer 2 totalCapacity is 80 (got ${resOrg2.data.data.summary.totalCapacity})`);

        // Test 8: Admin sees system-wide camps (at least 3 camps)
        const adminSummary = resAdmin.data.data.summary;
        assert(adminSummary.totalCamps >= 3, `Test 8: Admin sees system-wide camps >= 3 (got ${adminSummary.totalCamps})`);

        console.log("\n--- 3. Summary & Capacity Calculations ---");
        // Test 9: Organizer 1 active registrations count
        assert(org1Summary.activeRegistrations === 2, `Test 9: Org1 active registrations is 2 (got ${org1Summary.activeRegistrations})`);

        // Test 10: Organizer 1 capacity utilization calculation (2 / 150 * 100 = 1.3%)
        const expectedUtil = Number(((2 / 150) * 100).toFixed(1));
        assert(org1Summary.capacityUtilization === expectedUtil, `Test 10: Capacity utilization accurate: ${org1Summary.capacityUtilization}%`);

        // Test 11: Organizer 1 camp status breakdown (1 published, 1 completed)
        assert(org1Summary.publishedCamps === 1 && org1Summary.completedCamps === 1, `Test 11: Org1 camp status breakdown: 1 published, 1 completed`);

        // Test 12: Capacity sub-object matches summary metrics
        const org1Cap = resOrg1.data.data.capacity;
        assert(org1Cap.totalCapacity === 150 && org1Cap.activeRegistrations === 2, "Test 12: Capacity sub-object matches summary values");

        console.log("\n--- 4. Donation Tracking Integration ---");
        // Test 13: Organizer 1 totalDonations is 2 (1 completed, 1 scheduled)
        assert(org1Summary.totalDonations === 2, `Test 13: Org1 totalDonations is 2 (got ${org1Summary.totalDonations})`);

        // Test 14: Organizer 1 completedDonations is 1
        assert(org1Summary.completedDonations === 1, `Test 14: Org1 completedDonations is 1 (got ${org1Summary.completedDonations})`);

        // Test 15: Organizer 1 scheduledDonations is 1
        assert(org1Summary.scheduledDonations === 1, `Test 15: Org1 scheduledDonations is 1 (got ${org1Summary.scheduledDonations})`);

        // Test 16: Organizer 1 totalUnitsDonated is 2
        assert(org1Summary.totalUnitsDonated === 2, `Test 16: Org1 totalUnitsDonated is 2 (got ${org1Summary.totalUnitsDonated})`);

        // Test 17: Organizer 1 donations sub-object contains monthly trend
        const org1Don = resOrg1.data.data.donations;
        assert(Array.isArray(org1Don.monthlyTrend) && org1Don.monthlyTrend.length >= 1, "Test 17: Donations sub-object has monthly trend array");
        assert(org1Don.monthlyTrend[0].period === "2026-04" && org1Don.monthlyTrend[0].donations === 1, "Test 17b: Donation trend maps 2026-04 with 1 donation");

        // Test 18: Donations by blood group contains AB+ with 2 units
        const abDonation = org1Don.bloodGroupDistribution.find(b => b.bloodGroup === "AB+");
        assert(abDonation && abDonation.units === 2, `Test 18: Donation blood group AB+ has 2 units (got ${abDonation?.units})`);

        console.log("\n--- 5. Top Camps Ranking & Life-cycle Metrics ---");
        // Test 19: Top Camps list is sorted by completed donations
        const topCamps = resOrg1.data.data.topCamps;
        assert(topCamps.length === 2, `Test 19: Top camps contains 2 camps`);
        assert(topCamps[0].campId === camp2Id.toString(), `Test 19b: Completed camp (#2) is ranked first due to completed donation`);

        // Test 20: Camp lifecycle status distribution has all 4 standard statuses
        const campStatus = resOrg1.data.data.campStatus;
        assert(campStatus.length === 4, `Test 20: Camp lifecycle distribution includes all 4 statuses`);

        console.log("\n--- 6. Date Range Filtering Validation ---");
        // Test 21: Date range filtering (from 2026-04-01 to 2026-04-30 includes only camp2)
        const resFiltered = await makeRequest("GET", "/camps/analytics?from=2026-04-01&to=2026-04-30", {
            Authorization: `Bearer ${organizer1Token}`
        });
        assert(resFiltered.status === 200, "Test 21: Valid date range returns HTTP 200");
        assert(resFiltered.data.data.summary.totalCamps === 1, `Test 21b: Date filtered camps is 1 (got ${resFiltered.data.data.summary.totalCamps})`);
        assert(resFiltered.data.data.summary.completedCamps === 1, `Test 21c: Date filtered camp is the completed camp`);

        // Test 22: Invalid date format returns HTTP 400
        const resBadDate = await makeRequest("GET", "/camps/analytics?from=not-a-date", {
            Authorization: `Bearer ${organizer1Token}`
        });
        assert(resBadDate.status === 400, "Test 22: Invalid date format returns HTTP 400");

        // Test 23: From date after To date returns HTTP 400
        const resInverted = await makeRequest("GET", "/camps/analytics?from=2026-10-01&to=2026-01-01", {
            Authorization: `Bearer ${organizer1Token}`
        });
        assert(resInverted.status === 400, "Test 23: From date after To date returns HTTP 400");

        console.log("\n--- 7. Admin Scope & Zero-PII Verification ---");
        // Test 24: Admin response includes userMetrics and bloodRequestMetrics
        const adminData = resAdmin.data.data;
        assert(adminData.userMetrics !== undefined, "Test 24: Admin response includes userMetrics");
        assert(adminData.bloodRequestMetrics !== undefined, "Test 24b: Admin response includes bloodRequestMetrics");
        assert(adminData.userMetrics.totalRegisteredUsers >= 4, `Test 24c: Admin user count >= 4 (got ${adminData.userMetrics.totalRegisteredUsers})`);
        assert(adminData.bloodRequestMetrics.totalRequests >= 1, `Test 24d: Admin blood request count >= 1 (got ${adminData.bloodRequestMetrics.totalRequests})`);

        // Organizer response does NOT include userMetrics or bloodRequestMetrics
        assert(resOrg1.data.data.userMetrics === undefined, "Test 24e: Organizer response omits userMetrics");
        assert(resOrg1.data.data.bloodRequestMetrics === undefined, "Test 24f: Organizer response omits bloodRequestMetrics");

        // Test 25: Absolute Zero PII verification
        const rawJson = JSON.stringify(resAdmin.data);
        const hasDonorEmail = rawJson.includes(userDoc.email);
        const hasDonorPhone = rawJson.includes(userDoc.phone);
        const hasPassword = rawJson.includes("password") || rawJson.includes("$2b$");
        assert(!hasDonorEmail && !hasDonorPhone && !hasPassword, "Test 25: Zero-PII check: No donor emails, phone numbers, or passwords in analytics payload");

    } catch (err) {
        console.error("Test execution failed with error:", err);
        testsFailed++;
    } finally {
        // Cleanup test data
        try {
            if (testAdminId) await user.deleteOne({ _id: testAdminId });
            if (testOrganizer1Id) await user.deleteOne({ _id: testOrganizer1Id });
            if (testOrganizer2Id) await user.deleteOne({ _id: testOrganizer2Id });
            if (testUserId) await user.deleteOne({ _id: testUserId });

            if (camp1Id) await camp.deleteOne({ _id: camp1Id });
            if (camp2Id) await camp.deleteOne({ _id: camp2Id });
            if (camp3Id) await camp.deleteOne({ _id: camp3Id });

            await campRegistration.deleteMany({ camp: { $in: [camp1Id, camp2Id, camp3Id] } });
            await donation.deleteMany({ camp: { $in: [camp1Id, camp2Id, camp3Id] } });
            await bloodRequest.deleteMany({ patientName: "Emergency Patient" });
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }

        if (server) {
            server.close();
        }
        await mongoose.connection.close();

        console.log("\n==================================================");
        console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
        console.log("==================================================");

        process.exit(testsFailed > 0 ? 1 : 0);
    }
}

runTests();

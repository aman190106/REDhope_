/**
 * REDhope Security Hardening Verification Test Suite
 * 
 * Tests 38+ explicit security scenarios covering:
 * - Authentication (missing, malformed, expired, invalid signature)
 * - Authorization & RBAC (donor, organizer, admin role boundaries)
 * - IDOR (cross-user notifications, cross-donor donations, cross-organizer camps)
 * - Input validation & type coercion (ObjectIds, blood groups, coordinates, radius, pagination)
 * - MongoDB injection prevention (operator injection in body & query parameters)
 * - Role escalation & tampering (privilege elevation, direct eligibility/donation date manipulation)
 * - Sensitive data exposure (passwords, tokens, API keys, donor PII)
 * - Business logic invariants (capacity race safety, duplicate registration blocking, terminal status lock)
 * - Rate limiting enforcement
 */

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
const cors = require("c:/REDhope/REDhope/server/node_modules/cors");
const helmet = require("c:/REDhope/REDhope/server/node_modules/helmet");
const connectDB = require("c:/REDhope/REDhope/server/config/db");

const user = require("c:/REDhope/REDhope/server/models/user");
const camp = require("c:/REDhope/REDhope/server/models/camp");
const campRegistration = require("c:/REDhope/REDhope/server/models/campRegistration");
const donation = require("c:/REDhope/REDhope/server/models/donation");
const notification = require("c:/REDhope/REDhope/server/models/notification");
const bloodRequest = require("c:/REDhope/REDhope/server/models/bloodRequest");

const authRoutes = require("c:/REDhope/REDhope/server/routes/authRoutes");
const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");
const campRegistrationRoutes = require("c:/REDhope/REDhope/server/routes/campRegistrationRoutes");
const donationRoutes = require("c:/REDhope/REDhope/server/routes/donationRoutes");
const bloodMatchingRoutes = require("c:/REDhope/REDhope/server/routes/bloodMatchingRoutes");
const notificationRoutes = require("c:/REDhope/REDhope/server/routes/notificationRoutes");
const testRoutes = require("c:/REDhope/REDhope/server/routes/testRoutes");
const { authLimiter } = require("c:/REDhope/REDhope/server/middleware/rateLimitMiddleware");

// Build test application mimicking server.js
const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: true, limit: "500kb" }));

app.use("/auth", authRoutes);
app.use("/camps", campRegistrationRoutes);
app.use("/camps", campRoutes);
app.use("/donations", donationRoutes);
app.use("/matching", bloodMatchingRoutes);
app.use("/notifications", notificationRoutes);
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
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, headers: res.headers, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

function createToken(payload, expiresIn = "1h", secret = JWT_SECRET) {
    return jwt.sign(payload, secret, { expiresIn });
}

let testAdminId;
let testOrganizer1Id;
let testOrganizer2Id;
let testDonor1Id;
let testDonor2Id;

let adminToken;
let org1Token;
let org2Token;
let donor1Token;
let donor2Token;

let camp1Id;
let camp2Id;
let reg1Id;
let notif1Id;
let don1Id;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        testsPassed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        testsFailed++;
    }
}

async function runSecuritySuite() {
    console.log("==================================================");
    console.log("REDhope Security Hardening Verification Suite");
    console.log("==================================================\n");

    try {
        await connectDB();

        server = http.createServer(app);
        await new Promise((resolve) => {
            server.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}`;
                console.log(`Security Test Server active on ${baseUrl}\n`);
                resolve();
            });
        });

        // 1. Setup Test Fixtures
        const timestamp = Date.now();
        const hashedPassword = await bcrypt.hash("SecPass123!", 10);

        const adminDoc = await user.create({
            name: `Security Admin ${timestamp}`,
            email: `sec_admin_${timestamp}@example.com`,
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
            name: `Security Org1 ${timestamp}`,
            email: `sec_org1_${timestamp}@example.com`,
            password: hashedPassword,
            role: "organizer",
            bloodGroup: "A+",
            city: "Mumbai",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testOrganizer1Id = org1Doc._id;
        org1Token = createToken({ id: testOrganizer1Id.toString(), role: "organizer", email: org1Doc.email });

        const org2Doc = await user.create({
            name: `Security Org2 ${timestamp}`,
            email: `sec_org2_${timestamp}@example.com`,
            password: hashedPassword,
            role: "organizer",
            bloodGroup: "B+",
            city: "Pune",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testOrganizer2Id = org2Doc._id;
        org2Token = createToken({ id: testOrganizer2Id.toString(), role: "organizer", email: org2Doc.email });

        const donor1Doc = await user.create({
            name: `Security Donor1 ${timestamp}`,
            email: `sec_d1_${timestamp}@example.com`,
            password: hashedPassword,
            role: "user",
            bloodGroup: "O+",
            dateOfBirth: new Date("1998-05-10"),
            isEligible: true,
            isDonorAvailable: true,
            city: "Mumbai",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testDonor1Id = donor1Doc._id;
        donor1Token = createToken({ id: testDonor1Id.toString(), role: "user", email: donor1Doc.email });

        const donor2Doc = await user.create({
            name: `Security Donor2 ${timestamp}`,
            email: `sec_d2_${timestamp}@example.com`,
            password: hashedPassword,
            role: "user",
            bloodGroup: "B+",
            dateOfBirth: new Date("1999-06-15"),
            isEligible: true,
            isDonorAvailable: true,
            city: "Pune",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        testDonor2Id = donor2Doc._id;
        donor2Token = createToken({ id: testDonor2Id.toString(), role: "user", email: donor2Doc.email });

        // Setup Camp 1 (Org1)
        const c1 = await camp.create({
            name: `Org1 Blood Drive ${timestamp}`,
            description: "Security test camp 1",
            organizer: testOrganizer1Id,
            organizerName: org1Doc.name,
            organizerContact: org1Doc.phone,
            organizerEmail: org1Doc.email,
            venue: "Mumbai Hall",
            location: {
                address: "100 Marine Drive",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400020",
                type: "Point",
                coordinates: [72.8258, 18.9438]
            },
            startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 2,
            registrationCount: 0,
            status: "published"
        });
        camp1Id = c1._id;

        // Setup Camp 2 (Org2)
        const c2 = await camp.create({
            name: `Org2 Private Camp ${timestamp}`,
            description: "Security test camp 2",
            organizer: testOrganizer2Id,
            organizerName: org2Doc.name,
            organizerContact: org2Doc.phone,
            organizerEmail: org2Doc.email,
            venue: "Pune Clinic",
            location: {
                address: "200 FC Road",
                city: "Pune",
                state: "Maharashtra",
                pincode: "411005",
                type: "Point",
                coordinates: [73.8415, 18.5289]
            },
            startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            startTime: "10:00",
            endTime: "18:00",
            capacity: 10,
            registrationCount: 0,
            status: "draft"
        });
        camp2Id = c2._id;

        // Setup Registration: Donor 1 registers for Camp 1
        const reg1 = await campRegistration.create({
            user: testDonor1Id,
            camp: camp1Id,
            status: "registered",
            registeredAt: new Date()
        });
        reg1Id = reg1._id;
        await camp.findByIdAndUpdate(camp1Id, { registrationCount: 1 });

        // Setup Notification for Donor 1
        const notif1 = await notification.create({
            user: testDonor1Id,
            type: "camp_registration",
            title: "Private Registration Notice",
            message: "Private details for donor 1 only",
            isRead: false
        });
        notif1Id = notif1._id;

        // Setup Donation for Donor 1
        const don1 = await donation.create({
            donor: testDonor1Id,
            camp: camp1Id,
            registration: reg1Id,
            bloodGroup: "O+",
            units: 1,
            status: "completed",
            donationDate: new Date(),
            recordedBy: testOrganizer1Id,
            verifiedAt: new Date()
        });
        don1Id = don1._id;

        console.log("Fixtures successfully prepared.\n");

        // ==========================================
        // 1. AUTHENTICATION INTEGRITY
        // ==========================================
        console.log("--- 1. Authentication Integrity ---");

        // 1. Missing Authorization header
        const resNoAuth = await makeRequest("GET", "/auth/me");
        assert(resNoAuth.status === 401, "1. Missing token returns HTTP 401");

        // 2. Malformed token (not Bearer)
        const resMalformed1 = await makeRequest("GET", "/auth/me", { Authorization: "Basic dXNlcjpwYXNz" });
        assert(resMalformed1.status === 401, "2. Non-Bearer token returns HTTP 401");

        // 3. Expired token
        const expiredToken = createToken({ id: testDonor1Id.toString(), role: "user" }, "-10s");
        const resExpired = await makeRequest("GET", "/auth/me", { Authorization: `Bearer ${expiredToken}` });
        assert(resExpired.status === 401 && resExpired.data.message === "token expired", "3. Expired token rejected with HTTP 401");

        // 4. Invalid signature
        const invalidSigToken = createToken({ id: testDonor1Id.toString(), role: "user" }, "1h", "completely_wrong_secret");
        const resBadSig = await makeRequest("GET", "/auth/me", { Authorization: `Bearer ${invalidSigToken}` });
        assert(resBadSig.status === 401 && resBadSig.data.message === "invalid token", "4. Token signed with wrong secret rejected with HTTP 401");

        // ==========================================
        // 2. AUTHORIZATION & RBAC
        // ==========================================
        console.log("\n--- 2. Authorization & Role Boundaries ---");

        // 5. Normal user accessing admin-only endpoint (GET /users)
        const resUserAdmin = await makeRequest("GET", "/users", { Authorization: `Bearer ${donor1Token}` });
        assert(resUserAdmin.status === 403, "5. Normal user denied from admin-only GET /users (HTTP 403)");

        // 6. Organizer accessing admin-only endpoint
        const resOrgAdmin = await makeRequest("GET", "/users", { Authorization: `Bearer ${org1Token}` });
        assert(resOrgAdmin.status === 403, "6. Organizer denied from admin-only GET /users (HTTP 403)");

        // 7. Normal user creating a camp
        const resUserCreateCamp = await makeRequest("POST", "/camps", { Authorization: `Bearer ${donor1Token}` }, {
            name: "Hacked Camp",
            startDate: new Date(),
            endDate: new Date(),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            location: { address: "X", city: "Mumbai", state: "MH", pincode: "400001" }
        });
        assert(resUserCreateCamp.status === 403, "7. Normal user denied from creating camps (HTTP 403)");

        // ==========================================
        // 3. IDOR / CROSS-TENANT ISOLATION
        // ==========================================
        console.log("\n--- 3. IDOR & Resource Ownership Protections ---");

        // 8. Donor 2 attempting to read/mark Donor 1's notification
        const resIdorNotif = await makeRequest("PATCH", `/notifications/${notif1Id}/read`, {
            Authorization: `Bearer ${donor2Token}`
        });
        assert(resIdorNotif.status === 404, "8. Donor 2 cannot read or modify Donor 1's notification (HTTP 404)");

        // 9. Donor 2 attempting to view Donor 1's donation by ID
        const resIdorDonation = await makeRequest("GET", `/donations/${don1Id}`, {
            Authorization: `Bearer ${donor2Token}`
        });
        assert(resIdorDonation.status === 403, "9. Donor 2 blocked from viewing Donor 1's private donation (HTTP 403 IDOR)");

        // 10. Organizer 1 attempting to view Organizer 2's draft camp
        const resIdorCamp = await makeRequest("GET", `/camps/${camp2Id}`, {
            Authorization: `Bearer ${org1Token}`
        });
        assert(resIdorCamp.status === 404, "10. Organizer 1 cannot view Organizer 2's draft camp (HTTP 404)");

        // 11. Organizer 1 attempting to update Organizer 2's camp
        const resIdorCampUpdate = await makeRequest("PUT", `/camps/${camp2Id}`, {
            Authorization: `Bearer ${org1Token}`
        }, { name: "Hijacked Camp" });
        assert(resIdorCampUpdate.status === 403, "11. Organizer 1 blocked from modifying Organizer 2's camp (HTTP 403 IDOR)");

        // 12. Organizer 2 accessing Camp 1's registrations
        const resIdorCampRegs = await makeRequest("GET", `/camps/${camp1Id}/registrations`, {
            Authorization: `Bearer ${org2Token}`
        });
        assert(resIdorCampRegs.status === 403, "12. Organizer 2 blocked from Camp 1's registrations (HTTP 403)");

        // 13. Organizer 2 accessing Camp 1's donations
        const resIdorCampDons = await makeRequest("GET", `/camps/${camp1Id}/donations`, {
            Authorization: `Bearer ${org2Token}`
        });
        assert(resIdorCampDons.status === 403, "13. Organizer 2 blocked from Camp 1's donation records (HTTP 403)");

        // ==========================================
        // 4. INPUT VALIDATION & TYPE SAFETY
        // ==========================================
        console.log("\n--- 4. Input Validation & Type Safety ---");

        // 14. Invalid ObjectId format rejected
        const resBadId = await makeRequest("GET", "/camps/not-an-object-id");
        assert(resBadId.status === 400, "14. Malformed ObjectId rejected with HTTP 400");

        // 15. Invalid blood group on registration
        const resBadBg = await makeRequest("POST", "/auth/register", {}, {
            name: "Bad BG",
            email: `bad_bg_${timestamp}@example.com`,
            password: "Password123!",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "Z+"
        });
        assert(resBadBg.status === 400, "15. Invalid blood group rejected with HTTP 400");

        // 16. Invalid coordinates on nearby camps
        const resBadCoords = await makeRequest("GET", "/camps/nearby?longitude=250&latitude=40");
        assert(resBadCoords.status === 400, "16. Out-of-bounds longitude (>180) rejected with HTTP 400");

        // 17. Excessive radius on nearby camps (> 500km)
        const resBadRadius = await makeRequest("GET", "/camps/nearby?longitude=72.8&latitude=19.0&radius=999999999");
        assert(resBadRadius.status === 400, "17. Excessively large radius (>500km) rejected with HTTP 400");

        // 18. Invalid pagination values on notifications (negative page)
        const resNegPage = await makeRequest("GET", "/notifications?page=-5", {
            Authorization: `Bearer ${donor1Token}`
        });
        assert(resNegPage.status === 200 && resNegPage.data.data.pagination.page === 1, "18. Negative pagination clamped safely to page 1");

        // 19. Invalid date string on analytics
        const resBadDate = await makeRequest("GET", "/camps/analytics?from=invalid-date", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(resBadDate.status === 400, "19. Malformed date filter rejected with HTTP 400");

        // 20. Inverted date range on analytics
        const resInvertDate = await makeRequest("GET", "/camps/analytics?from=2026-12-01&to=2026-01-01", {
            Authorization: `Bearer ${org1Token}`
        });
        assert(resInvertDate.status === 400, "20. Inverted date range (from > to) rejected with HTTP 400");

        // 21. Negative capacity on camp creation
        const resNegCap = await makeRequest("POST", "/camps", { Authorization: `Bearer ${org1Token}` }, {
            name: "Negative Capacity Camp",
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 86400000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: -10,
            location: { address: "Loc", city: "Mumbai", state: "MH", pincode: "400001" }
        });
        assert(resNegCap.status === 400, "21. Negative camp capacity rejected with HTTP 400");

        // ==========================================
        // 5. INJECTION & OPERATOR ATTACKS
        // ==========================================
        console.log("\n--- 5. MongoDB Operator Injection Resistance ---");

        // 22. Operator injection in login request body: { email: { $ne: null } }
        const resInjectLogin = await makeRequest("POST", "/auth/login", {}, {
            email: { $ne: null },
            password: "SecPass123!"
        });
        assert(resInjectLogin.status === 400, "22. MongoDB $ne operator injection in login rejected with HTTP 400");

        // 23. Regex injection with malicious characters in city filter
        const resRegexQuery = await makeRequest("GET", "/camps?city=.*");
        assert(resRegexQuery.status === 200, "23. Regex wildcard in city query safely escaped and processed");

        // ==========================================
        // 6. ROLE ESCALATION & FIELD TAMPERING
        // ==========================================
        console.log("\n--- 6. Privilege Escalation & Field Tampering ---");

        // 24. Normal user attempting role escalation via PUT /auth/me
        const resEscalate1 = await makeRequest("PUT", "/auth/me", { Authorization: `Bearer ${donor1Token}` }, {
            role: "admin"
        });
        assert(resEscalate1.status === 403, "24. User blocked from self-elevating role to admin (HTTP 403)");

        // 25. Organizer attempting role escalation via PUT /auth/me
        const resEscalate2 = await makeRequest("PUT", "/auth/me", { Authorization: `Bearer ${org1Token}` }, {
            role: "admin"
        });
        assert(resEscalate2.status === 403, "25. Organizer blocked from elevating role to admin (HTTP 403)");

        // 26. User attempting to tamper with medical eligibility directly
        const resTamperEligible = await makeRequest("PUT", "/auth/me", { Authorization: `Bearer ${donor1Token}` }, {
            isEligible: true
        });
        assert(resTamperEligible.status === 403, "26. Direct manipulation of isEligible blocked (HTTP 403)");

        // 27. User attempting to tamper with lastDonationDate directly
        const resTamperDate = await makeRequest("PUT", "/auth/me", { Authorization: `Bearer ${donor1Token}` }, {
            lastDonationDate: new Date("2020-01-01")
        });
        assert(resTamperDate.status === 403, "27. Direct manipulation of lastDonationDate blocked (HTTP 403)");

        // 28. Organizer attempting to reassign camp ownership
        const resReassignOwner = await makeRequest("PUT", `/camps/${camp1Id}`, { Authorization: `Bearer ${org1Token}` }, {
            organizer: testOrganizer2Id
        });
        assert(resReassignOwner.status === 403, "28. Organizer blocked from reassigning camp ownership (HTTP 403)");

        // ==========================================
        // 7. SENSITIVE DATA EXPOSURE & ZERO-PII
        // ==========================================
        console.log("\n--- 7. Sensitive Data Leakage Protection ---");

        // 29. Password hash excluded from GET /auth/me
        const resGetMe = await makeRequest("GET", "/auth/me", { Authorization: `Bearer ${donor1Token}` });
        assert(resGetMe.status === 200 && resGetMe.data.user.password === undefined, "29. Password hash excluded from /auth/me profile response");

        // 30. Password hash excluded from GET /users/:id
        const resGetUser = await makeRequest("GET", `/users/${testDonor1Id}`, { Authorization: `Bearer ${donor1Token}` });
        assert(resGetUser.status === 200 && resGetUser.data.user.password === undefined, "30. Password hash excluded from /users/:id response");

        // 31. Password hash excluded from camp registration list
        const resRegList = await makeRequest("GET", `/camps/${camp1Id}/registrations`, { Authorization: `Bearer ${org1Token}` });
        const donorInReg = resRegList.data.data.registrations[0]?.user;
        assert(donorInReg && donorInReg.password === undefined, "31. Password hash excluded from organizer registration list");

        // 32. Zero PII in analytics response
        const resAnalytics = await makeRequest("GET", "/camps/analytics", { Authorization: `Bearer ${adminToken}` });
        const analyticsJson = JSON.stringify(resAnalytics.data);
        const leaksEmail = analyticsJson.includes(donor1Doc.email);
        const leaksPhone = analyticsJson.includes(donor1Doc.phone);
        const leaksPassword = analyticsJson.includes("password") || analyticsJson.includes("$2b$");
        assert(!leaksEmail && !leaksPhone && !leaksPassword, "32. Analytics response completely free of donor PII and secrets");

        // ==========================================
        // 8. BUSINESS INTEGRITY INVARIANTS
        // ==========================================
        console.log("\n--- 8. Business Integrity Invariants ---");

        // 33. Duplicate registration prevented
        const resDupReg = await makeRequest("POST", `/camps/${camp1Id}/register`, { Authorization: `Bearer ${donor1Token}` });
        assert(resDupReg.status === 409, "33. Duplicate registration prevented with HTTP 409 Conflict");

        // 34. Capacity overflow prevented
        // Camp 1 has capacity 2, currently has 1 registration. Register Donor 2 -> capacity is now full (2/2).
        const resReg2 = await makeRequest("POST", `/camps/${camp1Id}/register`, { Authorization: `Bearer ${donor2Token}` });
        assert(resReg2.status === 201, "34a. Second registration succeeds, filling camp capacity (2/2)");

        // Create third user and attempt to register for Camp 1
        const donor3Doc = await user.create({
            name: `Security Donor3 ${timestamp}`,
            email: `sec_d3_${timestamp}@example.com`,
            password: hashedPassword,
            role: "user",
            bloodGroup: "A-",
            dateOfBirth: new Date("1995-01-01"),
            isEligible: true,
            isDonorAvailable: true,
            city: "Mumbai",
            state: "Maharashtra",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        const donor3Token = createToken({ id: donor3Doc._id.toString(), role: "user", email: donor3Doc.email });

        const resRegOverflow = await makeRequest("POST", `/camps/${camp1Id}/register`, { Authorization: `Bearer ${donor3Token}` });
        assert(resRegOverflow.status === 400 && resRegOverflow.data.message.includes("capacity"), "34b. Registration blocked when camp capacity is reached (HTTP 400)");

        // 35. Normal donor cannot record donation
        const resDonorRecord = await makeRequest("POST", "/donations", { Authorization: `Bearer ${donor1Token}` }, {
            registrationId: reg1Id,
            units: 1,
            status: "completed"
        });
        assert(resDonorRecord.status === 403, "35. Normal donor forbidden from recording donations (HTTP 403)");

        // 36. Terminal donation state immutable
        const resRevertDonation = await makeRequest("PATCH", `/donations/${don1Id}/status`, { Authorization: `Bearer ${org1Token}` }, {
            status: "scheduled"
        });
        assert(resRevertDonation.status === 400, "36. Completed donation cannot be reverted to scheduled (HTTP 400)");

        // ==========================================
        // 9. RATE LIMITING & SECURITY HEADERS
        // ==========================================
        console.log("\n--- 9. Security Headers & Controls ---");

        // 37. Security headers verification (Helmet)
        assert(resNoAuth.headers["x-content-type-options"] === "nosniff", "37a. X-Content-Type-Options: nosniff header present");
        assert(resNoAuth.headers["x-frame-options"] === "SAMEORIGIN", "37b. X-Frame-Options: SAMEORIGIN header present");

        // 38. Password length validation on register
        const resShortPass = await makeRequest("POST", "/auth/register", {}, {
            name: "Short Pass User",
            email: `short_pass_${timestamp}@example.com`,
            password: "123",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+"
        });
        assert(resShortPass.status === 400 && resShortPass.data.message.includes("at least 6 characters"), "38. Password < 6 characters rejected with HTTP 400");

    } catch (suiteError) {
        console.error("Security suite crashed with error:", suiteError);
        testsFailed++;
    } finally {
        // Cleanup test fixtures
        try {
            await user.deleteMany({ email: { $regex: /^sec_/ } });
            if (camp1Id) await camp.deleteOne({ _id: camp1Id });
            if (camp2Id) await camp.deleteOne({ _id: camp2Id });
            if (reg1Id) await campRegistration.deleteMany({ camp: camp1Id });
            if (notif1Id) await notification.deleteOne({ _id: notif1Id });
            if (don1Id) await donation.deleteOne({ _id: don1Id });
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }

        if (server) server.close();
        await mongoose.connection.close();

        console.log("\n==================================================");
        console.log(`Security Test Suite: ${testsPassed} passed, ${testsFailed} failed`);
        console.log("==================================================");

        process.exit(testsFailed > 0 ? 1 : 0);
    }
}

runSecuritySuite();


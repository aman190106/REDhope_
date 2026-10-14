/**
 * REDhope User CRUD & Authentication Verification Test Suite
 * 
 * Verifies:
 * - User registration (POST /auth/register and POST /users)
 * - Duplicate email & duplicate phone rejection (HTTP 400)
 * - Registration field validation (email, phone, blood group, password length)
 * - Authentication (login success, bad password, non-existent user)
 * - GET /users (Admin-only RBAC, forbidden for users/organizers, password omission)
 * - GET /users/:id (Self access, Admin access, forbidden for other users, 404 for missing, password omission)
 * - PUT /users/:id (Self updates, privilege escalation prevention, duplicate email/phone on update, admin updates)
 * - DELETE /users/:id (Self deletion, Admin deletion, forbidden for other users, 404 for missing/already deleted)
 * - Complete zero-password-leak assertion across all endpoints
 */

const http = require("http");
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
const authRoutes = require("c:/REDhope/REDhope/server/routes/authRoutes");
const testRoutes = require("c:/REDhope/REDhope/server/routes/testRoutes");

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: true, limit: "500kb" }));

app.use("/auth", authRoutes);
app.use("/", testRoutes);

let server;
let serverPort;

function apiRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const headers = {
            "Content-Type": "application/json"
        };
        if (payload) {
            headers["Content-Length"] = Buffer.byteLength(payload);
        }
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const req = http.request(
            {
                hostname: "127.0.0.1",
                port: serverPort,
                path,
                method,
                headers
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    let json = null;
                    try {
                        json = JSON.parse(data);
                    } catch (e) {
                        json = data;
                    }
                    resolve({ status: res.statusCode, headers: res.headers, body: json });
                });
            }
        );

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

let passed = 0;
let failed = 0;

function assert(description, condition) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${description}`);
    } else {
        failed++;
        console.error(`  ✗ FAIL: ${description}`);
    }
}

async function runTestSuite() {
    console.log("==================================================================");
    console.log("🚀 REDhope User CRUD & Authentication Verification Test Suite");
    console.log("==================================================================\n");

    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            serverPort = server.address().port;
            console.log(`Test server running on port ${serverPort}\n`);
            resolve();
        });
    });

    const runId = Date.now().toString().slice(-6);

    // Track disposable users
    const disposableUserIds = [];

    try {
        // --- 1. User Registration via /auth/register and /users ---
        console.log("🔹 Test Group 1: User Registration (/auth/register & /users)");

        const regPayload1 = {
            name: "Donor Alpha",
            email: `donor.alpha.${runId}@test.com`,
            password: "password123",
            phone: `91${runId.padStart(8, "0")}`.slice(0, 10),
            bloodGroup: "O+",
            gender: "male",
            dateOfBirth: "1995-05-15"
        };

        const res1 = await apiRequest("POST", "/auth/register", regPayload1);
        assert("Registration via /auth/register returns 201", res1.status === 201);
        assert("Registration returns data object", Boolean(res1.body?.data));
        assert("Registration returns user ID", Boolean(res1.body?.data?._id));
        assert("Registration omits password from returned data", res1.body?.data?.password === undefined);
        assert("Registered user role defaults to 'user'", res1.body?.data?.role === "user");
        
        const donorAlphaId = res1.body?.data?._id;
        if (donorAlphaId) disposableUserIds.push(donorAlphaId);

        // Registration via /users (testRoutes.js POST /users)
        const regPayload2 = {
            name: "Donor Beta",
            email: `donor.beta.${runId}@test.com`,
            password: "password123",
            phone: `92${runId.padStart(8, "0")}`.slice(0, 10),
            bloodGroup: "A+",
            gender: "female",
            dateOfBirth: "1998-03-20"
        };

        const res2 = await apiRequest("POST", "/users", regPayload2);
        assert("Registration via /users returns 201", res2.status === 201);
        assert("Registration via /users returns data object", Boolean(res2.body?.data));
        assert("Registration via /users omits password", res2.body?.data?.password === undefined);
        
        const donorBetaId = res2.body?.data?._id;
        if (donorBetaId) disposableUserIds.push(donorBetaId);

        // Authenticate Donor Alpha and Donor Beta via POST /auth/login
        const loginAlpha = await apiRequest("POST", "/auth/login", {
            email: regPayload1.email,
            password: regPayload1.password
        });
        assert("Login for Donor Alpha succeeds (200)", loginAlpha.status === 200);
        const tokenDonorAlpha = loginAlpha.body?.token;
        assert("Token for Donor Alpha received", Boolean(tokenDonorAlpha));

        const loginBeta = await apiRequest("POST", "/auth/login", {
            email: regPayload2.email,
            password: regPayload2.password
        });
        assert("Login for Donor Beta succeeds (200)", loginBeta.status === 200);
        const tokenDonorBeta = loginBeta.body?.token;
        assert("Token for Donor Beta received", Boolean(tokenDonorBeta));

        // Create an Admin user in DB
        const adminEmail = `admin.${runId}@test.com`;
        const adminPhone = `93${runId.padStart(8, "0")}`.slice(0, 10);
        const hashedPassword = await bcrypt.hash("adminPass123", 10);
        const adminDoc = await user.create({
            name: "Admin User",
            email: adminEmail,
            password: hashedPassword,
            phone: adminPhone,
            bloodGroup: "B+",
            role: "admin",
            gender: "prefer_not_to_say"
        });
        disposableUserIds.push(adminDoc._id.toString());
        const tokenAdmin = jwt.sign(
            { id: adminDoc._id.toString(), email: adminDoc.email, role: adminDoc.role },
            process.env.JWT_SECRET || "default_jwt_secret_for_development_redhope",
            { expiresIn: "1h" }
        );

        // --- 2. Duplicate Email & Phone Rejection ---
        console.log("\n🔹 Test Group 2: Duplicate Email & Phone Enforcement");

        const duplicateEmailPayload = {
            name: "Duplicate Email Test",
            email: regPayload1.email, // Same email as donor Alpha
            password: "password123",
            phone: `94${runId.padStart(8, "0")}`.slice(0, 10),
            bloodGroup: "AB+"
        };
        const dupEmailRes = await apiRequest("POST", "/auth/register", duplicateEmailPayload);
        assert("Duplicate email returns HTTP 400", dupEmailRes.status === 400);
        assert("Duplicate email returns error message", dupEmailRes.body?.message?.includes("mail id already exist") || dupEmailRes.body?.message?.includes("exist"));

        const duplicatePhonePayload = {
            name: "Duplicate Phone Test",
            email: `unique.${runId}@test.com`,
            password: "password123",
            phone: regPayload1.phone, // Same phone as donor Alpha
            bloodGroup: "AB+"
        };
        const dupPhoneRes = await apiRequest("POST", "/auth/register", duplicatePhonePayload);
        assert("Duplicate phone returns HTTP 400", dupPhoneRes.status === 400);
        assert("Duplicate phone returns error message", dupPhoneRes.body?.message?.includes("phone number already exist") || dupPhoneRes.body?.message?.includes("exist"));

        // --- 3. Registration Input Validation ---
        console.log("\n🔹 Test Group 3: Input Validation");

        const badEmailRes = await apiRequest("POST", "/auth/register", {
            ...regPayload1,
            email: "invalid-email-address",
            phone: `95${runId.padStart(8, "0")}`.slice(0, 10)
        });
        assert("Invalid email syntax rejected (400)", badEmailRes.status === 400);

        const badPhoneRes = await apiRequest("POST", "/auth/register", {
            ...regPayload1,
            email: `valid.email.${runId}@test.com`,
            phone: "12345" // Invalid Indian phone format
        });
        assert("Invalid phone syntax rejected (400)", badPhoneRes.status === 400);

        const badBloodRes = await apiRequest("POST", "/auth/register", {
            ...regPayload1,
            email: `valid.blood.${runId}@test.com`,
            phone: `96${runId.padStart(8, "0")}`.slice(0, 10),
            bloodGroup: "XYZ+"
        });
        assert("Invalid blood group rejected (400)", badBloodRes.status === 400);

        const shortPassRes = await apiRequest("POST", "/auth/register", {
            ...regPayload1,
            email: `valid.pass.${runId}@test.com`,
            phone: `97${runId.padStart(8, "0")}`.slice(0, 10),
            password: "123" // < 6 chars
        });
        assert("Password < 6 characters rejected (400)", shortPassRes.status === 400);

        // --- 4. Authentication (Login) ---
        console.log("\n🔹 Test Group 4: Authentication");

        const loginSuccessRes = await apiRequest("POST", "/auth/login", {
            email: regPayload1.email,
            password: "password123"
        });
        assert("Login with valid credentials returns 200", loginSuccessRes.status === 200);
        assert("Login returns valid JWT token", Boolean(loginSuccessRes.body?.token));
        assert("Login returns user data", Boolean(loginSuccessRes.body?.user));
        assert("Login omits password hash", loginSuccessRes.body?.user?.password === undefined);

        const loginBadPassRes = await apiRequest("POST", "/auth/login", {
            email: regPayload1.email,
            password: "wrongPassword"
        });
        assert("Login with wrong password returns 401", loginBadPassRes.status === 401);

        const loginNoUserRes = await apiRequest("POST", "/auth/login", {
            email: `nonexistent.${runId}@test.com`,
            password: "password123"
        });
        assert("Login with non-existent email returns 401", loginNoUserRes.status === 401);

        // --- 5. GET /users (Admin Only) ---
        console.log("\n🔹 Test Group 5: GET /users (RBAC & PII Safety)");

        const getUsersNoAuth = await apiRequest("GET", "/users");
        assert("GET /users without token returns 401", getUsersNoAuth.status === 401);

        const getUsersDonor = await apiRequest("GET", "/users", null, tokenDonorAlpha);
        assert("GET /users with normal user token returns 403 (Forbidden)", getUsersDonor.status === 403);

        const getUsersAdmin = await apiRequest("GET", "/users", null, tokenAdmin);
        assert("GET /users with admin token returns 200", getUsersAdmin.status === 200);
        assert("GET /users returns array of users", Array.isArray(getUsersAdmin.body?.users));
        assert("GET /users returns count matching array length", getUsersAdmin.body?.count === getUsersAdmin.body?.users?.length);
        const passwordsInList = getUsersAdmin.body?.users?.some(u => u.password !== undefined);
        assert("GET /users strictly omits password hashes from all user objects", passwordsInList === false);

        // --- 6. GET /users/:id (Self or Admin) ---
        console.log("\n🔹 Test Group 6: GET /users/:id (Self or Admin Access Control)");

        const getUserNoAuth = await apiRequest("GET", `/users/${donorAlphaId}`);
        assert("GET /users/:id without token returns 401", getUserNoAuth.status === 401);

        const getUserBadId = await apiRequest("GET", "/users/not-a-valid-id", null, tokenDonorAlpha);
        assert("GET /users/:id with malformed ObjectId returns 400", getUserBadId.status === 400);

        const nonExistentId = new mongoose.Types.ObjectId().toString();
        const getUserMissing = await apiRequest("GET", `/users/${nonExistentId}`, null, tokenAdmin);
        assert("GET /users/:id for non-existent ID returns 404", getUserMissing.status === 404);

        // Cross-user IDOR attempt: Donor Alpha querying Donor Beta's ID
        const getCrossUser = await apiRequest("GET", `/users/${donorBetaId}`, null, tokenDonorAlpha);
        assert("Cross-user GET /users/:id returns 403 (IDOR protected)", getCrossUser.status === 403);

        // Self access: Donor Alpha querying own ID
        const getSelf = await apiRequest("GET", `/users/${donorAlphaId}`, null, tokenDonorAlpha);
        assert("Self GET /users/:id returns 200", getSelf.status === 200);
        assert("Self GET /users/:id returns correct user name", getSelf.body?.user?.name === "Donor Alpha");
        assert("Self GET /users/:id omits password", getSelf.body?.user?.password === undefined);

        // Admin access: Admin querying Donor Alpha's ID
        const getAdminQuery = await apiRequest("GET", `/users/${donorAlphaId}`, null, tokenAdmin);
        assert("Admin GET /users/:id for another user returns 200", getAdminQuery.status === 200);
        assert("Admin GET /users/:id omits password", getAdminQuery.body?.user?.password === undefined);

        // --- 7. PUT /users/:id (Updates, Privilege Escalation Prevention) ---
        console.log("\n🔹 Test Group 7: PUT /users/:id (Updates & Privilege Escalation)");

        // Cross-user edit attempt: Donor Alpha trying to edit Donor Beta
        const crossEditRes = await apiRequest("PUT", `/users/${donorBetaId}`, { name: "Hacked Name" }, tokenDonorAlpha);
        assert("Cross-user PUT /users/:id returns 403", crossEditRes.status === 403);

        // Privilege escalation attempt: Donor Alpha trying to make themselves admin
        const escalateRoleRes = await apiRequest("PUT", `/users/${donorAlphaId}`, { role: "admin" }, tokenDonorAlpha);
        assert("Donor attempting to change role to admin returns 403", escalateRoleRes.status === 403);

        // Eligibility manipulation attempt: Donor Alpha trying to set isEligible directly
        const tamperEligibleRes = await apiRequest("PUT", `/users/${donorAlphaId}`, { isEligible: true }, tokenDonorAlpha);
        assert("Donor attempting to tamper isEligible directly returns 403", tamperEligibleRes.status === 403);

        // Last donation date manipulation attempt
        const tamperDateRes = await apiRequest("PUT", `/users/${donorAlphaId}`, { lastDonationDate: new Date() }, tokenDonorAlpha);
        assert("Donor attempting to tamper lastDonationDate directly returns 403", tamperDateRes.status === 403);

        // Valid self-update by Donor Alpha
        const validUpdateRes = await apiRequest(
            "PUT",
            `/users/${donorAlphaId}`,
            {
                name: "Donor Alpha Updated",
                isDonorAvailable: false
            },
            tokenDonorAlpha
        );
        assert("Valid self-update returns 200", validUpdateRes.status === 200);
        assert("Updated name is reflected", validUpdateRes.body?.user?.name === "Donor Alpha Updated");
        assert("Updated isDonorAvailable is false", validUpdateRes.body?.user?.isDonorAvailable === false);
        assert("PUT /users/:id omits password", validUpdateRes.body?.user?.password === undefined);

        // Attempting to change email to Donor Beta's email
        const dupEmailUpdateRes = await apiRequest(
            "PUT",
            `/users/${donorAlphaId}`,
            { email: regPayload2.email },
            tokenDonorAlpha
        );
        assert("Updating email to existing email returns 400", dupEmailUpdateRes.status === 400);

        // Admin legitimate update on user (can change role and isEligible)
        const adminUpdateRes = await apiRequest(
            "PUT",
            `/users/${donorBetaId}`,
            {
                role: "organizer",
                isEligible: false
            },
            tokenAdmin
        );
        assert("Admin update on user returns 200", adminUpdateRes.status === 200);
        assert("Admin can update role to organizer", adminUpdateRes.body?.user?.role === "organizer");
        assert("Admin can update isEligible to false", adminUpdateRes.body?.user?.isEligible === false);

        // --- 8. DELETE /users/:id (Self Deletion & Admin Deletion) ---
        console.log("\n🔹 Test Group 8: DELETE /users/:id (Self Deletion, Admin Deletion & RBAC)");

        // Create disposable user Gamma for deletion test
        const regPayload3 = {
            name: "Donor Gamma",
            email: `donor.gamma.${runId}@test.com`,
            password: "password123",
            phone: `98${runId.padStart(8, "0")}`.slice(0, 10),
            bloodGroup: "AB-",
            gender: "other"
        };
        const res3 = await apiRequest("POST", "/auth/register", regPayload3);
        const donorGammaId = res3.body?.data?._id;
        if (donorGammaId) disposableUserIds.push(donorGammaId);

        const loginGamma = await apiRequest("POST", "/auth/login", {
            email: regPayload3.email,
            password: regPayload3.password
        });
        const tokenDonorGamma = loginGamma.body?.token;

        // Cross-user delete attempt: Donor Alpha trying to delete Donor Gamma
        const crossDeleteRes = await apiRequest("DELETE", `/users/${donorGammaId}`, null, tokenDonorAlpha);
        assert("Cross-user DELETE /users/:id returns 403 (Forbidden)", crossDeleteRes.status === 403);

        // Delete with malformed ID
        const badIdDeleteRes = await apiRequest("DELETE", "/users/invalid-id-format", null, tokenDonorAlpha);
        assert("DELETE with malformed ID returns 400", badIdDeleteRes.status === 400);

        // Delete non-existent ID
        const missingDeleteRes = await apiRequest("DELETE", `/users/${nonExistentId}`, null, tokenAdmin);
        assert("DELETE non-existent user returns 404", missingDeleteRes.status === 404);

        // Self-deletion: Donor Gamma deletes own account
        const selfDeleteRes = await apiRequest("DELETE", `/users/${donorGammaId}`, null, tokenDonorGamma);
        assert("Self-deletion returns 200", selfDeleteRes.status === 200);
        assert("Self-deletion returns success message", selfDeleteRes.body?.message === "user deleted successfully");

        // Verify deleted user no longer accessible via GET
        const verifyDeletedGet = await apiRequest("GET", `/users/${donorGammaId}`, null, tokenAdmin);
        assert("GET on deleted user returns 404", verifyDeletedGet.status === 404);

        // Verify re-deleting already deleted user returns 404
        const repeatDeleteRes = await apiRequest("DELETE", `/users/${donorGammaId}`, null, tokenAdmin);
        assert("Repeat DELETE on already deleted user returns 404", repeatDeleteRes.status === 404);

        // Admin deletion: Admin deletes Donor Beta
        const adminDeleteRes = await apiRequest("DELETE", `/users/${donorBetaId}`, null, tokenAdmin);
        assert("Admin DELETE of user returns 200", adminDeleteRes.status === 200);
        assert("Admin deletion returns success message", adminDeleteRes.body?.message === "user deleted successfully");

        const verifyBetaDeleted = await apiRequest("GET", `/users/${donorBetaId}`, null, tokenAdmin);
        assert("GET on user deleted by admin returns 404", verifyBetaDeleted.status === 404);

    } finally {
        // Clean up test data
        console.log("\n🧹 Cleaning up test users from MongoDB...");
        if (disposableUserIds.length > 0) {
            await user.deleteMany({ _id: { $in: disposableUserIds } });
            console.log(`Cleaned up ${disposableUserIds.length} test user records.`);
        }

        if (server) {
            server.close();
        }
        await mongoose.connection.close();
    }

    console.log("\n==================================================================");
    console.log(`🏁 User CRUD Test Results: ${passed} Passed, ${failed} Failed`);
    console.log("==================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch((err) => {
    console.error("Test execution failed with error:", err);
    process.exit(1);
});

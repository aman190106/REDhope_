const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const user = require("../models/user");
const { setupTestServer, teardownTestServer, clearTestDatabase, request } = require("./test_helper");

describe("Authentication & Token Verification APIs", () => {
    let testUser;
    let validToken;

    before(async () => {
        await setupTestServer();
    });

    after(async () => {
        await teardownTestServer();
    });

    beforeEach(async () => {
        await clearTestDatabase();

        const hash = await bcrypt.hash("ValidPassword123!", 10);
        testUser = await user.create({
            name: "Auth Test Donor",
            email: "auth_donor@redhope.test",
            password: hash,
            phone: "9876543220",
            bloodGroup: "O+",
            role: "user"
        });

        const loginRes = await request("/auth/login", {
            method: "POST",
            body: {
                email: "auth_donor@redhope.test",
                password: "ValidPassword123!"
            }
        });
        validToken = loginRes.body.token;
    });

    // ─────────────────────────────────────────────
    // 1. Login Verification
    // ─────────────────────────────────────────────
    describe("POST /auth/login", () => {
        it("should authenticate with correct credentials and return JWT token and sanitized user", async () => {
            const res = await request("/auth/login", {
                method: "POST",
                body: {
                    email: "auth_donor@redhope.test",
                    password: "ValidPassword123!"
                }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, "login successful");
            assert.ok(res.body.token, "Token must be returned on login");
            assert.ok(res.body.user, "User object must be returned on login");
            assert.strictEqual(res.body.user.email, "auth_donor@redhope.test");
            assert.strictEqual(res.body.user.password, undefined, "Password must not be returned in login payload");

            // Verify the token structure
            const decoded = jwt.decode(res.body.token);
            assert.strictEqual(decoded.email, "auth_donor@redhope.test");
            assert.strictEqual(decoded.role, "user");
            assert.strictEqual(decoded.password, undefined, "Token payload must not contain password");
        });

        it("should reject login with incorrect password", async () => {
            const res = await request("/auth/login", {
                method: "POST",
                body: {
                    email: "auth_donor@redhope.test",
                    password: "WrongPassword!"
                }
            });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid credentials");
            assert.strictEqual(res.body.token, undefined);
        });

        it("should reject login with unknown email", async () => {
            const res = await request("/auth/login", {
                method: "POST",
                body: {
                    email: "unknown_nonexistent@redhope.test",
                    password: "AnyPassword123!"
                }
            });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid credentials");
            assert.strictEqual(res.body.token, undefined);
        });

        it("should reject login when credentials are missing", async () => {
            const resNoEmail = await request("/auth/login", {
                method: "POST",
                body: { password: "Password123!" }
            });
            assert.strictEqual(resNoEmail.status, 400);
            assert.strictEqual(resNoEmail.body.success, false);
            assert.strictEqual(resNoEmail.body.message, "email and password are required");

            const resNoPass = await request("/auth/login", {
                method: "POST",
                body: { email: "auth_donor@redhope.test" }
            });
            assert.strictEqual(resNoPass.status, 400);
            assert.strictEqual(resNoPass.body.success, false);
            assert.strictEqual(resNoPass.body.message, "email and password are required");
        });
    });

    // ─────────────────────────────────────────────
    // 2. Token Validation & Middleware
    // ─────────────────────────────────────────────
    describe("Token validation & protected endpoints", () => {
        it("should allow access with a valid JWT token (GET /auth/me)", async () => {
            const res = await request("/auth/me", { token: validToken });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user.email, "auth_donor@redhope.test");
            assert.strictEqual(res.body.user.password, undefined);
        });

        it("should reject request when Authorization header is missing", async () => {
            const res = await request("/auth/me");
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "authentication required");
        });

        it("should reject request with malformed or invalid token", async () => {
            const res = await request("/auth/me", { token: "malformed.invalid.token123" });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid token");
        });

        it("should reject request with an expired JWT token", async () => {
            // Sign an immediately expired token using the server's JWT_SECRET
            const expiredToken = jwt.sign(
                { id: testUser._id, email: testUser.email, role: testUser.role },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const res = await request("/auth/me", { token: expiredToken });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "token expired");
        });

        it("should reject token signed with a different secret", async () => {
            const fakeSecretToken = jwt.sign(
                { id: testUser._id, email: testUser.email, role: testUser.role },
                "some_wrong_untrusted_secret_key_1234567890",
                { expiresIn: "1h" }
            );

            const res = await request("/auth/me", { token: fakeSecretToken });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid token");
        });
    });

    // ─────────────────────────────────────────────
    // 3. PUT /auth/me Profile Updates
    // ─────────────────────────────────────────────
    describe("PUT /auth/me profile update", () => {
        it("should allow user to update their own profile fields via /auth/me", async () => {
            const res = await request("/auth/me", {
                method: "PUT",
                token: validToken,
                body: {
                    name: "Updated Donor Name",
                    bloodGroup: "A+",
                    emailNotifications: false,
                    notificationRadiusKm: 40
                }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user.name, "Updated Donor Name");
            assert.strictEqual(res.body.user.bloodGroup, "A+");
            assert.strictEqual(res.body.user.emailNotifications, false);
            assert.strictEqual(res.body.user.notificationRadiusKm, 40);
        });

        it("should forbid user from changing role via /auth/me", async () => {
            const res = await request("/auth/me", {
                method: "PUT",
                token: validToken,
                body: { role: "admin" }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "you cannot change your role");
        });

        it("should forbid user from modifying isEligible via /auth/me", async () => {
            const res = await request("/auth/me", {
                method: "PUT",
                token: validToken,
                body: { isEligible: false }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "you cannot modify eligibility status directly");
        });

        it("should forbid user from modifying lastDonationDate via /auth/me", async () => {
            const res = await request("/auth/me", {
                method: "PUT",
                token: validToken,
                body: { lastDonationDate: new Date().toISOString() }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "you cannot modify last donation date directly");
        });
    });

    describe("Production Health Check & Error Handling", () => {
        it("GET /health should return 200 with database status and no leaked secrets", async () => {
            const res = await request("/health");

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, "healthy");
            assert.strictEqual(res.body.database, "connected");
            assert.ok(typeof res.body.uptime === "number");
            assert.ok(res.body.timestamp);
            assert.strictEqual(res.body.version, "1.0.0");
            // Verify no secret leak
            assert.strictEqual(res.body.password, undefined);
            assert.strictEqual(res.body.MONGODB_URI, undefined);
            assert.strictEqual(res.body.JWT_SECRET, undefined);
        });

        it("GET /unknown-route-xyz should return 404 in clean JSON format", async () => {
            const res = await request("/unknown-route-xyz-404");

            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.success, false);
            assert.ok(res.body.message.includes("Endpoint not found"));
        });
    });
});


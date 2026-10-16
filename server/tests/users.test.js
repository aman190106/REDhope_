const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const user = require("../models/user");
const { setupTestServer, teardownTestServer, clearTestDatabase, request } = require("./test_helper");

describe("User Management APIs", () => {
    let adminToken;
    let userToken;
    let user2Token;
    let organizerToken;

    let adminUser;
    let normalUser;
    let normalUser2;
    let organizerUser;

    before(async () => {
        await setupTestServer();
    });

    after(async () => {
        await teardownTestServer();
    });

    beforeEach(async () => {
        await clearTestDatabase();

        // Seed an Admin
        const hash = await bcrypt.hash("AdminPass123!", 10);
        adminUser = await user.create({
            name: "System Admin",
            email: "admin@redhope.test",
            password: hash,
            phone: "9876543210",
            bloodGroup: "O+",
            role: "admin"
        });

        // Seed a Normal User 1
        const u1Hash = await bcrypt.hash("UserPass123!", 10);
        normalUser = await user.create({
            name: "Donor One",
            email: "donor1@redhope.test",
            password: u1Hash,
            phone: "9876543211",
            bloodGroup: "A+",
            role: "user",
            isEligible: true,
            isDonorAvailable: true
        });

        // Seed a Normal User 2
        const u2Hash = await bcrypt.hash("UserPass123!", 10);
        normalUser2 = await user.create({
            name: "Donor Two",
            email: "donor2@redhope.test",
            password: u2Hash,
            phone: "9876543212",
            bloodGroup: "B+",
            role: "user"
        });

        // Seed an Organizer
        const orgHash = await bcrypt.hash("OrgPass123!", 10);
        organizerUser = await user.create({
            name: "Camp Organizer",
            email: "organizer@redhope.test",
            password: orgHash,
            phone: "9876543213",
            bloodGroup: "O-",
            role: "organizer"
        });

        // Log in seeded users to obtain tokens
        const adminLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "admin@redhope.test", password: "AdminPass123!" }
        });
        adminToken = adminLogin.body.token;

        const userLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "donor1@redhope.test", password: "UserPass123!" }
        });
        userToken = userLogin.body.token;

        const user2Login = await request("/auth/login", {
            method: "POST",
            body: { email: "donor2@redhope.test", password: "UserPass123!" }
        });
        user2Token = user2Login.body.token;

        const orgLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "organizer@redhope.test", password: "OrgPass123!" }
        });
        organizerToken = orgLogin.body.token;
    });

    // ─────────────────────────────────────────────
    // 1. User Registration
    // ─────────────────────────────────────────────
    describe("User registration", () => {
        it("should successfully register a user with valid data and hash password", async () => {
            const res = await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Alice Smith",
                    email: "alice@example.com",
                    password: "SecurePassword123!",
                    phone: "9123456789",
                    bloodGroup: "O+"
                }
            });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.ok(res.body.data._id);
            assert.strictEqual(res.body.data.name, "Alice Smith");
            assert.strictEqual(res.body.data.email, "alice@example.com");
            assert.strictEqual(res.body.data.phone, "9123456789");
            assert.strictEqual(res.body.data.bloodGroup, "O+");
            assert.strictEqual(res.body.data.role, "user");
            assert.strictEqual(res.body.data.password, undefined, "Password must never be returned in API response");

            // Database verification: password must be hashed with bcrypt
            const createdDoc = await user.findOne({ email: "alice@example.com" });
            assert.ok(createdDoc);
            assert.notStrictEqual(createdDoc.password, "SecurePassword123!");
            const match = await bcrypt.compare("SecurePassword123!", createdDoc.password);
            assert.strictEqual(match, true, "Stored password must be a valid bcrypt hash of the plain password");
        });

        it("should reject registration when required fields are missing", async () => {
            const res = await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Incomplete User"
                    // missing email, password, phone, bloodGroup
                }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "all fields are required");
        });

        it("should reject registration with invalid email formats", async () => {
            const invalidEmails = ["plainaddress", "@missingusername.com", "user@", "user@com"];
            for (const email of invalidEmails) {
                const res = await request("/auth/register", {
                    method: "POST",
                    body: {
                        name: "Bad Email",
                        email,
                        password: "Password123!",
                        phone: "9123456789",
                        bloodGroup: "A+"
                    }
                });
                assert.strictEqual(res.status, 400, `Expected 400 for invalid email: ${email}`);
                assert.strictEqual(res.body.success, false);
            }
        });

        it("should reject registration with invalid phone numbers", async () => {
            // Indian phone must start with 6-9 and be 10 digits
            const invalidPhones = ["1234567890", "5555555555", "98765", "98765432100", "abcdefghij"];
            for (const phone of invalidPhones) {
                const res = await request("/auth/register", {
                    method: "POST",
                    body: {
                        name: "Bad Phone",
                        email: "badphone@example.com",
                        password: "Password123!",
                        phone,
                        bloodGroup: "A+"
                    }
                });
                assert.strictEqual(res.status, 400, `Expected 400 for invalid phone: ${phone}`);
                assert.strictEqual(res.body.success, false);
            }
        });

        it("should reject registration with invalid blood group", async () => {
            const res = await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Bad Blood",
                    email: "badblood@example.com",
                    password: "Password123!",
                    phone: "9123456789",
                    bloodGroup: "C+"
                }
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid blood group");
        });

        it("should reject registration with short password (< 6 chars)", async () => {
            const res = await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Short Pass",
                    email: "shortpass@example.com",
                    password: "123",
                    phone: "9123456789",
                    bloodGroup: "B+"
                }
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "password must be at least 6 characters");
        });
    });

    // ─────────────────────────────────────────────
    // 2. Duplicate Email & Phone
    // ─────────────────────────────────────────────
    describe("Duplicate checks", () => {
        it("should reject duplicate email with 400 and clear error message", async () => {
            const res = await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Duplicate Email User",
                    email: "donor1@redhope.test", // already exists
                    password: "NewPassword123!",
                    phone: "9998887776",
                    bloodGroup: "O+"
                }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "mail id already exist");
        });

        it("should reject duplicate phone with 400 and clear error message", async () => {
            const res = await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Duplicate Phone User",
                    email: "unique@example.com",
                    password: "NewPassword123!",
                    phone: "9876543211", // already used by donor1
                    bloodGroup: "O+"
                }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "phone number already exist");
        });
    });

    // ─────────────────────────────────────────────
    // 3. GET /users
    // ─────────────────────────────────────────────
    describe("GET /users", () => {
        it("should reject unauthenticated request with 401", async () => {
            const res = await request("/users");
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
        });

        it("should reject normal user with 403 Forbidden", async () => {
            const res = await request("/users", { token: userToken });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied: administrative access required");
        });

        it("should reject organizer with 403 Forbidden", async () => {
            const res = await request("/users", { token: organizerToken });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied: administrative access required");
        });

        it("should allow admin to retrieve user list with pagination and sanitization", async () => {
            const res = await request("/users?page=1&limit=10", { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.ok(res.body.users && Array.isArray(res.body.users));
            assert.strictEqual(res.body.users.length >= 4, true);

            // Verify password hashes are NEVER exposed
            for (const u of res.body.users) {
                assert.strictEqual(u.password, undefined, "User item in GET /users must not include password");
            }
        });

        it("should filter users by blood group and role", async () => {
            const res = await request("/users?bloodGroup=A+&role=user", { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            for (const u of res.body.users) {
                assert.strictEqual(u.bloodGroup, "A+");
                assert.strictEqual(u.role, "user");
            }
        });
    });

    // ─────────────────────────────────────────────
    // 4. GET /users/:id
    // ─────────────────────────────────────────────
    describe("GET /users/:id", () => {
        it("should reject unauthenticated request with 401", async () => {
            const res = await request(`/users/${normalUser._id}`);
            assert.strictEqual(res.status, 401);
        });

        it("should allow a user to retrieve their own profile", async () => {
            const res = await request(`/users/${normalUser._id}`, { token: userToken });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user._id, normalUser._id.toString());
            assert.strictEqual(res.body.user.email, "donor1@redhope.test");
            assert.strictEqual(res.body.user.password, undefined);
        });

        it("should allow admin to retrieve any user's profile", async () => {
            const res = await request(`/users/${normalUser._id}`, { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user._id, normalUser._id.toString());
            assert.strictEqual(res.body.user.password, undefined);
        });

        it("should forbid normal user from retrieving another user's profile", async () => {
            const res = await request(`/users/${normalUser2._id}`, { token: userToken });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied");
        });

        it("should return 404 for a nonexistent valid MongoDB ID", async () => {
            const fakeId = "507f1f77bcf86cd799439011";
            const res = await request(`/users/${fakeId}`, { token: adminToken });
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "user not found");
        });

        it("should return 400 for a malformed MongoDB ID", async () => {
            const res = await request("/users/invalid-mongoid-123", { token: adminToken });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid user id");
        });
    });

    // ─────────────────────────────────────────────
    // 5. Update User (PUT /users/:id)
    // ─────────────────────────────────────────────
    describe("Update user", () => {
        it("should allow user to update their own permitted fields", async () => {
            const res = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: userToken,
                body: {
                    name: "Donor One Updated",
                    notificationRadiusKm: 50,
                    location: {
                        address: "123 Hope Lane",
                        city: "Surat",
                        state: "Gujarat",
                        pincode: "395007",
                        coordinates: [72.8311, 21.1702]
                    }
                }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user.name, "Donor One Updated");
            assert.strictEqual(res.body.user.notificationRadiusKm, 50);
            assert.strictEqual(res.body.user.location.city, "Surat");
        });

        it("should forbid normal user from updating another user's profile", async () => {
            const res = await request(`/users/${normalUser2._id}`, {
                method: "PUT",
                token: userToken,
                body: { name: "Hacked Name" }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied");
        });

        it("should prevent non-admin from modifying role (role elevation attack)", async () => {
            const res = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: userToken,
                body: { role: "admin" }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "you cannot change your role");

            // Verify role did NOT change in database
            const doc = await user.findById(normalUser._id);
            assert.strictEqual(doc.role, "user");
        });

        it("should prevent non-admin from directly modifying isEligible", async () => {
            const res = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: userToken,
                body: { isEligible: false }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "you cannot modify eligibility status directly");
        });

        it("should allow admin to update protected fields (role, isEligible)", async () => {
            const res = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: adminToken,
                body: { isEligible: false }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user.isEligible, false);

            const doc = await user.findById(normalUser._id);
            assert.strictEqual(doc.isEligible, false);
        });

        it("should reject updating email to an already-used email", async () => {
            const res = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: userToken,
                body: { email: "donor2@redhope.test" }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "mail id already exist");
        });

        it("should reject updating phone to an already-used phone", async () => {
            const res = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: userToken,
                body: { phone: "9876543212" } // phone of donor2
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "phone number already exist");
        });
    });

    // ─────────────────────────────────────────────
    // 6. Delete User (DELETE /users/:id)
    // ─────────────────────────────────────────────
    describe("Delete user", () => {
        it("should reject unauthenticated deletion with 401", async () => {
            const res = await request(`/users/${normalUser2._id}`, { method: "DELETE" });
            assert.strictEqual(res.status, 401);
        });

        it("should forbid normal user from deleting another user's account", async () => {
            const res = await request(`/users/${normalUser2._id}`, {
                method: "DELETE",
                token: userToken
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied");
        });

        it("should allow a user to delete their own account", async () => {
            const res = await request(`/users/${normalUser2._id}`, {
                method: "DELETE",
                token: user2Token
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, "user deleted successfully");

            // Verify record is removed from DB
            const doc = await user.findById(normalUser2._id);
            assert.strictEqual(doc, null);
        });

        it("should allow admin to delete any user", async () => {
            const res = await request(`/users/${normalUser._id}`, {
                method: "DELETE",
                token: adminToken
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, "user deleted successfully");

            const doc = await user.findById(normalUser._id);
            assert.strictEqual(doc, null);
        });

        it("should return 404 when deleting a nonexistent user", async () => {
            const fakeId = "507f1f77bcf86cd799439011";
            const res = await request(`/users/${fakeId}`, {
                method: "DELETE",
                token: adminToken
            });

            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "user not found");
        });

        it("should return 400 when deleting with malformed ID", async () => {
            const res = await request("/users/bad-id-xyz", {
                method: "DELETE",
                token: adminToken
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid user id");
        });
    });
});

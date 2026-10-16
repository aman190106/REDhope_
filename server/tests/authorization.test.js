const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const user = require("../models/user");
const camp = require("../models/camp");
const { setupTestServer, teardownTestServer, clearTestDatabase, request } = require("./test_helper");

describe("Role-Based Authorization & Security Matrix APIs", () => {
    let adminToken;
    let organizerToken;
    let otherOrgToken;
    let userToken;
    let user2Token;

    let admin;
    let organizer;
    let otherOrganizer;
    let normalUser;
    let normalUser2;
    let orgCamp;

    before(async () => {
        await setupTestServer();
    });

    after(async () => {
        await teardownTestServer();
    });

    const getFutureDate = (daysAhead) => {
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        return d.toISOString().split("T")[0];
    };

    beforeEach(async () => {
        await clearTestDatabase();

        const passHash = await bcrypt.hash("AuthPass123!", 10);

        admin = await user.create({
            name: "Chief Admin",
            email: "chief_admin@authz.test",
            password: passHash,
            phone: "9876543260",
            bloodGroup: "O+",
            role: "admin"
        });

        organizer = await user.create({
            name: "Primary Organizer",
            email: "primary_org@authz.test",
            password: passHash,
            phone: "9876543261",
            bloodGroup: "A+",
            role: "organizer"
        });

        otherOrganizer = await user.create({
            name: "Secondary Organizer",
            email: "secondary_org@authz.test",
            password: passHash,
            phone: "9876543262",
            bloodGroup: "B+",
            role: "organizer"
        });

        normalUser = await user.create({
            name: "Donor One",
            email: "donor1@authz.test",
            password: passHash,
            phone: "9876543263",
            bloodGroup: "O+",
            role: "user",
            isEligible: true,
            isDonorAvailable: true
        });

        normalUser2 = await user.create({
            name: "Donor Two",
            email: "donor2@authz.test",
            password: passHash,
            phone: "9876543264",
            bloodGroup: "AB+",
            role: "user",
            isEligible: true,
            isDonorAvailable: true
        });

        orgCamp = await camp.create({
            name: "Primary Organizer Camp",
            organizer: organizer._id,
            location: { address: "101 Center", city: "Surat", state: "Gujarat", pincode: "395001" },
            startDate: getFutureDate(10),
            endDate: getFutureDate(10),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            registrationCount: 0,
            status: "published"
        });

        const adminLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "chief_admin@authz.test", password: "AuthPass123!" }
        });
        adminToken = adminLogin.body.token;

        const orgLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "primary_org@authz.test", password: "AuthPass123!" }
        });
        organizerToken = orgLogin.body.token;

        const otherOrgLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "secondary_org@authz.test", password: "AuthPass123!" }
        });
        otherOrgToken = otherOrgLogin.body.token;

        const u1Login = await request("/auth/login", {
            method: "POST",
            body: { email: "donor1@authz.test", password: "AuthPass123!" }
        });
        userToken = u1Login.body.token;

        const u2Login = await request("/auth/login", {
            method: "POST",
            body: { email: "donor2@authz.test", password: "AuthPass123!" }
        });
        user2Token = u2Login.body.token;
    });

    // ─────────────────────────────────────────────
    // 1. Role-Based Permissions Matrix
    // ─────────────────────────────────────────────
    describe("Administrative Endpoint Restrictions", () => {
        it("should restrict GET /users to admin only (403 for user and organizer)", async () => {
            const resUser = await request("/users", { token: userToken });
            assert.strictEqual(resUser.status, 403);
            assert.strictEqual(resUser.body.message, "access denied: administrative access required");

            const resOrg = await request("/users", { token: organizerToken });
            assert.strictEqual(resOrg.status, 403);
            assert.strictEqual(resOrg.body.message, "access denied: administrative access required");

            const resAdmin = await request("/users", { token: adminToken });
            assert.strictEqual(resAdmin.status, 200);
            assert.strictEqual(resAdmin.body.success, true);
        });

        it("should prevent normal users and organizers from elevating their role to admin", async () => {
            const resUser = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: userToken,
                body: { role: "admin" }
            });
            assert.strictEqual(resUser.status, 403);
            assert.strictEqual(resUser.body.message, "you cannot change your role");

            const resOrg = await request(`/users/${organizer._id}`, {
                method: "PUT",
                token: organizerToken,
                body: { role: "admin" }
            });
            assert.strictEqual(resOrg.status, 403);
            assert.strictEqual(resOrg.body.message, "you cannot change your role");

            // Database confirmation
            const uDoc = await user.findById(normalUser._id);
            assert.strictEqual(uDoc.role, "user");
            const oDoc = await user.findById(organizer._id);
            assert.strictEqual(oDoc.role, "organizer");
        });

        it("should prevent non-admin from modifying eligibility status", async () => {
            const resUser = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: userToken,
                body: { isEligible: false }
            });
            assert.strictEqual(resUser.status, 403);
            assert.strictEqual(resUser.body.message, "you cannot modify eligibility status directly");

            const resAdmin = await request(`/users/${normalUser._id}`, {
                method: "PUT",
                token: adminToken,
                body: { isEligible: false }
            });
            assert.strictEqual(resAdmin.status, 200);
            assert.strictEqual(resAdmin.body.user.isEligible, false);
        });
    });

    // ─────────────────────────────────────────────
    // 2. Organizer Permissions & Resource Ownership
    // ─────────────────────────────────────────────
    describe("Organizer Permissions & Resource Ownership", () => {
        it("should allow organizer/admin to create camps, but forbid normal users", async () => {
            const campPayload = {
                name: "New Blood Camp",
                location: { address: "Town Plaza", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(12),
                endDate: getFutureDate(12),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50
            };

            const resUser = await request("/camps", { method: "POST", token: userToken, body: campPayload });
            assert.strictEqual(resUser.status, 403);

            const resOrg = await request("/camps", { method: "POST", token: organizerToken, body: campPayload });
            assert.strictEqual(resOrg.status, 201);

            const resAdmin = await request("/camps", {
                method: "POST",
                token: adminToken,
                body: { ...campPayload, name: "Admin Created Camp" }
            });
            assert.strictEqual(resAdmin.status, 201);
        });

        it("should forbid an organizer from updating or deleting camps owned by another organizer", async () => {
            // otherOrganizer attempts to edit organizer's camp
            const resUpdate = await request(`/camps/${orgCamp._id}`, {
                method: "PUT",
                token: otherOrgToken,
                body: { name: "Hijacked Camp Name" }
            });
            assert.strictEqual(resUpdate.status, 403);
            assert.strictEqual(resUpdate.body.message, "access denied");

            // otherOrganizer attempts to delete organizer's camp
            const resDelete = await request(`/camps/${orgCamp._id}`, {
                method: "DELETE",
                token: otherOrgToken
            });
            assert.strictEqual(resDelete.status, 403);
            assert.strictEqual(resDelete.body.message, "access denied");
        });

        it("should allow admin to update or delete camps regardless of organizer ownership", async () => {
            const resUpdate = await request(`/camps/${orgCamp._id}`, {
                method: "PUT",
                token: adminToken,
                body: { description: "Updated by Chief Admin" }
            });
            assert.strictEqual(resUpdate.status, 200);
            assert.strictEqual(resUpdate.body.camp.description, "Updated by Chief Admin");
        });
    });

    // ─────────────────────────────────────────────
    // 3. Cross-User Privacy & Ownership Protection
    // ─────────────────────────────────────────────
    describe("Cross-User Privacy & Profile Ownership", () => {
        it("should forbid user A from reading user B's profile", async () => {
            const res = await request(`/users/${normalUser2._id}`, { token: userToken });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.message, "access denied");
        });

        it("should forbid user A from updating user B's profile", async () => {
            const res = await request(`/users/${normalUser2._id}`, {
                method: "PUT",
                token: userToken,
                body: { name: "Compromised Name" }
            });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.message, "access denied");
        });

        it("should forbid user A from deleting user B's account", async () => {
            const res = await request(`/users/${normalUser2._id}`, {
                method: "DELETE",
                token: userToken
            });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.message, "access denied");
        });
    });

    // ─────────────────────────────────────────────
    // 4. Clinical & Sensitive Medical Review Access
    // ─────────────────────────────────────────────
    describe("Sensitive Medical Queue Authorization", () => {
        it("should restrict admin health screening queue to admins only", async () => {
            const resUser = await request("/admin/health-screenings", { token: userToken });
            assert.strictEqual(resUser.status, 403);

            const resOrg = await request("/admin/health-screenings", { token: organizerToken });
            assert.strictEqual(resOrg.status, 403);

            const resAdmin = await request("/admin/health-screenings", { token: adminToken });
            assert.strictEqual(resAdmin.status, 200);
            assert.strictEqual(resAdmin.body.success, true);
        });
    });
});


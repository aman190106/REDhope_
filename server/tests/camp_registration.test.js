const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const user = require("../models/user");
const camp = require("../models/camp");
const campRegistration = require("../models/campRegistration");
const { setupTestServer, teardownTestServer, clearTestDatabase, request } = require("./test_helper");

describe("Camp Registration APIs", () => {
    let organizerToken;
    let otherOrgToken;
    let donor1Token;
    let donor2Token;

    let organizer;
    let otherOrganizer;
    let donor1;
    let donor2;
    let publishedCamp;

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

        const passHash = await bcrypt.hash("Password123!", 10);

        organizer = await user.create({
            name: "Host Organizer",
            email: "host_org@camp.test",
            password: passHash,
            phone: "9876543240",
            bloodGroup: "O+",
            role: "organizer"
        });

        otherOrganizer = await user.create({
            name: "Other Organizer",
            email: "other_org@camp.test",
            password: passHash,
            phone: "9876543241",
            bloodGroup: "A+",
            role: "organizer"
        });

        donor1 = await user.create({
            name: "Eligible Donor 1",
            email: "donor1@camp.test",
            password: passHash,
            phone: "9876543242",
            bloodGroup: "O+",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            dateOfBirth: "1995-05-15"
        });

        donor2 = await user.create({
            name: "Eligible Donor 2",
            email: "donor2@camp.test",
            password: passHash,
            phone: "9876543243",
            bloodGroup: "B+",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            dateOfBirth: "1998-08-20"
        });

        publishedCamp = await camp.create({
            name: "Vadodara Mega Blood Camp",
            organizer: organizer._id,
            location: {
                address: "Jubilee Baug",
                city: "Vadodara",
                state: "Gujarat",
                pincode: "390001"
            },
            startDate: getFutureDate(10),
            endDate: getFutureDate(10),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 2, // small capacity to test full camp
            registrationCount: 0,
            status: "published"
        });

        const orgLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "host_org@camp.test", password: "Password123!" }
        });
        organizerToken = orgLogin.body.token;

        const otherOrgLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "other_org@camp.test", password: "Password123!" }
        });
        otherOrgToken = otherOrgLogin.body.token;

        const d1Login = await request("/auth/login", {
            method: "POST",
            body: { email: "donor1@camp.test", password: "Password123!" }
        });
        donor1Token = d1Login.body.token;

        const d2Login = await request("/auth/login", {
            method: "POST",
            body: { email: "donor2@camp.test", password: "Password123!" }
        });
        donor2Token = d2Login.body.token;
    });

    // ─────────────────────────────────────────────
    // 1. Donor Registration for Camp
    // ─────────────────────────────────────────────
    describe("POST /camps/:campId/register", () => {
        it("should successfully register an eligible donor and atomically increment camp registrationCount", async () => {
            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.data.registration.status, "registered");
            assert.strictEqual(res.body.data.camp.registrationCount, 1);

            // Verify in DB
            const updatedCamp = await camp.findById(publishedCamp._id);
            assert.strictEqual(updatedCamp.registrationCount, 1);

            const regDoc = await campRegistration.findOne({ user: donor1._id, camp: publishedCamp._id });
            assert.ok(regDoc);
            assert.strictEqual(regDoc.status, "registered");
        });

        it("should reject duplicate registration for the same donor with 409 Conflict", async () => {
            // First registration
            await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            // Second registration attempt
            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "user is already registered for this camp");

            // Verify camp count was not incremented twice
            const updatedCamp = await camp.findById(publishedCamp._id);
            assert.strictEqual(updatedCamp.registrationCount, 1);
        });

        it("should reject registration when camp has reached full capacity", async () => {
            // Fill the camp (capacity is 2)
            await request(`/camps/${publishedCamp._id}/register`, { method: "POST", token: donor1Token });
            await request(`/camps/${publishedCamp._id}/register`, { method: "POST", token: donor2Token });

            // Create a third donor attempting to register
            const passHash = await bcrypt.hash("Password123!", 10);
            await user.create({
                name: "Third Donor",
                email: "donor3@camp.test",
                password: passHash,
                phone: "9876543249",
                bloodGroup: "O+",
                role: "user",
                isEligible: true,
                isDonorAvailable: true
            });
            const d3Login = await request("/auth/login", {
                method: "POST",
                body: { email: "donor3@camp.test", password: "Password123!" }
            });

            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: d3Login.body.token
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "camp is at full capacity");
        });

        it("should reject registration for a draft camp", async () => {
            const draftCamp = await camp.create({
                name: "Draft Camp",
                organizer: organizer._id,
                location: { address: "Hall", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50,
                status: "draft"
            });

            const res = await request(`/camps/${draftCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "cannot register for camp with status 'draft'");
        });

        it("should reject registration for a cancelled camp", async () => {
            const cancelledCamp = await camp.create({
                name: "Cancelled Camp",
                organizer: organizer._id,
                location: { address: "Hall", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50,
                status: "cancelled"
            });

            const res = await request(`/camps/${cancelledCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "cannot register for camp with status 'cancelled'");
        });

        it("should reject registration when donor is marked medically ineligible", async () => {
            await user.findByIdAndUpdate(donor1._id, { isEligible: false });

            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "donor is not medically eligible to register");
        });

        it("should reject registration when donor donated within 90 days interval", async () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 30); // 30 days ago (interval is 90 days)
            await user.findByIdAndUpdate(donor1._id, { lastDonationDate: recentDate });

            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "donor is not medically eligible to register");
        });

        it("should reject registration when donor availability is set to false", async () => {
            await user.findByIdAndUpdate(donor1._id, { isDonorAvailable: false });

            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "donor is currently marked as unavailable in profile settings");
        });

        it("should forbid non-user roles (organizer/admin) from registering as donors", async () => {
            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: organizerToken
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "only donors with 'user' role can register for camps");
        });
    });

    // ─────────────────────────────────────────────
    // 2. Cancellation of Camp Registration
    // ─────────────────────────────────────────────
    describe("DELETE /camps/:campId/register", () => {
        beforeEach(async () => {
            // Register donor1
            await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });
        });

        it("should allow a donor to cancel their own registration and decrement camp count", async () => {
            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "DELETE",
                token: donor1Token
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, "registration cancelled successfully");
            assert.strictEqual(res.body.data.registration.status, "cancelled");

            // Verify count decremented
            const updatedCamp = await camp.findById(publishedCamp._id);
            assert.strictEqual(updatedCamp.registrationCount, 0);

            const reg = await campRegistration.findOne({ user: donor1._id, camp: publishedCamp._id });
            assert.strictEqual(reg.status, "cancelled");
        });

        it("should reject cancelling an already cancelled registration", async () => {
            // Cancel once
            await request(`/camps/${publishedCamp._id}/register`, { method: "DELETE", token: donor1Token });

            // Cancel second time
            const res = await request(`/camps/${publishedCamp._id}/register`, {
                method: "DELETE",
                token: donor1Token
            });

            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "no active registration found to cancel");
        });

        it("should allow reactivating registration after cancellation without exceeding count", async () => {
            // Cancel first
            await request(`/camps/${publishedCamp._id}/register`, { method: "DELETE", token: donor1Token });

            // Re-register
            const reRegRes = await request(`/camps/${publishedCamp._id}/register`, {
                method: "POST",
                token: donor1Token
            });

            assert.strictEqual(reRegRes.status, 201);
            assert.strictEqual(reRegRes.body.success, true);
            assert.strictEqual(reRegRes.body.data.camp.registrationCount, 1);

            const updatedCamp = await camp.findById(publishedCamp._id);
            assert.strictEqual(updatedCamp.registrationCount, 1);
        });
    });

    // ─────────────────────────────────────────────
    // 3. Organizer/Admin View of Registrations
    // ─────────────────────────────────────────────
    describe("GET /camps/:campId/registrations", () => {
        beforeEach(async () => {
            await request(`/camps/${publishedCamp._id}/register`, { method: "POST", token: donor1Token });
        });

        it("should allow host organizer to view registered donors with sanitized details", async () => {
            const res = await request(`/camps/${publishedCamp._id}/registrations`, {
                token: organizerToken
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.ok(Array.isArray(res.body.data.registrations));
            assert.strictEqual(res.body.data.registrations.length, 1);

            const donor = res.body.data.registrations[0].user;
            assert.strictEqual(donor.name, "Eligible Donor 1");
            assert.strictEqual(donor.bloodGroup, "O+");
            assert.strictEqual(donor.password, undefined, "Passwords must never be exposed to organizers");
        });

        it("should forbid other organizers from viewing registrations for camps they do not own", async () => {
            const res = await request(`/camps/${publishedCamp._id}/registrations`, {
                token: otherOrgToken
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied");
        });

        it("should forbid normal users from accessing camp registrations list", async () => {
            const res = await request(`/camps/${publishedCamp._id}/registrations`, {
                token: donor1Token
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied");
        });
    });
});

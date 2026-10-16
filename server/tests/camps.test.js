const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const user = require("../models/user");
const camp = require("../models/camp");
const { setupTestServer, teardownTestServer, clearTestDatabase, request } = require("./test_helper");

describe("Blood Donation Camp Management APIs", () => {
    let adminToken;
    let organizer1Token;
    let organizer2Token;
    let donorToken;

    let organizer1;
    let organizer2;
    let normalDonor;

    before(async () => {
        await setupTestServer();
    });

    after(async () => {
        await teardownTestServer();
    });

    beforeEach(async () => {
        await clearTestDatabase();

        const passHash = await bcrypt.hash("Password123!", 10);

        // Seed Admin
        await user.create({
            name: "Admin User",
            email: "admin@camp.test",
            password: passHash,
            phone: "9876543230",
            bloodGroup: "O+",
            role: "admin"
        });

        // Seed Organizer 1
        organizer1 = await user.create({
            name: "Red Cross Organizer",
            email: "org1@camp.test",
            password: passHash,
            phone: "9876543231",
            bloodGroup: "A+",
            role: "organizer"
        });

        // Seed Organizer 2
        organizer2 = await user.create({
            name: "Lions Club Organizer",
            email: "org2@camp.test",
            password: passHash,
            phone: "9876543232",
            bloodGroup: "B+",
            role: "organizer"
        });

        // Seed Donor User
        normalDonor = await user.create({
            name: "Donor Jane",
            email: "donor@camp.test",
            password: passHash,
            phone: "9876543233",
            bloodGroup: "O-",
            role: "user"
        });

        const adminLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "admin@camp.test", password: "Password123!" }
        });
        adminToken = adminLogin.body.token;

        const org1Login = await request("/auth/login", {
            method: "POST",
            body: { email: "org1@camp.test", password: "Password123!" }
        });
        organizer1Token = org1Login.body.token;

        const org2Login = await request("/auth/login", {
            method: "POST",
            body: { email: "org2@camp.test", password: "Password123!" }
        });
        organizer2Token = org2Login.body.token;

        const donorLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "donor@camp.test", password: "Password123!" }
        });
        donorToken = donorLogin.body.token;
    });

    // Helper function for future dates
    const getFutureDate = (daysAhead) => {
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        return d.toISOString().split("T")[0]; // YYYY-MM-DD
    };

    // ─────────────────────────────────────────────
    // 1. POST /camps (Create Camp)
    // ─────────────────────────────────────────────
    describe("Create Camp (POST /camps)", () => {
        it("should allow an organizer to create a valid published camp", async () => {
            const startDate = getFutureDate(10);
            const endDate = getFutureDate(10);

            const res = await request("/camps", {
                method: "POST",
                token: organizer1Token,
                body: {
                    name: "City Blood Drive 2026",
                    description: "Annual community voluntary blood camp",
                    location: {
                        address: "Town Hall, Main Road",
                        city: "Ahmedabad",
                        state: "Gujarat",
                        pincode: "380001",
                        coordinates: [72.5714, 23.0225]
                    },
                    startDate,
                    endDate,
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 100,
                    status: "published"
                }
            });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.camp.name, "City Blood Drive 2026");
            assert.strictEqual(res.body.camp.status, "published");
            assert.strictEqual(res.body.camp.capacity, 100);
            assert.strictEqual(res.body.camp.registrationCount, 0);
            assert.strictEqual(res.body.camp.organizer._id, organizer1._id.toString());
        });

        it("should forbid normal users from creating camps", async () => {
            const res = await request("/camps", {
                method: "POST",
                token: donorToken,
                body: {
                    name: "Unauthorized Camp",
                    startDate: getFutureDate(5),
                    endDate: getFutureDate(5),
                    startTime: "10:00",
                    endTime: "16:00",
                    capacity: 50
                }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "only organizers and admins can create camps");
        });

        it("should reject creation when required fields are missing", async () => {
            const res = await request("/camps", {
                method: "POST",
                token: organizer1Token,
                body: { name: "Incomplete Camp" }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
        });

        it("should reject when endDate is before startDate", async () => {
            const res = await request("/camps", {
                method: "POST",
                token: organizer1Token,
                body: {
                    name: "Invalid Date Camp",
                    location: {
                        address: "Hall 1",
                        city: "Vadodara",
                        state: "Gujarat",
                        pincode: "390001"
                    },
                    startDate: getFutureDate(10),
                    endDate: getFutureDate(5), // earlier than start date
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 50
                }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "endDate cannot be before startDate");
        });

        it("should reject when same-day endTime is before or equal to startTime", async () => {
            const date = getFutureDate(5);
            const res = await request("/camps", {
                method: "POST",
                token: organizer1Token,
                body: {
                    name: "Invalid Time Camp",
                    location: {
                        address: "Hall 2",
                        city: "Vadodara",
                        state: "Gujarat",
                        pincode: "390001"
                    },
                    startDate: date,
                    endDate: date,
                    startTime: "16:00",
                    endTime: "10:00", // before startTime
                    capacity: 50
                }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "endTime must be after startTime for same-day camps");
        });

        it("should reject published camp when startDate is in the past", async () => {
            const res = await request("/camps", {
                method: "POST",
                token: organizer1Token,
                body: {
                    name: "Past Camp",
                    location: {
                        address: "Hall 3",
                        city: "Vadodara",
                        state: "Gujarat",
                        pincode: "390001"
                    },
                    startDate: "2020-01-01",
                    endDate: "2020-01-01",
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 50,
                    status: "published"
                }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "published camps must not have a start date in the past");
        });
    });

    // ─────────────────────────────────────────────
    // 2. GET /camps (Lists & Privacy)
    // ─────────────────────────────────────────────
    describe("Retrieve Camps (GET /camps)", () => {
        let publishedCamp;
        let draftCamp;

        beforeEach(async () => {
            publishedCamp = await camp.create({
                name: "Public Drive",
                organizer: organizer1._id,
                location: { address: "Civic Center", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(7),
                endDate: getFutureDate(7),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50,
                status: "published"
            });

            draftCamp = await camp.create({
                name: "Secret Draft Camp",
                organizer: organizer1._id,
                location: { address: "Private Hall", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(14),
                endDate: getFutureDate(14),
                startTime: "10:00",
                endTime: "16:00",
                capacity: 30,
                status: "draft"
            });
        });

        it("should return only published camps to public unauthenticated requests", async () => {
            const res = await request("/camps");
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            const names = res.body.camps.map(c => c.name);
            assert.ok(names.includes("Public Drive"));
            assert.strictEqual(names.includes("Secret Draft Camp"), false, "Draft camps must never appear in public listings");
        });

        it("should forbid normal user or public from querying ?status=draft", async () => {
            const res = await request("/camps?status=draft", { token: donorToken });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "unauthorized to view draft camps");
        });

        it("should allow organizer to view their own draft camps", async () => {
            const res = await request("/camps?status=draft", { token: organizer1Token });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            const names = res.body.camps.map(c => c.name);
            assert.ok(names.includes("Secret Draft Camp"));
        });
    });

    // ─────────────────────────────────────────────
    // 3. GET /camps/:id
    // ─────────────────────────────────────────────
    describe("Retrieve Camp by ID (GET /camps/:id)", () => {
        let publishedCamp;
        let draftCamp;

        beforeEach(async () => {
            publishedCamp = await camp.create({
                name: "Public Camp Detail",
                organizer: organizer1._id,
                location: { address: "Gate 1", city: "Rajkot", state: "Gujarat", pincode: "360001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 40,
                status: "published"
            });

            draftCamp = await camp.create({
                name: "Draft Camp Detail",
                organizer: organizer1._id,
                location: { address: "Gate 2", city: "Rajkot", state: "Gujarat", pincode: "360001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 40,
                status: "draft"
            });
        });

        it("should return published camp details to anyone", async () => {
            const res = await request(`/camps/${publishedCamp._id}`);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.camp.name, "Public Camp Detail");
        });

        it("should hide draft camp (404) from non-owner and normal users", async () => {
            const resPublic = await request(`/camps/${draftCamp._id}`);
            assert.strictEqual(resPublic.status, 404);

            const resOtherOrg = await request(`/camps/${draftCamp._id}`, { token: organizer2Token });
            assert.strictEqual(resOtherOrg.status, 404);
        });

        it("should allow owner organizer or admin to view draft camp by ID", async () => {
            const resOwner = await request(`/camps/${draftCamp._id}`, { token: organizer1Token });
            assert.strictEqual(resOwner.status, 200);
            assert.strictEqual(resOwner.body.camp.name, "Draft Camp Detail");

            const resAdmin = await request(`/camps/${draftCamp._id}`, { token: adminToken });
            assert.strictEqual(resAdmin.status, 200);
        });

        it("should return 400 for malformed camp ID", async () => {
            const res = await request("/camps/invalid-mongoid");
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid camp ID");
        });

        it("should return 404 for nonexistent camp ID", async () => {
            const res = await request("/camps/507f1f77bcf86cd799439011");
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "camp not found");
        });
    });

    // ─────────────────────────────────────────────
    // 4. PUT /camps/:id (Update Camp)
    // ─────────────────────────────────────────────
    describe("Update Camp (PUT /camps/:id)", () => {
        let activeCamp;

        beforeEach(async () => {
            activeCamp = await camp.create({
                name: "Original Camp Name",
                organizer: organizer1._id,
                location: { address: "Original St", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50,
                registrationCount: 5,
                status: "draft"
            });
        });

        it("should allow owning organizer to update camp details", async () => {
            const res = await request(`/camps/${activeCamp._id}`, {
                method: "PUT",
                token: organizer1Token,
                body: {
                    name: "Updated Camp Name",
                    capacity: 80,
                    status: "published"
                }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.camp.name, "Updated Camp Name");
            assert.strictEqual(res.body.camp.capacity, 80);
            assert.strictEqual(res.body.camp.status, "published");
        });

        it("should forbid non-owner organizer from modifying another organizer's camp", async () => {
            const res = await request(`/camps/${activeCamp._id}`, {
                method: "PUT",
                token: organizer2Token,
                body: { name: "Hijacked Camp" }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied");
        });

        it("should prevent tampering with camp organizer field", async () => {
            const res = await request(`/camps/${activeCamp._id}`, {
                method: "PUT",
                token: organizer1Token,
                body: { organizer: organizer2._id.toString() }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "cannot change camp organizer");
        });

        it("should prevent tampering with registrationCount directly", async () => {
            const res = await request(`/camps/${activeCamp._id}`, {
                method: "PUT",
                token: organizer1Token,
                body: { registrationCount: 99 }
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "cannot directly modify registrationCount");
        });

        it("should reject reducing capacity below current registrationCount", async () => {
            // activeCamp has registrationCount = 5
            const res = await request(`/camps/${activeCamp._id}`, {
                method: "PUT",
                token: organizer1Token,
                body: { capacity: 3 }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "capacity cannot be less than existing registrationCount");
        });

        it("should enforce valid status transitions and reject invalid transitions", async () => {
            // Cancel the camp
            const resCancel = await request(`/camps/${activeCamp._id}`, {
                method: "PUT",
                token: organizer1Token,
                body: { status: "cancelled" }
            });
            assert.strictEqual(resCancel.status, 200);

            // Attempt to edit or un-cancel the cancelled camp
            const resReopen = await request(`/camps/${activeCamp._id}`, {
                method: "PUT",
                token: organizer1Token,
                body: { status: "published" }
            });
            assert.strictEqual(resReopen.status, 400);
            assert.strictEqual(resReopen.body.success, false);
            assert.strictEqual(resReopen.body.message, "cannot edit a cancelled camp");
        });
    });

    // ─────────────────────────────────────────────
    // 5. DELETE /camps/:id (Delete Camp)
    // ─────────────────────────────────────────────
    describe("Delete Camp (DELETE /camps/:id)", () => {
        it("should allow owning organizer to delete camp with 0 registrations", async () => {
            const emptyCamp = await camp.create({
                name: "Empty Camp to Delete",
                organizer: organizer1._id,
                location: { address: "A", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50,
                registrationCount: 0,
                status: "draft"
            });

            const res = await request(`/camps/${emptyCamp._id}`, {
                method: "DELETE",
                token: organizer1Token
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, "camp deleted successfully");

            const check = await camp.findById(emptyCamp._id);
            assert.strictEqual(check, null);
        });

        it("should block hard-delete when camp has registered donors", async () => {
            const campWithDonors = await camp.create({
                name: "Camp with Donors",
                organizer: organizer1._id,
                location: { address: "B", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50,
                registrationCount: 4, // Has registrations!
                status: "published"
            });

            const res = await request(`/camps/${campWithDonors._id}`, {
                method: "DELETE",
                token: organizer1Token
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "cannot delete camp with registered donors; cancel the camp instead");
        });

        it("should forbid other organizer from deleting someone else's camp", async () => {
            const camp1 = await camp.create({
                name: "Org1 Camp",
                organizer: organizer1._id,
                location: { address: "C", city: "Surat", state: "Gujarat", pincode: "395001" },
                startDate: getFutureDate(10),
                endDate: getFutureDate(10),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 50,
                registrationCount: 0,
                status: "draft"
            });

            const res = await request(`/camps/${camp1._id}`, {
                method: "DELETE",
                token: organizer2Token
            });

            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "access denied");
        });
    });
});


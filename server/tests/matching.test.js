const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const user = require("../models/user");
const { setupTestServer, teardownTestServer, clearTestDatabase, request } = require("./test_helper");

describe("Blood Matching Engine APIs", () => {
    let seekerToken;

    before(async () => {
        await setupTestServer();
    });

    after(async () => {
        await teardownTestServer();
    });

    beforeEach(async () => {
        await clearTestDatabase();

        const passHash = await bcrypt.hash("Password123!", 10);

        // Seeker / Requester User
        await user.create({
            name: "Blood Seeker",
            email: "seeker@matching.test",
            password: passHash,
            phone: "9876543250",
            bloodGroup: "O+",
            role: "user"
        });

        // Seed Donors in Various Locations and Blood Groups
        // Ahmedabad coordinates: [72.5714, 23.0225]
        await user.create({
            name: "Ahmedabad O- Donor",
            email: "o_neg_ahm@matching.test",
            password: passHash,
            phone: "9876543251",
            bloodGroup: "O-",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380001",
                type: "Point",
                coordinates: [72.5714, 23.0225]
            }
        });

        await user.create({
            name: "Ahmedabad O+ Donor",
            email: "o_pos_ahm@matching.test",
            password: passHash,
            phone: "9876543252",
            bloodGroup: "O+",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380002",
                type: "Point",
                coordinates: [72.5800, 23.0300]
            }
        });

        await user.create({
            name: "Ahmedabad A+ Donor",
            email: "a_pos_ahm@matching.test",
            password: passHash,
            phone: "9876543253",
            bloodGroup: "A+",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380003",
                type: "Point",
                coordinates: [72.5900, 23.0400]
            }
        });

        // Far away donor: Surat coordinates: [72.8311, 21.1702] (~210 km from Ahmedabad)
        await user.create({
            name: "Surat O- Donor (Far Away)",
            email: "o_neg_surat@matching.test",
            password: passHash,
            phone: "9876543254",
            bloodGroup: "O-",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                city: "Surat",
                state: "Gujarat",
                pincode: "395001",
                type: "Point",
                coordinates: [72.8311, 21.1702]
            }
        });

        // Ineligible Donor (O- but marked ineligible)
        await user.create({
            name: "Ineligible O- Donor",
            email: "o_neg_ineligible@matching.test",
            password: passHash,
            phone: "9876543255",
            bloodGroup: "O-",
            role: "user",
            isEligible: false,
            isDonorAvailable: true,
            location: {
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380001",
                type: "Point",
                coordinates: [72.5714, 23.0225]
            }
        });

        // Unavailable Donor (O- but marked isDonorAvailable = false)
        await user.create({
            name: "Unavailable O- Donor",
            email: "o_neg_unavail@matching.test",
            password: passHash,
            phone: "9876543256",
            bloodGroup: "O-",
            role: "user",
            isEligible: true,
            isDonorAvailable: false,
            location: {
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380001",
                type: "Point",
                coordinates: [72.5714, 23.0225]
            }
        });

        // Donor with recent donation (< 90 days ago)
        const recentDonation = new Date();
        recentDonation.setDate(recentDonation.getDate() - 20);
        await user.create({
            name: "Recent Donor O-",
            email: "o_neg_recent@matching.test",
            password: passHash,
            phone: "9876543257",
            bloodGroup: "O-",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            lastDonationDate: recentDonation,
            location: {
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380001",
                type: "Point",
                coordinates: [72.5714, 23.0225]
            }
        });

        const seekerLogin = await request("/auth/login", {
            method: "POST",
            body: { email: "seeker@matching.test", password: "Password123!" }
        });
        seekerToken = seekerLogin.body.token;
    });

    // ─────────────────────────────────────────────
    // 1. Authentication & Input Validation
    // ─────────────────────────────────────────────
    describe("Authentication & Input Validation", () => {
        it("should reject unauthenticated request with 401", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                body: { bloodGroup: "O+" }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "authentication required");
        });

        it("should reject request with missing bloodGroup with 400", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: {}
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "bloodGroup is required");
        });

        it("should reject request with invalid bloodGroup with 400", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "Z-" }
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "invalid blood group");
        });

        it("should reject partial location (latitude without longitude)", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "O+", latitude: 23.0225 }
            });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, "Both latitude and longitude must be provided for location-based matching");
        });

        it("should reject invalid latitude/longitude ranges", async () => {
            const resLat = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "O+", latitude: 95.0, longitude: 72.0 }
            });
            assert.strictEqual(resLat.status, 400);
            assert.strictEqual(resLat.body.message, "latitude must be a number between -90 and 90");

            const resLng = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "O+", latitude: 23.0, longitude: 185.0 }
            });
            assert.strictEqual(resLng.status, 400);
            assert.strictEqual(resLng.body.message, "longitude must be a number between -180 and 180");
        });
    });

    // ─────────────────────────────────────────────
    // 2. Exact RBC Compatibility Rules
    // ─────────────────────────────────────────────
    describe("RBC Compatibility Rules", () => {
        it("O- recipient should match ONLY O- donors", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "O-" }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.data.bloodGroup, "O-");

            // Donors returned must ONLY have bloodGroup "O-"
            for (const match of res.body.data.matches) {
                assert.strictEqual(match.bloodGroup, "O-", "O- recipient must only be matched with O- donors");
            }
        });

        it("O+ recipient should match O+ and O- donors", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "O+" }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            const bgs = res.body.data.matches.map(m => m.bloodGroup);
            for (const bg of bgs) {
                assert.ok(["O+", "O-"].includes(bg), `Unexpected blood group ${bg} for O+ recipient`);
            }
        });

        it("A+ recipient should match A+, A-, O+, O- donors", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "A+" }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            for (const match of res.body.data.matches) {
                assert.ok(["A+", "A-", "O+", "O-"].includes(match.bloodGroup));
            }
        });
    });

    // ─────────────────────────────────────────────
    // 3. Disqualification & Medical Exclusion
    // ─────────────────────────────────────────────
    describe("Disqualification & Eligibility Filtering", () => {
        it("should exclude ineligible donors, unavailable donors, and recent donors", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "O-" }
            });

            assert.strictEqual(res.status, 200);
            const returnedNames = res.body.data.matches.map(m => m.name);

            // Ineligible donor must NOT be returned
            assert.strictEqual(returnedNames.includes("Ineligible O- Donor"), false, "Ineligible donors must be excluded");

            // Unavailable donor must NOT be returned
            assert.strictEqual(returnedNames.includes("Unavailable O- Donor"), false, "Unavailable donors must be excluded");

            // Recent donor (<90 days interval) must NOT be returned
            assert.strictEqual(returnedNames.includes("Recent Donor O-"), false, "Donors within 90 days interval must be excluded");
        });
    });

    // ─────────────────────────────────────────────
    // 4. Proximity & Geographic Filtering
    // ─────────────────────────────────────────────
    describe("Geographic Proximity Matching", () => {
        it("should filter by search radius and rank by distance", async () => {
            // Search centered at Ahmedabad [lng: 72.5714, lat: 23.0225] with 25 km radius
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: {
                    bloodGroup: "O-",
                    latitude: 23.0225,
                    longitude: 72.5714,
                    radius: 25000 // 25 km in meters
                }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            const names = res.body.data.matches.map(m => m.name);

            // Ahmedabad O- Donor should be included
            assert.ok(names.includes("Ahmedabad O- Donor"));

            // Surat O- Donor is ~210 km away, so must be EXCLUDED from a 25 km radius search
            assert.strictEqual(names.includes("Surat O- Donor (Far Away)"), false, "Donor outside radius must be excluded");

            // Ahmedabad donor should have distanceMeters populated and close to 0
            const ahmDonor = res.body.data.matches.find(m => m.name === "Ahmedabad O- Donor");
            assert.ok(ahmDonor.distanceMeters !== undefined);
            assert.strictEqual(ahmDonor.distanceMeters < 25000, true);
        });

        it("should include far donor when radius is large enough", async () => {
            // Search centered at Ahmedabad with 300 km radius (300,000 meters)
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: {
                    bloodGroup: "O-",
                    latitude: 23.0225,
                    longitude: 72.5714,
                    radius: 300000 // 300 km
                }
            });

            assert.strictEqual(res.status, 200);
            const names = res.body.data.matches.map(m => m.name);
            assert.ok(names.includes("Surat O- Donor (Far Away)"));

            // Ahmedabad donor is closer so must have lower distance than Surat donor
            const ahmDonor = res.body.data.matches.find(m => m.name === "Ahmedabad O- Donor");
            const suratDonor = res.body.data.matches.find(m => m.name === "Surat O- Donor (Far Away)");
            assert.strictEqual(ahmDonor.distanceMeters < suratDonor.distanceMeters, true);
        });
    });

    // ─────────────────────────────────────────────
    // 5. Privacy & Data Protection in Matching Output
    // ─────────────────────────────────────────────
    describe("Privacy & Data Protection", () => {
        it("should NEVER expose donor email, phone, password, or medical history in match results", async () => {
            const res = await request("/matching/donors", {
                method: "POST",
                token: seekerToken,
                body: { bloodGroup: "O+" }
            });

            assert.strictEqual(res.status, 200);
            assert.ok(res.body.data.matches.length > 0);

            for (const match of res.body.data.matches) {
                // Must have safe public identifiers
                assert.ok(match.userId);
                assert.ok(match.name);
                assert.ok(match.bloodGroup);
                assert.ok(match.score);
                assert.ok(Array.isArray(match.matchReason));

                // Must NOT have sensitive fields
                assert.strictEqual(match.password, undefined, "Password must never be in matching results");
                assert.strictEqual(match.email, undefined, "Email must never be in matching results");
                assert.strictEqual(match.phone, undefined, "Phone number must never be in matching results");
                assert.strictEqual(match.dateOfBirth, undefined, "DOB must not be exposed");
                assert.strictEqual(match.healthScreening, undefined, "Medical screening details must not be exposed");
            }
        });
    });
});


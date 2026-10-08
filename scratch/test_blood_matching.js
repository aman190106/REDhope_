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

const bloodMatchingRoutes = require("c:/REDhope/REDhope/server/routes/bloodMatchingRoutes");
const {
    getCompatibleDonorBloodGroups,
    isBloodCompatible,
    VALID_BLOOD_GROUPS
} = require("c:/REDhope/REDhope/server/rules/bloodCompatibilityRules");

const app = express();
app.use(express.json());
app.use("/matching", bloodMatchingRoutes);

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
    console.log("=== Starting Blood Matching Engine Test Suite ===");

    await connectDB();
    console.log("Connected to MongoDB");

    // Ensure 2dsphere index on user model is built
    await user.createIndexes();

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

    async function createTestDonor(overrides = {}) {
        const unique = `${testTimestamp}_${Math.floor(Math.random() * 1000000)}`;
        const userData = {
            name: `Donor ${unique}`,
            email: `donor_${unique}@example.com`,
            password: "hashedPassword123!",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1995-05-15"),
            isDonorAvailable: true,
            isEligible: true,
            location: {
                address: "123 Donor Way",
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380001"
            },
            ...overrides
        };
        const u = await user.create(userData);
        createdUserIds.push(u._id);
        return u;
    }

    try {
        // Authenticated requesting user
        const requester = await createTestDonor({ name: "Requester", bloodGroup: "A+" });
        const token = generateToken(requester);

        // ─────────────────────────────────────────────
        // 1. Pure Blood Compatibility Unit Logic Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 1: Blood Compatibility Rules ---");

        // 1. O- recipient receives O- only
        const oNegCompatible = getCompatibleDonorBloodGroups("O-");
        assert(oNegCompatible.length === 1 && oNegCompatible.includes("O-"), "1. O- recipient receives O- only");

        // 2. O+ recipient receives O+, O-
        const oPosCompatible = getCompatibleDonorBloodGroups("O+");
        assert(
            oPosCompatible.length === 2 &&
            oPosCompatible.includes("O+") &&
            oPosCompatible.includes("O-"),
            "2. O+ recipient receives O+, O-"
        );

        // 3. A- recipient receives A-, O-
        const aNegCompatible = getCompatibleDonorBloodGroups("A-");
        assert(
            aNegCompatible.length === 2 &&
            aNegCompatible.includes("A-") &&
            aNegCompatible.includes("O-"),
            "3. A- recipient receives A-, O-"
        );

        // 4. A+ recipient receives A+, A-, O+, O-
        const aPosCompatible = getCompatibleDonorBloodGroups("A+");
        assert(
            aPosCompatible.length === 4 &&
            ["A+", "A-", "O+", "O-"].every((bg) => aPosCompatible.includes(bg)),
            "4. A+ recipient receives A+, A-, O+, O-"
        );

        // 5. B- recipient receives B-, O-
        const bNegCompatible = getCompatibleDonorBloodGroups("B-");
        assert(
            bNegCompatible.length === 2 &&
            bNegCompatible.includes("B-") &&
            bNegCompatible.includes("O-"),
            "5. B- recipient receives B-, O-"
        );

        // 6. B+ recipient receives B+, B-, O+, O-
        const bPosCompatible = getCompatibleDonorBloodGroups("B+");
        assert(
            bPosCompatible.length === 4 &&
            ["B+", "B-", "O+", "O-"].every((bg) => bPosCompatible.includes(bg)),
            "6. B+ recipient receives B+, B-, O+, O-"
        );

        // 7. AB- recipient receives AB-, A-, B-, O-
        const abNegCompatible = getCompatibleDonorBloodGroups("AB-");
        assert(
            abNegCompatible.length === 4 &&
            ["AB-", "A-", "B-", "O-"].every((bg) => abNegCompatible.includes(bg)),
            "7. AB- recipient receives AB-, A-, B-, O-"
        );

        // 8. AB+ recipient receives all 8 groups (universal recipient)
        const abPosCompatible = getCompatibleDonorBloodGroups("AB+");
        assert(
            abPosCompatible.length === 8 &&
            VALID_BLOOD_GROUPS.every((bg) => abPosCompatible.includes(bg)),
            "8. AB+ recipient receives all 8 blood groups"
        );

        // 9. Incompatible donor excluded
        assert(isBloodCompatible("B+", "A+") === false, "9a. B+ is incompatible with A+ recipient");
        assert(isBloodCompatible("A+", "O+") === false, "9b. A+ is incompatible with O+ recipient");
        assert(isBloodCompatible("AB+", "A-") === false, "9c. AB+ is incompatible with A- recipient");

        // 10. All supported blood groups handled
        assert(VALID_BLOOD_GROUPS.length === 8, "10. Exactly 8 blood groups supported in REDhope enum");

        // ─────────────────────────────────────────────
        // 2. Eligibility & Availability Integration Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 2: Medical Eligibility & Availability Integration ---");

        // Set up test donors for O- matching:
        // Donor 1: O-, fully eligible, available
        const eligibleDonor = await createTestDonor({
            name: "Eligible O-",
            bloodGroup: "O-",
            isEligible: true,
            isDonorAvailable: true,
            dateOfBirth: new Date("1992-01-01"),
            lastDonationDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
        });

        // Donor 2: O-, but isEligible: false (admin blocked)
        const blockedDonor = await createTestDonor({
            name: "Blocked O-",
            bloodGroup: "O-",
            isEligible: false,
            isDonorAvailable: true
        });

        // Donor 3: O-, but isDonorAvailable: false (marked unavailable)
        const unavailableDonor = await createTestDonor({
            name: "Unavailable O-",
            bloodGroup: "O-",
            isEligible: true,
            isDonorAvailable: false
        });

        // Donor 4: O-, but underage (16 years old) inserted directly to verify engine filtering
        const underageDoc = {
            name: "Underage O-",
            email: `underage_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`,
            password: "hashedPassword123!",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O-",
            role: "user",
            isEligible: true,
            isDonorAvailable: true,
            dateOfBirth: new Date(Date.now() - 16 * 365.25 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const insertRes = await user.collection.insertOne(underageDoc);
        const underageDonorId = insertRes.insertedId;
        createdUserIds.push(underageDonorId);

        // Donor 5: O-, but donated 10 days ago (< 90 days interval)
        const recentDonor = await createTestDonor({
            name: "Recent Donor O-",
            bloodGroup: "O-",
            isEligible: true,
            isDonorAvailable: true,
            dateOfBirth: new Date("1990-01-01"),
            lastDonationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        });

        // Donor 6: B+, incompatible with O-
        const incompDonor = await createTestDonor({
            name: "Incompatible B+",
            bloodGroup: "B-",
            isEligible: true,
            isDonorAvailable: true
        });

        // Query matching for O- recipient without location
        const matchRes1 = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "O-"
        });

        assert(matchRes1.status === 200, "POST /matching/donors returns 200");
        assert(matchRes1.data.success === true, "Response has success: true");

        const matches1 = matchRes1.data.data.matches;
        const matchedIds = matches1.map((m) => m.userId);

        // 11. Medically ineligible donor excluded
        assert(!matchedIds.includes(blockedDonor._id.toString()), "11a. Admin-blocked donor (isEligible=false) excluded");
        assert(!matchedIds.includes(underageDonorId.toString()), "11b. Underage donor (<18) excluded");
        assert(!matchedIds.includes(recentDonor._id.toString()), "11c. Donor with recent donation (<90 days) excluded");

        // 12. Unavailable donor excluded
        assert(!matchedIds.includes(unavailableDonor._id.toString()), "12. Unavailable donor excluded");

        // 13. Eligible + available donor included
        assert(matchedIds.includes(eligibleDonor._id.toString()), "13. Eligible + available compatible donor included");

        // 13b. Incompatible blood group excluded
        assert(!matchedIds.includes(incompDonor._id.toString()), "13b. Incompatible blood group excluded from candidates");

        // ─────────────────────────────────────────────
        // 3. Location & Geospatial Proximity Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 3: Location & Geospatial Proximity ---");

        // Coordinates reference point: Ahmedabad Center -> [72.5714, 23.0225]
        const centerLng = 72.5714;
        const centerLat = 23.0225;

        // Geo Donor 1: Navrangpura, Ahmedabad (~2.3 km away) -> [72.5550, 23.0370], A+
        const nearDonor = await createTestDonor({
            name: "Near Donor (2.3km)",
            bloodGroup: "A+",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                type: "Point",
                coordinates: [72.5550, 23.0370],
                city: "Ahmedabad",
                state: "Gujarat"
            }
        });

        // Geo Donor 2: Gandhinagar (~23 km away) -> [72.6369, 23.2156], A+
        const midDonor = await createTestDonor({
            name: "Mid Donor (23km)",
            bloodGroup: "A+",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                type: "Point",
                coordinates: [72.6369, 23.2156],
                city: "Gandhinagar",
                state: "Gujarat"
            }
        });

        // Geo Donor 3: Vadodara (~100 km away) -> [73.1812, 22.3072], A+
        const farDonor = await createTestDonor({
            name: "Far Donor (100km)",
            bloodGroup: "A+",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                type: "Point",
                coordinates: [73.1812, 22.3072],
                city: "Vadodara",
                state: "Gujarat"
            }
        });

        // Geo Donor 4: Ahmedabad, but NO coordinates (coordinates undefined)
        const noCoordsDonor = await createTestDonor({
            name: "No Coords Donor",
            bloodGroup: "A+",
            isEligible: true,
            isDonorAvailable: true,
            location: {
                city: "Ahmedabad",
                state: "Gujarat"
            }
        });

        // 14. Nearby donor included within 30 km radius
        const geoRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "A+",
            latitude: centerLat,
            longitude: centerLng,
            radius: 30000 // 30 km
        });

        assert(geoRes.status === 200, "Geospatial match query returns 200");
        const geoMatches = geoRes.data.data.matches;
        const geoMatchIds = geoMatches.map((m) => m.userId);

        assert(geoMatchIds.includes(nearDonor._id.toString()), "14. Nearby donor (~2.3km) included within 30km radius");
        assert(geoMatchIds.includes(midDonor._id.toString()), "14b. Mid donor (~23km) included within 30km radius");

        // 15. Donor outside radius excluded (Far donor at 100km excluded from 30km)
        assert(!geoMatchIds.includes(farDonor._id.toString()), "15. Far donor (~100km) excluded from 30km radius search");

        // 16. Nearest donor ranked first
        const nearIdx = geoMatches.findIndex((m) => m.userId === nearDonor._id.toString());
        const midIdx = geoMatches.findIndex((m) => m.userId === midDonor._id.toString());
        assert(nearIdx !== -1 && midIdx !== -1 && nearIdx < midIdx, "16. Nearest donor (~2.3km) ranked before mid donor (~23km)");

        // 17. distanceMeters returned
        const foundNear = geoMatches.find((m) => m.userId === nearDonor._id.toString());
        assert(
            foundNear && typeof foundNear.distanceMeters === "number" && foundNear.distanceMeters > 0,
            `17. distanceMeters returned correctly (${foundNear?.distanceMeters}m)`
        );

        // 18. Donor without coordinates handled safely (omitted from geospatial search without crash)
        assert(!geoMatchIds.includes(noCoordsDonor._id.toString()), "18. Donor without coordinates safely omitted from radius search");

        // 19. Invalid latitude rejected
        const badLatRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "A+",
            latitude: 95,
            longitude: 72.5714
        });
        assert(badLatRes.status === 400, "19. Latitude > 90 rejected with 400");

        // 20. Invalid longitude rejected
        const badLngRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "A+",
            latitude: 23.0225,
            longitude: 195
        });
        assert(badLngRes.status === 400, "20. Longitude > 180 rejected with 400");

        // 21. Invalid radius rejected
        const badRadRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "A+",
            latitude: 23.0225,
            longitude: 72.5714,
            radius: -500
        });
        assert(badRadRes.status === 400, "21. Negative radius rejected with 400");

        // 22. Excessive radius rejected (> 500,000 meters)
        const excessiveRadRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "A+",
            latitude: 23.0225,
            longitude: 72.5714,
            radius: 600000
        });
        assert(excessiveRadRes.status === 400, "22. Radius > 500km rejected with 400");

        // 22b. Missing one coordinate when other is provided
        const halfCoordRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "A+",
            latitude: 23.0225
        });
        assert(halfCoordRes.status === 400, "22b. Providing latitude without longitude rejected with 400");

        // ─────────────────────────────────────────────
        // 4. Authorization & Access Control
        // ─────────────────────────────────────────────
        console.log("\n--- Group 4: Authorization ---");

        // 23. Unauthenticated request returns 401
        const unauthRes = await makeRequest("POST", "/matching/donors", {}, {
            bloodGroup: "A+"
        });
        assert(unauthRes.status === 401, "23. Unauthenticated request returns 401");
        assert(unauthRes.data.success === false, "401 response has success: false");

        // 24. Authorized user can access matching
        const authRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "O+"
        });
        assert(authRes.status === 200, "24. Authenticated donor/requester can access matching");

        // 25. Invalid blood group rejected with 400
        const badBgRes = await makeRequest("POST", "/matching/donors", {
            Authorization: `Bearer ${token}`
        }, {
            bloodGroup: "INVALID"
        });
        assert(badBgRes.status === 400, "25. Invalid blood group returns 400");

        // ─────────────────────────────────────────────
        // 5. Donor Privacy & Leakage Protection
        // ─────────────────────────────────────────────
        console.log("\n--- Group 5: Privacy & Leakage Protection ---");

        const fullResponseJson = JSON.stringify(geoRes.data);

        // 26. Password absent
        assert(!fullResponseJson.includes("password"), "26. 'password' field strictly absent from response");

        // 27. JWT / token absent
        assert(!fullResponseJson.includes("jwt") && !fullResponseJson.includes("token"), "27. JWT and auth tokens absent from response");

        // 28. Precise donor coordinates absent
        assert(!fullResponseJson.includes("72.5550") && !fullResponseJson.includes("23.0370"), "28. Precise donor coordinates absent from returned candidate objects");

        // 29. Unnecessary private fields absent (email, phone, dateOfBirth, role)
        const forbiddenValues = [
            nearDonor.email,
            nearDonor.phone,
            "dateOfBirth",
            "123 Donor Way"
        ];
        let privacyLeaked = false;
        for (const val of forbiddenValues) {
            if (fullResponseJson.includes(val)) {
                privacyLeaked = true;
                console.error(`  [FAIL] Leaked private value in matching response: ${val}`);
                break;
            }
        }
        assert(!privacyLeaked, "29. Private donor details (email, phone, DOB, address) strictly absent");

        // ─────────────────────────────────────────────
        // 6. Ranking, Scores & Match Reasons
        // ─────────────────────────────────────────────
        console.log("\n--- Group 6: Ranking, Score & Match Reasons ---");

        // 30. Deterministic ordering
        const firstMatch = geoMatches[0];
        const secondMatch = geoMatches[1];
        assert(firstMatch.score >= secondMatch.score, "30. Candidates ordered deterministically by matching score descending");

        // 31. Score returned
        assert(typeof firstMatch.score === "number" && firstMatch.score > 0, `31. Numerical score returned (${firstMatch.score})`);

        // 32. Match reasons returned
        assert(Array.isArray(firstMatch.matchReason) && firstMatch.matchReason.length > 0, "32. Match reasons returned as array of strings");
        assert(
            firstMatch.matchReason.some((r) => r.includes("Exact blood group match") || r.includes("Compatible blood group")),
            "32b. Match reasons explain blood compatibility"
        );
        assert(
            firstMatch.matchReason.some((r) => r.includes("Medically eligible")),
            "32c. Match reasons explain medical eligibility"
        );

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        console.log("\n--- Cleaning up test artifacts ---");
        try {
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

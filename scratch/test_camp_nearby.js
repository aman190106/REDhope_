const http = require("http");
const path = require("path");
const mongoose = require("c:/REDhope/REDhope/server/node_modules/mongoose");

require("c:/REDhope/REDhope/server/node_modules/dotenv").config({ path: "c:/REDhope/REDhope/server/.env", quiet: true });
const express = require("c:/REDhope/REDhope/server/node_modules/express");
const connectDB = require("c:/REDhope/REDhope/server/config/db");
const user = require("c:/REDhope/REDhope/server/models/user");
const camp = require("c:/REDhope/REDhope/server/models/camp");
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
            res.on("data", (chunk) => { data += chunk; });
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

async function runTests() {
    console.log("=== Starting Location-Based Camp Discovery Test Suite ===");
    await connectDB();

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
    const createdCampIds = [];

    // Helper to create test organizer
    const organizer = await user.create({
        name: `Geo Organizer ${testTimestamp}`,
        email: `geo_org_${testTimestamp}@example.com`,
        password: "hashedPassword123!",
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        bloodGroup: "O+",
        role: "organizer",
        dateOfBirth: new Date("1990-01-01"),
        isDonorAvailable: true,
        isEligible: true
    });
    createdUserIds.push(organizer._id);

    // Coordinate reference:
    // Reference point: Ahmedabad Center -> [72.5714, 23.0225]
    // Camp A: Navrangpura, Ahmedabad (~3 km away) -> [72.5550, 23.0370]
    // Camp B: Gandhinagar (~23 km away) -> [72.6369, 23.2156]
    // Camp C: Vadodara (~100 km away) -> [73.1812, 22.3072]
    // Camp D: Surat (~205 km away) -> [72.8311, 21.1702]
    // Camp E: Ahmedabad Center DRAFT (status: 'draft') -> [72.5714, 23.0225]
    // Camp F: Ahmedabad Center NO COORDS -> coordinates undefined

    async function createCampWithCoords(name, coords, status = "published") {
        const futureStart = new Date();
        futureStart.setDate(futureStart.getDate() + 5);
        const futureEnd = new Date(futureStart);
        futureEnd.setDate(futureEnd.getDate() + 1);

        const loc = {
            address: "Test Geo St",
            city: "TestCity",
            state: "Gujarat",
            pincode: "380001"
        };
        if (coords) {
            loc.type = "Point";
            loc.coordinates = coords;
        }

        const doc = await camp.create({
            name,
            description: `Discovery test camp for ${name}`,
            organizer: organizer._id,
            location: loc,
            startDate: futureStart,
            endDate: futureEnd,
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            registrationCount: 0,
            status
        });
        createdCampIds.push(doc._id);
        return doc;
    }

    const campA = await createCampWithCoords("Camp A Navrangpura", [72.5550, 23.0370], "published");
    const campB = await createCampWithCoords("Camp B Gandhinagar", [72.6369, 23.2156], "published");
    const campC = await createCampWithCoords("Camp C Vadodara", [73.1812, 22.3072], "published");
    const campD = await createCampWithCoords("Camp D Surat", [72.8311, 21.1702], "published");
    const campE_draft = await createCampWithCoords("Camp E Draft", [72.5714, 23.0225], "draft");
    const campF_noCoords = await createCampWithCoords("Camp F No Coords", null, "published");

    try {
        // Test 1: Valid nearby search returns published camps
        console.log("\n--- Test 1: Valid nearby search ---");
        const res1 = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=23.0225&radius=30000");
        if (res1.status === 200 && res1.data.success && Array.isArray(res1.data.camps)) {
            console.log(`1. Valid nearby search: PASS (HTTP 200, count: ${res1.data.count})`);
        } else {
            console.error("1. FAIL:", res1);
            process.exit(1);
        }

        // Test 2: Nearest-first ordering
        console.log("\n--- Test 2: Nearest-first ordering ---");
        // Within 30 km, both Camp A (~3 km) and Camp B (~23 km) should be found, with Camp A first
        const campsFound2 = res1.data.camps.filter(c => [campA._id.toString(), campB._id.toString()].includes(c._id));
        if (
            campsFound2.length === 2 &&
            campsFound2[0]._id === campA._id.toString() &&
            campsFound2[1]._id === campB._id.toString() &&
            campsFound2[0].distanceMeters < campsFound2[1].distanceMeters
        ) {
            console.log(`2. Nearest-first ordering: PASS (${Math.round(campsFound2[0].distanceMeters)}m < ${Math.round(campsFound2[1].distanceMeters)}m)`);
        } else {
            console.error("2. FAIL:", campsFound2);
            process.exit(1);
        }

        // Test 3: Radius filtering (tight radius: 5,000 meters)
        console.log("\n--- Test 3: Radius filtering (5 km) ---");
        const res3 = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=23.0225&radius=5000");
        const ids3 = res3.data.camps.map(c => c._id);
        if (ids3.includes(campA._id.toString()) && !ids3.includes(campB._id.toString())) {
            console.log("3. Radius filtering: PASS (Camp A included, Camp B excluded at 5km)");
        } else {
            console.error("3. FAIL:", ids3);
            process.exit(1);
        }

        // Test 4: Camp outside radius excluded
        console.log("\n--- Test 4: Camp outside radius excluded ---");
        // Camp C Vadodara is ~100 km away, Camp D Surat is ~205 km away
        // With 30 km radius, neither should be present
        const ids1 = res1.data.camps.map(c => c._id);
        if (!ids1.includes(campC._id.toString()) && !ids1.includes(campD._id.toString())) {
            console.log("4. Camps outside radius excluded: PASS (Vadodara & Surat excluded from 30km search)");
        } else {
            console.error("4. FAIL: Out of range camps returned:", ids1);
            process.exit(1);
        }

        // Test 5: Unpublished/draft camp excluded
        console.log("\n--- Test 5: Unpublished camp excluded ---");
        if (!ids1.includes(campE_draft._id.toString())) {
            console.log("5. Unpublished draft camp excluded from nearby results: PASS");
        } else {
            console.error("5. FAIL: Draft camp returned in nearby results");
            process.exit(1);
        }

        // Test 6: Camp without coordinates excluded safely without query failure
        console.log("\n--- Test 6: Camp without coordinates excluded safely ---");
        if (!ids1.includes(campF_noCoords._id.toString())) {
            console.log("6. Camp without coordinates safely omitted from geospatial results: PASS");
        } else {
            console.error("6. FAIL: Camp without coordinates appeared in geospatial results");
            process.exit(1);
        }

        // Test 7: Invalid longitude (out of [-180, 180] or non-numeric)
        console.log("\n--- Test 7: Invalid longitude rejected ---");
        const res7a = await makeRequest("GET", "/camps/nearby?longitude=195&latitude=23.0225");
        const res7b = await makeRequest("GET", "/camps/nearby?longitude=abc&latitude=23.0225");
        if (res7a.status === 400 && res7b.status === 400) {
            console.log("7. Invalid longitude returns 400: PASS");
        } else {
            console.error("7. FAIL:", res7a.status, res7b.status);
            process.exit(1);
        }

        // Test 8: Invalid latitude (out of [-90, 90] or non-numeric)
        console.log("\n--- Test 8: Invalid latitude rejected ---");
        const res8a = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=95");
        const res8b = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=xyz");
        if (res8a.status === 400 && res8b.status === 400) {
            console.log("8. Invalid latitude returns 400: PASS");
        } else {
            console.error("8. FAIL:", res8a.status, res8b.status);
            process.exit(1);
        }

        // Test 9: Invalid radius (negative, zero, or non-numeric)
        console.log("\n--- Test 9: Invalid radius rejected ---");
        const res9a = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=23.0225&radius=-500");
        const res9b = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=23.0225&radius=0");
        const res9c = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=23.0225&radius=invalid");
        if (res9a.status === 400 && res9b.status === 400 && res9c.status === 400) {
            console.log("9. Invalid radius returns 400: PASS");
        } else {
            console.error("9. FAIL:", res9a.status, res9b.status, res9c.status);
            process.exit(1);
        }

        // Test 10: Excessive radius rejected (> 500,000 meters)
        console.log("\n--- Test 10: Excessive radius rejected ---");
        const res10 = await makeRequest("GET", "/camps/nearby?longitude=72.5714&latitude=23.0225&radius=600000");
        if (res10.status === 400 && res10.data.message.includes("maximum")) {
            console.log("10. Excessive radius (>500km) returns 400: PASS");
        } else {
            console.error("10. FAIL:", res10);
            process.exit(1);
        }

        // Test 11: No matching camps in empty location returns clean 200 with count 0
        console.log("\n--- Test 11: No matching camps in empty region ---");
        // Coordinates in the middle of the Indian Ocean
        const res11 = await makeRequest("GET", "/camps/nearby?longitude=75.0&latitude=-10.0&radius=10000");
        if (res11.status === 200 && res11.data.count === 0 && res11.data.camps.length === 0) {
            console.log("11. Empty region returns clean 200 with 0 count: PASS");
        } else {
            console.error("11. FAIL:", res11);
            process.exit(1);
        }

        // Test 12: Distance field returned correctly as distanceMeters (number >= 0)
        console.log("\n--- Test 12: Distance field returned correctly ---");
        const targetCampA = res1.data.camps.find(c => c._id === campA._id.toString());
        if (
            targetCampA &&
            typeof targetCampA.distanceMeters === "number" &&
            targetCampA.distanceMeters > 0 &&
            targetCampA.distanceMeters < 5000 // roughly 2-3km
        ) {
            console.log(`12. distanceMeters field present and accurate (${Math.round(targetCampA.distanceMeters)}m): PASS`);
        } else {
            console.error("12. FAIL:", targetCampA);
            process.exit(1);
        }

        // Test 13: Missing coordinates return 400
        console.log("\n--- Test 13: Missing coordinates parameter rejected ---");
        const res13a = await makeRequest("GET", "/camps/nearby");
        const res13b = await makeRequest("GET", "/camps/nearby?longitude=72.5714");
        const res13c = await makeRequest("GET", "/camps/nearby?latitude=23.0225");
        if (res13a.status === 400 && res13b.status === 400 && res13c.status === 400) {
            console.log("13. Missing coordinates return 400: PASS");
        } else {
            console.error("13. FAIL:", res13a.status, res13b.status, res13c.status);
            process.exit(1);
        }

        // Test 14: Safe organizer projection verified (no private email or phone exposed)
        console.log("\n--- Test 14: Safe organizer projection in nearby results ---");
        const orgKeys = Object.keys(targetCampA.organizer);
        if (targetCampA.organizer.name && !("email" in targetCampA.organizer) && !("phone" in targetCampA.organizer) && !("password" in targetCampA.organizer)) {
            console.log("14. Organizer private fields omitted from nearby results: PASS");
        } else {
            console.error("14. FAIL: Leaked organizer fields:", targetCampA.organizer);
            process.exit(1);
        }

        console.log("\n=== ALL 14 LOCATION-BASED CAMP DISCOVERY TESTS PASSED ===");

    } finally {
        // Cleanup test data
        await camp.deleteMany({ _id: { $in: createdCampIds } });
        await user.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`Cleaned up ${createdCampIds.length} test camps and ${createdUserIds.length} test users.`);
        server.close();
        await mongoose.disconnect();
    }
}

runTests().catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
});


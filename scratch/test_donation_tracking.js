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
const camp = require("c:/REDhope/REDhope/server/models/camp");
const campRegistration = require("c:/REDhope/REDhope/server/models/campRegistration");
const donation = require("c:/REDhope/REDhope/server/models/donation");
const notification = require("c:/REDhope/REDhope/server/models/notification");

const donationRoutes = require("c:/REDhope/REDhope/server/routes/donationRoutes");
const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");
const eligibilityRoutes = require("c:/REDhope/REDhope/server/routes/eligibilityRoutes");

const app = express();
app.use(express.json());
app.use("/donations", donationRoutes);
app.use("/camps", campRoutes);
app.use("/eligibility", eligibilityRoutes);

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
    console.log("=== Starting Donation Tracking System Test Suite ===");

    await connectDB();
    console.log("Connected to MongoDB");

    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            console.log(`Test server running at ${baseUrl}`);
            resolve();
        });
    });

    const timestamp = Date.now();
    const createdUserIds = [];
    const createdCampIds = [];
    const createdRegIds = [];
    const createdDonationIds = [];

    try {
        const hashedPassword = await bcrypt.hash("TestPass123!", 10);

        // 1. Create Test Users: Organizer A, Organizer B, Donor 1, Donor 2, Admin
        const organizerA = await user.create({
            name: "Organizer Alpha",
            email: `orga_${timestamp}@test.com`,
            password: hashedPassword,
            phone: `911${String(timestamp).slice(-7)}`,
            bloodGroup: "O+",
            role: "organizer"
        });
        createdUserIds.push(organizerA._id);

        const organizerB = await user.create({
            name: "Organizer Beta",
            email: `orgb_${timestamp}@test.com`,
            password: hashedPassword,
            phone: `912${String(timestamp).slice(-7)}`,
            bloodGroup: "A+",
            role: "organizer"
        });
        createdUserIds.push(organizerB._id);

        const donor1 = await user.create({
            name: "Donor One",
            email: `donor1_${timestamp}@test.com`,
            password: hashedPassword,
            phone: `913${String(timestamp).slice(-7)}`,
            bloodGroup: "B+",
            role: "user",
            dateOfBirth: new Date("1995-05-15"),
            isEligible: true,
            isDonorAvailable: true,
            lastDonationDate: null
        });
        createdUserIds.push(donor1._id);

        const donor2 = await user.create({
            name: "Donor Two",
            email: `donor2_${timestamp}@test.com`,
            password: hashedPassword,
            phone: `914${String(timestamp).slice(-7)}`,
            bloodGroup: "AB+",
            role: "user",
            dateOfBirth: new Date("1998-08-20"),
            isEligible: true,
            isDonorAvailable: true,
            lastDonationDate: null
        });
        createdUserIds.push(donor2._id);

        const adminUser = await user.create({
            name: "Admin User",
            email: `admin_${timestamp}@test.com`,
            password: hashedPassword,
            phone: `915${String(timestamp).slice(-7)}`,
            bloodGroup: "O-",
            role: "admin"
        });
        createdUserIds.push(adminUser._id);

        const tokenOrgA = generateToken(organizerA);
        const tokenOrgB = generateToken(organizerB);
        const tokenDonor1 = generateToken(donor1);
        const tokenDonor2 = generateToken(donor2);
        const tokenAdmin = generateToken(adminUser);

        // 2. Create Test Camps
        const campA = await camp.create({
            name: `Camp Alpha ${timestamp}`,
            description: "Camp owned by Organizer A",
            organizer: organizerA._id,
            location: {
                address: "Camp Ground A",
                city: "Pune",
                state: "Maharashtra",
                pincode: "411001"
            },
            startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            status: "published"
        });
        createdCampIds.push(campA._id);

        const campB = await camp.create({
            name: `Camp Beta ${timestamp}`,
            description: "Camp owned by Organizer B",
            organizer: organizerB._id,
            location: {
                address: "Camp Ground B",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001"
            },
            startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            startTime: "10:00",
            endTime: "18:00",
            capacity: 30,
            status: "published"
        });
        createdCampIds.push(campB._id);

        // 3. Create Registrations
        // reg1: donor1 for campA (active)
        const reg1 = await campRegistration.create({
            user: donor1._id,
            camp: campA._id,
            status: "registered"
        });
        createdRegIds.push(reg1._id);

        // reg2: donor2 for campA (active)
        const reg2 = await campRegistration.create({
            user: donor2._id,
            camp: campA._id,
            status: "registered"
        });
        createdRegIds.push(reg2._id);

        // reg3: donor1 for campB (cancelled)
        const reg3 = await campRegistration.create({
            user: donor1._id,
            camp: campB._id,
            status: "cancelled",
            cancelledAt: new Date()
        });
        createdRegIds.push(reg3._id);

        // reg4: donor2 for campB (active)
        const reg4 = await campRegistration.create({
            user: donor2._id,
            camp: campB._id,
            status: "registered"
        });
        createdRegIds.push(reg4._id);

        console.log("\n--- Section 1: Model & Schema Validation ---");
        // Test 1: Direct mongoose model creation with invalid status
        try {
            await donation.create({
                donor: donor1._id,
                camp: campA._id,
                registration: new mongoose.Types.ObjectId(),
                units: 1,
                bloodGroup: "B+",
                status: "invalid_status",
                recordedBy: organizerA._id
            });
            assert(false, "Model should reject invalid status enum");
        } catch (err) {
            assert(err.name === "ValidationError", "Model validates status enum correctly");
        }

        // Test 2: Reject invalid blood group snapshot
        try {
            await donation.create({
                donor: donor1._id,
                camp: campA._id,
                registration: new mongoose.Types.ObjectId(),
                units: 1,
                bloodGroup: "INVALID",
                status: "scheduled",
                recordedBy: organizerA._id
            });
            assert(false, "Model should reject invalid bloodGroup snapshot");
        } catch (err) {
            assert(err.name === "ValidationError", "Model validates bloodGroup correctly");
        }

        // Test 3: Reject non-integer or zero units
        try {
            await donation.create({
                donor: donor1._id,
                camp: campA._id,
                registration: new mongoose.Types.ObjectId(),
                units: 0,
                bloodGroup: "B+",
                status: "scheduled",
                recordedBy: organizerA._id
            });
            assert(false, "Model should reject units < 1");
        } catch (err) {
            assert(err.name === "ValidationError", "Model rejects units < 1 correctly");
        }

        console.log("\n--- Section 2: Authorization & Access Control ---");
        // Test 4: Unauthenticated POST /donations -> 401
        const unauthRes = await makeRequest("POST", "/donations", {}, {
            registrationId: reg1._id.toString()
        });
        assert(unauthRes.status === 401, "Unauthenticated POST /donations returns 401");

        // Test 5: Normal user POST /donations -> 403
        const userCreateRes = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenDonor1}`
        }, {
            registrationId: reg1._id.toString()
        });
        assert(userCreateRes.status === 403, "Normal user cannot record donation (returns 403)");

        // Test 6: Organizer non-owner POST /donations -> 403 (Org B cannot record for Camp A)
        const orgBNonOwnerRes = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenOrgB}`
        }, {
            registrationId: reg1._id.toString()
        });
        assert(orgBNonOwnerRes.status === 403, "Non-owner organizer cannot record donation for Camp A (returns 403)");

        // Test 7: Registration is cancelled -> 400
        const cancelledRegRes = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenOrgB}`
        }, {
            registrationId: reg3._id.toString()
        });
        assert(cancelledRegRes.status === 400, "Cannot record donation for cancelled registration (returns 400)");

        console.log("\n--- Section 3: Donation Creation & Secure Derivation ---");
        // Test 8: Organizer owner records donation for Camp A -> 201
        const createDonationRes = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            registrationId: reg1._id.toString(),
            units: 1,
            status: "scheduled",
            notes: "Donor arrived, vitals normal."
        });
        assert(createDonationRes.status === 201 && createDonationRes.data.success, "Organizer owner can record donation (201 Created)");

        const createdDonation = createDonationRes.data.data.donation;
        createdDonationIds.push(createdDonation._id);

        assert(createdDonation.donor.toString() === donor1._id.toString(), "Donor derived securely from registration");
        assert(createdDonation.camp.toString() === campA._id.toString(), "Camp derived securely from registration");
        assert(createdDonation.bloodGroup === "B+", "Blood group snapshot derived from donor profile ('B+')");
        assert(createdDonation.status === "scheduled", "Default status is 'scheduled'");
        assert(createdDonation.units === 1, "Units recorded as 1");

        // Test 9: Duplicate donation record for same registration blocked -> 409
        const duplicateRes = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            registrationId: reg1._id.toString(),
            units: 1
        });
        assert(duplicateRes.status === 409, "Duplicate donation for same registration rejected with 409");

        console.log("\n--- Section 4: Status Lifecycle & Transitions ---");
        // Test 10: Normal user cannot PATCH status -> 403
        const userPatchRes = await makeRequest("PATCH", `/donations/${createdDonation._id}/status`, {
            Authorization: `Bearer ${tokenDonor1}`
        }, {
            status: "completed"
        });
        assert(userPatchRes.status === 403, "Normal user cannot modify donation status (403)");

        // Test 11: Non-owner organizer cannot PATCH status -> 403
        const orgBPatchRes = await makeRequest("PATCH", `/donations/${createdDonation._id}/status`, {
            Authorization: `Bearer ${tokenOrgB}`
        }, {
            status: "completed"
        });
        assert(orgBPatchRes.status === 403, "Non-owner organizer cannot modify donation status (403)");

        // Test 12: Invalid status string -> 400
        const invalidStatusRes = await makeRequest("PATCH", `/donations/${createdDonation._id}/status`, {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            status: "random_status"
        });
        assert(invalidStatusRes.status === 400, "Invalid status string rejected with 400");

        // Test 13: Transition scheduled -> completed
        const completeRes = await makeRequest("PATCH", `/donations/${createdDonation._id}/status`, {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            status: "completed",
            notes: "Donation completed successfully, 450ml."
        });
        assert(completeRes.status === 200 && completeRes.data.success, "Transition scheduled -> completed successful (200)");
        const completedDoc = completeRes.data.data.donation;
        assert(completedDoc.status === "completed", "Donation status is now 'completed'");
        assert(completedDoc.verifiedAt !== null, "verifiedAt timestamp was set on completion");

        // Test 14: Completed donation updates donor.lastDonationDate
        const updatedDonor1 = await user.findById(donor1._id);
        assert(updatedDonor1.lastDonationDate !== null, "Donor lastDonationDate updated in database");
        const donationDateTime = new Date(completedDoc.donationDate).getTime();
        const donorLastDateTime = new Date(updatedDonor1.lastDonationDate).getTime();
        assert(donorLastDateTime === donationDateTime, "Donor lastDonationDate matches completed donation date");

        // Test 15: In-app notification created for completed donation
        const notif = await notification.findOne({
            user: donor1._id,
            eventKey: `donation-completed:${createdDonation._id}`
        });
        assert(notif !== null, "In-app completion notification created for donor");
        assert(notif.type === "system", "Notification type is 'system'");
        assert(notif.title === "Donation Recorded", "Notification title is 'Donation Recorded'");

        // Test 16: Idempotent re-completion: repeated PATCH status: "completed" -> 200 without duplicate side effects
        const repeatCompleteRes = await makeRequest("PATCH", `/donations/${createdDonation._id}/status`, {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            status: "completed"
        });
        assert(repeatCompleteRes.status === 200, "Repeated completion request is idempotent (200)");
        const notifCount = await notification.countDocuments({
            user: donor1._id,
            eventKey: `donation-completed:${createdDonation._id}`
        });
        assert(notifCount === 1, "No duplicate notifications created on repeated completion");

        // Test 17: Terminal state protection: completed donation cannot transition to cancelled or scheduled
        const revertRes = await makeRequest("PATCH", `/donations/${createdDonation._id}/status`, {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            status: "scheduled"
        });
        assert(revertRes.status === 400, "Completed donation cannot be reverted to scheduled (400)");

        const cancelCompletedRes = await makeRequest("PATCH", `/donations/${createdDonation._id}/status`, {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            status: "cancelled"
        });
        assert(cancelCompletedRes.status === 400, "Completed donation cannot be transitioned to cancelled (400)");

        console.log("\n--- Section 5: Cancelled & No-Show Lifecycles ---");
        // Test 18: Record second donation for Donor 2 (scheduled)
        const createDonation2Res = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            registrationId: reg2._id.toString(),
            units: 1,
            status: "scheduled"
        });
        assert(createDonation2Res.status === 201, "Recorded donation for Donor 2 (201)");
        const donation2 = createDonation2Res.data.data.donation;
        createdDonationIds.push(donation2._id);

        // Test 19: Transition scheduled -> no_show
        const noShowRes = await makeRequest("PATCH", `/donations/${donation2._id}/status`, {
            Authorization: `Bearer ${tokenOrgA}`
        }, {
            status: "no_show"
        });
        assert(noShowRes.status === 200, "Transition scheduled -> no_show succeeds (200)");
        assert(noShowRes.data.data.donation.status === "no_show", "Status is 'no_show'");
        assert(noShowRes.data.data.donation.verifiedAt === null, "No-show donation does not set verifiedAt");

        // Test 20: No-show does NOT update lastDonationDate
        const donor2Doc = await user.findById(donor2._id);
        assert(donor2Doc.lastDonationDate === null, "No-show donation does NOT update donor.lastDonationDate");

        // Test 21: Record donation for Donor 2 at Camp B (by Org B) and transition to cancelled
        const createDonation3Res = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenOrgB}`
        }, {
            registrationId: reg4._id.toString(),
            units: 1,
            status: "scheduled"
        });
        assert(createDonation3Res.status === 201, "Recorded donation for Camp B (201)");
        const donation3 = createDonation3Res.data.data.donation;
        createdDonationIds.push(donation3._id);

        const cancelRes = await makeRequest("PATCH", `/donations/${donation3._id}/status`, {
            Authorization: `Bearer ${tokenOrgB}`
        }, {
            status: "cancelled"
        });
        assert(cancelRes.status === 200, "Transition scheduled -> cancelled succeeds (200)");
        const donor2DocAfterCancel = await user.findById(donor2._id);
        assert(donor2DocAfterCancel.lastDonationDate === null, "Cancelled donation does NOT update donor.lastDonationDate");

        console.log("\n--- Section 6: Historical Date Ordering & Latest Date Rule ---");
        // Test 22: If an older donation is completed after a newer one already exists,
        // it must NOT overwrite lastDonationDate with the older date.
        // Donor 1 already has lastDonationDate = donationDateTime (~2 days ago).
        // Let's create an older historical donation for Donor 1 (e.g. 60 days ago) using direct service or admin.
        // Let's create an older camp and registration for Donor 1.
        const oldCamp = await camp.create({
            name: `Old Historical Camp ${timestamp}`,
            organizer: adminUser._id,
            location: { address: "Old Grounds", city: "Delhi", state: "Delhi", pincode: "110001" },
            startDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - 69 * 24 * 60 * 60 * 1000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 20,
            status: "completed"
        });
        createdCampIds.push(oldCamp._id);

        const oldReg = await campRegistration.create({
            user: donor1._id,
            camp: oldCamp._id,
            status: "registered"
        });
        createdRegIds.push(oldReg._id);

        const olderDonationDate = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000);
        const recordOlderRes = await makeRequest("POST", "/donations", {
            Authorization: `Bearer ${tokenAdmin}`
        }, {
            registrationId: oldReg._id.toString(),
            donationDate: olderDonationDate.toISOString(),
            units: 1,
            status: "completed"
        });
        assert(recordOlderRes.status === 201, "Admin recorded older historical completed donation (201)");
        createdDonationIds.push(recordOlderRes.data.data.donation._id);

        // Verify that Donor 1's lastDonationDate is STILL the newer date (~2 days ago) and was NOT overwritten!
        const donor1AfterOlder = await user.findById(donor1._id);
        const expectedNewerTime = new Date(completedDoc.donationDate).getTime();
        assert(
            new Date(donor1AfterOlder.lastDonationDate).getTime() === expectedNewerTime,
            "Older historical donation did NOT overwrite newer lastDonationDate"
        );

        console.log("\n--- Section 7: Eligibility Engine Integration ---");
        // Test 23: GET /eligibility/me for Donor 1 naturally reflects the recent donationDate
        // Since donation was ~2 days ago (< 90 days), donor should NOT be eligible.
        const eligRes = await makeRequest("GET", "/eligibility/me", {
            Authorization: `Bearer ${tokenDonor1}`
        });
        assert(eligRes.status === 200 && eligRes.data.success, "GET /eligibility/me succeeds (200)");
        const eligData = eligRes.data.data;
        assert(eligData.isMedicallyEligible === false, "Donor 1 is not medically eligible (90-day interval not elapsed)");
        assert(eligData.nextEligibleDate !== null, "nextEligibleDate is calculated based on lastDonationDate + 90 days");
        assert(eligData.reasons.some(r => r.includes("donation interval")), "Reasons include minimum donation interval message");

        console.log("\n--- Section 8: Donor History API (GET /donations/me) ---");
        // Test 24: Unauthenticated GET /donations/me -> 401
        const unauthHistRes = await makeRequest("GET", "/donations/me");
        assert(unauthHistRes.status === 401, "Unauthenticated GET /donations/me returns 401");

        // Test 25: Donor 1 retrieves their own donation history
        const donor1HistRes = await makeRequest("GET", "/donations/me", {
            Authorization: `Bearer ${tokenDonor1}`
        });
        assert(donor1HistRes.status === 200 && donor1HistRes.data.success, "Donor 1 retrieves history (200)");
        const donor1Donations = donor1HistRes.data.data.donations;
        assert(donor1Donations.length === 2, "Donor 1 sees exactly their 2 donation records");
        assert(
            new Date(donor1Donations[0].donationDate) >= new Date(donor1Donations[1].donationDate),
            "Donations sorted in descending order of donationDate"
        );
        assert(donor1Donations[0].camp.name !== undefined, "Camp details populated safely");
        assert(donor1Donations[0].bloodGroup === "B+", "Blood group snapshot present");

        // Test 26: Pagination on /donations/me
        const pagedHistRes = await makeRequest("GET", "/donations/me?page=1&limit=1", {
            Authorization: `Bearer ${tokenDonor1}`
        });
        assert(pagedHistRes.status === 200, "Pagination on /donations/me succeeds (200)");
        assert(pagedHistRes.data.data.donations.length === 1, "Page limit 1 returns 1 record");
        assert(pagedHistRes.data.data.pagination.totalPages === 2, "Pagination reports 2 total pages");

        // Test 27: Donor 2 sees only their own history
        const donor2HistRes = await makeRequest("GET", "/donations/me", {
            Authorization: `Bearer ${tokenDonor2}`
        });
        assert(donor2HistRes.status === 200, "Donor 2 retrieves history (200)");
        const donor2Donations = donor2HistRes.data.data.donations;
        assert(donor2Donations.length === 2, "Donor 2 sees their own records only");
        assert(!donor2Donations.some(d => d.donor && d.donor.toString() === donor1._id.toString()), "No data leakage across donors");

        console.log("\n--- Section 9: Organizer Camp Donations (GET /camps/:campId/donations) ---");
        // Test 28: Unauthenticated GET /camps/:campId/donations -> 401
        const unauthCampDonRes = await makeRequest("GET", `/camps/${campA._id}/donations`);
        assert(unauthCampDonRes.status === 401, "Unauthenticated GET /camps/:campId/donations returns 401");

        // Test 29: Normal donor GET /camps/:campId/donations -> 403
        const donorCampDonRes = await makeRequest("GET", `/camps/${campA._id}/donations`, {
            Authorization: `Bearer ${tokenDonor1}`
        });
        assert(donorCampDonRes.status === 403, "Normal user forbidden from camp donations endpoint (403)");

        // Test 30: Organizer non-owner -> 403 (Org B querying Camp A)
        const orgBNonOwnerCampRes = await makeRequest("GET", `/camps/${campA._id}/donations`, {
            Authorization: `Bearer ${tokenOrgB}`
        });
        assert(orgBNonOwnerCampRes.status === 403, "Non-owner organizer forbidden from Camp A donations (403)");

        // Test 31: Organizer owner -> 200 (Org A querying Camp A)
        const orgAOwnerCampRes = await makeRequest("GET", `/camps/${campA._id}/donations`, {
            Authorization: `Bearer ${tokenOrgA}`
        });
        assert(orgAOwnerCampRes.status === 200 && orgAOwnerCampRes.data.success, "Camp owner retrieves donations (200)");
        const campADonations = orgAOwnerCampRes.data.data.donations;
        assert(campADonations.length === 2, "Camp A returns 2 donation records (donor 1 completed, donor 2 no_show)");
        assert(orgAOwnerCampRes.data.data.stats.completed === 1, "Stats reflect 1 completed donation");
        assert(orgAOwnerCampRes.data.data.stats.noShow === 1, "Stats reflect 1 no-show donation");

        // Test 32: Status filtering on camp donations: status=completed
        const completedOnlyRes = await makeRequest("GET", `/camps/${campA._id}/donations?status=completed`, {
            Authorization: `Bearer ${tokenOrgA}`
        });
        assert(completedOnlyRes.status === 200, "Filtering status=completed succeeds (200)");
        assert(completedOnlyRes.data.data.donations.length === 1, "Only 1 completed donation returned");
        assert(completedOnlyRes.data.data.donations[0].status === "completed", "Filtered record is 'completed'");

        // Test 33: Admin can access any camp donations -> 200
        const adminCampDonRes = await makeRequest("GET", `/camps/${campA._id}/donations`, {
            Authorization: `Bearer ${tokenAdmin}`
        });
        assert(adminCampDonRes.status === 200, "Admin can view any camp's donations (200)");

        console.log("\n--- Section 10: Security, Privacy & IDOR ---");
        // Test 34: Password hash is never exposed in donation queries
        const sampleRecord = orgAOwnerCampRes.data.data.donations[0];
        assert(sampleRecord.donor.password === undefined, "Donor password hash is never exposed in camp donations");
        assert(donor1Donations[0].password === undefined, "Donor password hash is never exposed in donation history");

        // Test 35: Donor single lookup GET /donations/:id
        // Donor 1 viewing own donation -> 200
        const donor1ViewOwn = await makeRequest("GET", `/donations/${createdDonation._id}`, {
            Authorization: `Bearer ${tokenDonor1}`
        });
        assert(donor1ViewOwn.status === 200, "Donor can view own donation by ID (200)");

        // Test 36: Donor 2 viewing Donor 1's donation -> 403 (IDOR protection)
        const donor2ViewDonor1 = await makeRequest("GET", `/donations/${createdDonation._id}`, {
            Authorization: `Bearer ${tokenDonor2}`
        });
        assert(donor2ViewDonor1.status === 403, "Donor 2 blocked from viewing Donor 1's donation by ID (403 IDOR)");

        console.log("\n--- Section 11: Analytics Integration ---");
        // Test 37: GET /camps/analytics for Organizer A includes donation metrics
        const analyticsRes = await makeRequest("GET", "/camps/analytics", {
            Authorization: `Bearer ${tokenOrgA}`
        });
        assert(analyticsRes.status === 200 && analyticsRes.data.success, "GET /camps/analytics returns 200");
        const analyticsData = analyticsRes.data.data;
        assert(analyticsData.donations !== undefined, "Analytics data includes 'donations' section");
        assert(analyticsData.donations.totalDonations === 2, "Analytics reports 2 total donations for Organizer A");
        assert(analyticsData.donations.completedDonations === 1, "Analytics reports 1 completed donation");
        assert(analyticsData.donations.noShowDonations === 1, "Analytics reports 1 no-show donation");
        assert(analyticsData.donations.totalUnitsDonated === 1, "Analytics reports 1 total unit donated");
        assert(Array.isArray(analyticsData.donations.bloodGroupDistribution), "Donation blood group distribution array returned");

    } finally {
        console.log("\n--- Cleaning up test artifacts ---");
        if (createdDonationIds.length > 0) {
            await donation.deleteMany({ _id: { $in: createdDonationIds } });
        }
        if (createdRegIds.length > 0) {
            await campRegistration.deleteMany({ _id: { $in: createdRegIds } });
        }
        if (createdCampIds.length > 0) {
            await camp.deleteMany({ _id: { $in: createdCampIds } });
        }
        if (createdUserIds.length > 0) {
            await user.deleteMany({ _id: { $in: createdUserIds } });
            await notification.deleteMany({ user: { $in: createdUserIds } });
        }
        console.log("Cleanup complete");

        if (server) {
            server.close();
        }
        await mongoose.connection.close();
    }

    console.log(`\n=== RESULTS: ${passed} Passed, ${failed} Failed ===`);
    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch((err) => {
    console.error("Test execution unhandled error:", err);
    process.exit(1);
});


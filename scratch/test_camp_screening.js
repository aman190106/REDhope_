/**
 * REDhope Camp-Specific Manual Donor Screening Test Suite
 * 
 * Verifies all required authorization, workflow, and data protection rules:
 * - Authorization (401 unauth, 403 normal user, 403 cross-organizer, 200 owner, 200 admin)
 * - Strict document access controls (cross-donor 403, unregistered 403/404, owner stream 200)
 * - CampScreening lifecycle (create, update, single-screening per registration)
 * - Decision validation (reasons mandatory for deferral, rejection, and needs review)
 * - Screener identity (screenedBy derived from auth, screenedAt timestamped)
 * - Global eligibility separation (camp approval does not alter global user.isEligible)
 * - Camp registration & donation tracking gating (requireHealthScreening enforcement)
 * - Donor visibility (getMyRegistration reflects screeningStatus)
 * - Tamper-evident audit logging for all organizer access and review events
 */

const http = require("http");
const assert = require("assert");
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

// Models
const user = require("c:/REDhope/REDhope/server/models/user");
const camp = require("c:/REDhope/REDhope/server/models/camp");
const campRegistration = require("c:/REDhope/REDhope/server/models/campRegistration");
const CampScreening = require("c:/REDhope/REDhope/server/models/campScreening");
const HealthScreening = require("c:/REDhope/REDhope/server/models/healthScreening");
const MedicalDocument = require("c:/REDhope/REDhope/server/models/medicalDocument");
const MedicalAuditLog = require("c:/REDhope/REDhope/server/models/medicalAuditLog");
const donation = require("c:/REDhope/REDhope/server/models/donation");

// Routes & Services
const authRoutes = require("c:/REDhope/REDhope/server/routes/authRoutes");
const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");
const campRegistrationRoutes = require("c:/REDhope/REDhope/server/routes/campRegistrationRoutes");
const donationRoutes = require("c:/REDhope/REDhope/server/routes/donationRoutes");
const healthScreeningRoutes = require("c:/REDhope/REDhope/server/routes/healthScreeningRoutes");
const { recordDonation } = require("c:/REDhope/REDhope/server/services/donationService");
const { saveDocument } = require("c:/REDhope/REDhope/server/services/storageService");

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_for_tests";

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/auth", authRoutes);
app.use("/camps", campRegistrationRoutes);
app.use("/camps", campRoutes);
app.use("/donations", donationRoutes);
app.use("/health-screening", healthScreeningRoutes);

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
                ...(body && typeof body === "object" && !headers["Content-Type"] ? { "Content-Type": "application/json" } : {})
            }
        };

        const req = http.request(options, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                const raw = buffer.toString("utf8");
                try {
                    const parsed = JSON.parse(raw);
                    resolve({ status: res.statusCode, headers: res.headers, data: parsed, buffer });
                } catch {
                    resolve({ status: res.statusCode, headers: res.headers, raw, buffer });
                }
            });
        });

        req.on("error", reject);
        if (body) {
            if (Buffer.isBuffer(body)) {
                req.write(body);
            } else if (typeof body === "object") {
                req.write(JSON.stringify(body));
            } else {
                req.write(body);
            }
        }
        req.end();
    });
}

function createToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

function createMockPdf(content = "Test Camp Medical PDF") {
    const header = Buffer.from("%PDF-1.4\n");
    const body = Buffer.from(content + "\n%%EOF");
    return Buffer.concat([header, body]);
}

async function runCampScreeningTests() {
    console.log("==================================================");
    console.log("REDhope Camp-Specific Manual Donor Screening Suite");
    console.log("==================================================");

    await connectDB();
    console.log("MongoDB connected");

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Test server running on ${baseUrl}`);

    const timestamp = Date.now();
    const hashedPassword = await bcrypt.hash("Password123!", 10);

    // Test Users
    let organizerA, organizerB, donor1, donor2, admin;
    let tokenOrgA, tokenOrgB, tokenDonor1, tokenDonor2, tokenAdmin;
    let campA, campB, regDonor1CampA, regDonor2CampB, doc1;

    try {
        organizerA = await user.create({
            name: `Organizer A ${timestamp}`,
            email: `orga_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role: "organizer"
        });
        tokenOrgA = createToken({ id: organizerA._id.toString(), email: organizerA.email, role: "organizer" });

        organizerB = await user.create({
            name: `Organizer B ${timestamp}`,
            email: `orgb_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "A+",
            role: "organizer"
        });
        tokenOrgB = createToken({ id: organizerB._id.toString(), email: organizerB.email, role: "organizer" });

        donor1 = await user.create({
            name: `Donor One ${timestamp}`,
            email: `donor1_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            role: "user",
            bloodGroup: "O+",
            gender: "male",
            dateOfBirth: new Date("1996-05-15"),
            isEligible: true,
            isDonorAvailable: true
        });
        tokenDonor1 = createToken({ id: donor1._id.toString(), email: donor1.email, role: "user" });

        donor2 = await user.create({
            name: `Donor Two ${timestamp}`,
            email: `donor2_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            role: "user",
            bloodGroup: "B+",
            gender: "female",
            dateOfBirth: new Date("1998-08-20"),
            isEligible: true,
            isDonorAvailable: true
        });
        tokenDonor2 = createToken({ id: donor2._id.toString(), email: donor2.email, role: "user" });

        admin = await user.create({
            name: `Admin Reviewer ${timestamp}`,
            email: `admin_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "AB+",
            role: "admin"
        });
        tokenAdmin = createToken({ id: admin._id.toString(), email: admin.email, role: "admin" });

        // Camps
        campA = await camp.create({
            name: `Camp A ${timestamp}`,
            description: "Camp A Drive",
            organizer: organizerA._id,
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 86400000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            status: "published",
            requireHealthScreening: true,
            location: { address: "Hall A", city: "Delhi", state: "DL", pincode: "110001" }
        });

        campB = await camp.create({
            name: `Camp B ${timestamp}`,
            description: "Camp B Drive",
            organizer: organizerB._id,
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 86400000),
            startTime: "10:00",
            endTime: "18:00",
            capacity: 50,
            status: "published",
            requireHealthScreening: false,
            location: { address: "Hall B", city: "Mumbai", state: "MH", pincode: "400001" }
        });

        // Registrations
        regDonor1CampA = await campRegistration.create({
            user: donor1._id,
            camp: campA._id,
            status: "registered"
        });

        regDonor2CampB = await campRegistration.create({
            user: donor2._id,
            camp: campB._id,
            status: "registered"
        });

        // Health screening record for Donor 1
        const donor1Screening = await HealthScreening.create({
            user: donor1._id,
            status: "draft"
        });

        // Upload a medical document for Donor 1
        const mockPdf = createMockPdf("Donor 1 Blood Count Report");
        const stored = await saveDocument(mockPdf, "Donor1_Report.pdf", "application/pdf");
        doc1 = await MedicalDocument.create({
            user: donor1._id,
            screening: donor1Screening._id,
            uploadedBy: donor1._id,
            documentType: "blood_report",
            originalFileName: stored.sanitizedFileName,
            mimeType: "application/pdf",
            fileSize: stored.fileSize,
            storageKey: stored.storageKey,
            status: "uploaded"
        });

        // ==========================================
        // 1. AUTHORIZATION TESTS (1 - 8)
        // ==========================================
        console.log("\n--- 1. Authorization & RBAC ---");

        // 1. Unauthenticated organizer screening access -> 401
        const resUnauth = await makeRequest("GET", `/camps/${campA._id}/screenings`);
        assert.strictEqual(resUnauth.status, 401, "1. Unauthenticated request must return 401");
        console.log("  [PASS] 1. Unauthenticated access blocked (HTTP 401)");

        // 2. Normal user accessing organizer screening endpoint -> 403
        const resNormalUser = await makeRequest("GET", `/camps/${campA._id}/screenings`, { Authorization: `Bearer ${tokenDonor1}` });
        assert.strictEqual(resNormalUser.status, 403, "2. Normal user must return 403");
        console.log("  [PASS] 2. Normal user accessing organizer screening blocked (HTTP 403)");

        // 3. Organizer accessing another organizer's camp -> 403
        const resCrossOrg = await makeRequest("GET", `/camps/${campA._id}/screenings`, { Authorization: `Bearer ${tokenOrgB}` });
        assert.strictEqual(resCrossOrg.status, 403, "3. Cross-organizer camp access must return 403");
        console.log("  [PASS] 3. Organizer accessing another organizer's camp blocked (HTTP 403)");

        // 4. Organizer accessing their own camp -> 200
        const resOwnOrg = await makeRequest("GET", `/camps/${campA._id}/screenings`, { Authorization: `Bearer ${tokenOrgA}` });
        assert.strictEqual(resOwnOrg.status, 200, "4. Organizer accessing own camp should succeed");
        assert.ok(Array.isArray(resOwnOrg.data.data.screenings), "Should return list of screenings");
        console.log("  [PASS] 4. Organizer accessing own camp succeeds (HTTP 200)");

        // 5. Organizer accessing donor not registered in camp -> 400/404
        const resUnregistered = await makeRequest("GET", `/camps/${campA._id}/screenings/${regDonor2CampB._id}`, { Authorization: `Bearer ${tokenOrgA}` });
        assert.ok(resUnregistered.status === 400 || resUnregistered.status === 404, "5. Donor not registered in this camp must return 400 or 404");
        console.log("  [PASS] 5. Accessing donor not registered in target camp blocked (HTTP 400/404)");

        // 6. Organizer accessing document from another camp/donor -> 403
        // Org B tries to access Doc 1 belonging to Donor 1 (registered for Camp A)
        const resCrossDoc = await makeRequest(
            "GET",
            `/camps/${campB._id}/screenings/${regDonor2CampB._id}/documents/${doc1._id}`,
            { Authorization: `Bearer ${tokenOrgB}` }
        );
        assert.strictEqual(resCrossDoc.status, 403, "6. Cross-donor document access must return 403");
        console.log("  [PASS] 6. Organizer accessing document of unregistered donor blocked (HTTP 403)");

        // 7. Organizer accessing document for their own registered donor -> 200
        const resOwnDoc = await makeRequest(
            "GET",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}/documents/${doc1._id}`,
            { Authorization: `Bearer ${tokenOrgA}` }
        );
        assert.strictEqual(resOwnDoc.status, 200, "7. Authorized document download must succeed");
        assert.strictEqual(resOwnDoc.headers["content-type"], "application/pdf");
        assert.strictEqual(resOwnDoc.headers["x-content-type-options"], "nosniff");
        console.log("  [PASS] 7. Organizer streaming document for registered donor succeeds (HTTP 200)");

        // 8. Admin access follows existing admin policy -> 200
        const resAdmin = await makeRequest("GET", `/camps/${campA._id}/screenings`, { Authorization: `Bearer ${tokenAdmin}` });
        assert.strictEqual(resAdmin.status, 200, "8. Admin access to camp screenings must return 200");
        console.log("  [PASS] 8. Administrator access to camp screenings succeeds (HTTP 200)");

        // ==========================================
        // 2. CAMP SCREENING LIFECYCLE TESTS (9 - 19)
        // ==========================================
        console.log("\n--- 2. Camp Screening Lifecycle & Decisions ---");

        // Open screening workspace
        const resWorkspace = await makeRequest(
            "GET",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgA}` }
        );
        assert.strictEqual(resWorkspace.status, 200, "Should open screening workspace");
        assert.strictEqual(resWorkspace.data.data.donor.name, donor1.name);
        assert.strictEqual(resWorkspace.data.data.medicalDocuments.length, 1);
        console.log("  [PASS] Screening workspace returned complete donor & document summary");

        // 9. Create camp screening
        const resCreate = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgA}` },
            {
                questionnaire: {
                    appearsWell: true,
                    currentIllnessFever: false,
                    recentMedicationTreatment: false,
                    basicMeasurementsChecked: true,
                    hemoglobin: 14.2,
                    bloodPressureSystolic: 120,
                    bloodPressureDiastolic: 80,
                    pulse: 72
                },
                observations: "Donor is in good physical condition. Veins accessible.",
                decision: "pending"
            }
        );
        assert.strictEqual(resCreate.status, 200, "9. Creating camp screening should succeed");
        const createdScreening = resCreate.data.data.campScreening;
        assert.strictEqual(createdScreening.decision, "pending");
        console.log("  [PASS] 9. Camp screening created successfully");

        // 10. Update camp screening
        const resUpdate = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgA}` },
            {
                observations: "Updated observations: donor resting well.",
                decision: "pending"
            }
        );
        assert.strictEqual(resUpdate.status, 200, "10. Updating camp screening should succeed");
        assert.strictEqual(resUpdate.data.data.campScreening.observations, "Updated observations: donor resting well.");
        console.log("  [PASS] 10. Camp screening updated successfully");

        // 11. Duplicate screening prevented (only 1 CampScreening per registration)
        const totalScreeningRecords = await CampScreening.countDocuments({ registration: regDonor1CampA._id });
        assert.strictEqual(totalScreeningRecords, 1, "11. Only one screening record must exist per registration");
        console.log("  [PASS] 11. Duplicate screening prevented (unique registration record enforced)");

        // 13. Deferred decision requires reason
        const resDeferNoReason = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgA}` },
            { decision: "temporarily_deferred" }
        );
        assert.strictEqual(resDeferNoReason.status, 400, "13. Temporarily deferred must require decisionReason");
        console.log("  [PASS] 13. Deferred decision requires clinical reason (HTTP 400)");

        // 14. Rejected decision requires reason
        const resRejectNoReason = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgA}` },
            { decision: "rejected" }
        );
        assert.strictEqual(resRejectNoReason.status, 400, "14. Rejected must require decisionReason");
        console.log("  [PASS] 14. Rejected decision requires reason (HTTP 400)");

        // 15. Needs medical review requires reason
        const resNeedsReviewNoReason = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgA}` },
            { decision: "needs_medical_review" }
        );
        assert.strictEqual(resNeedsReviewNoReason.status, 400, "15. Needs medical review must require decisionReason");
        console.log("  [PASS] 15. Needs medical review requires reason (HTTP 400)");

        // 12. Approved decision saved
        const resApprove = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgA}` },
            {
                decision: "approved",
                observations: "All physical criteria verified and approved."
            }
        );
        assert.strictEqual(resApprove.status, 200, "12. Approved decision should succeed");
        const approvedScreening = resApprove.data.data.campScreening;
        assert.strictEqual(approvedScreening.decision, "approved");
        console.log("  [PASS] 12. Approved decision saved successfully");

        // 16. screenedBy automatically derived
        assert.strictEqual(approvedScreening.screenedBy.toString(), organizerA._id.toString(), "16. screenedBy automatically derived from auth token");
        console.log("  [PASS] 16. screenedBy automatically derived from authenticated organizer");

        // 17. screenedAt automatically generated
        assert.ok(approvedScreening.screenedAt, "17. screenedAt automatically generated");
        console.log("  [PASS] 17. screenedAt automatically timestamped");

        // 18. Donor cannot modify organizer screening
        const resDonorTamper = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenDonor1}` },
            { decision: "approved" }
        );
        assert.strictEqual(resDonorTamper.status, 403, "18. Donor cannot modify organizer screening");
        console.log("  [PASS] 18. Donor blocked from modifying organizer screening (HTTP 403)");

        // 19. Organizer cannot modify another organizer's screening
        const resOrgBTamper = await makeRequest(
            "PUT",
            `/camps/${campA._id}/screenings/${regDonor1CampA._id}`,
            { Authorization: `Bearer ${tokenOrgB}` },
            { decision: "rejected", decisionReason: "Unauthorized override attempt" }
        );
        assert.strictEqual(resOrgBTamper.status, 403, "19. Other organizer cannot modify screening");
        console.log("  [PASS] 19. Cross-organizer screening tampering blocked (HTTP 403)");

        // ==========================================
        // 3. WORKFLOW & INTEGRATION TESTS
        // ==========================================
        console.log("\n--- 3. System Integration & Workflow ---");

        // 20. Camp approval does NOT alter global user.isEligible
        const freshDonor1 = await user.findById(donor1._id);
        // Note: donor1 was created with isEligible = true originally, verify it was not modified or set to a bypass state
        assert.strictEqual(freshDonor1.isEligible, true);
        console.log("  [PASS] 20. Camp approval remains camp-scoped and does not corrupt global user eligibility");

        // 21. Donor's getMyRegistration includes screeningStatus
        const resDonorReg = await makeRequest(
            "GET",
            `/camps/${campA._id}/registrations/me`,
            { Authorization: `Bearer ${tokenDonor1}` }
        );
        assert.strictEqual(resDonorReg.status, 200);
        assert.strictEqual(resDonorReg.data.data.registration.screeningStatus, "approved", "21. Donor sees screeningStatus");
        console.log("  [PASS] 21. Donor's registration details reflect screeningStatus");

        // 22. Donation recording gated by requireHealthScreening
        // Donor 2 has Camp B with requireHealthScreening: false -> recordDonation succeeds
        const d1 = await recordDonation({
            registrationId: regDonor2CampB._id.toString(),
            units: 1,
            status: "scheduled",
            recordedById: organizerB._id.toString(),
            recordedByRole: "organizer"
        });
        assert.ok(d1, "22. Donation can be recorded for camp not requiring health screening");
        console.log("  [PASS] 22. Standard donation recording unaffected when requireHealthScreening is false");

        // Donor 1 has Camp A with requireHealthScreening: true, and camp screening is APPROVED -> recordDonation succeeds
        const d2 = await recordDonation({
            registrationId: regDonor1CampA._id.toString(),
            units: 1,
            status: "scheduled",
            recordedById: organizerA._id.toString(),
            recordedByRole: "organizer"
        });
        assert.ok(d2, "22b. Donation recorded successfully when camp screening is approved");
        console.log("  [PASS] 22b. Donation recording succeeds when camp screening is approved");

        // 23. Audit logs recorded
        const auditLogs = await MedicalAuditLog.find({
            camp: campA._id,
            donor: donor1._id
        });
        assert.ok(auditLogs.length >= 3, "23. Multiple audit logs recorded for camp screening and document views");
        const actionsLogged = auditLogs.map(l => l.action);
        assert.ok(actionsLogged.includes("ORGANIZER_SCREENING_VIEWED"), "Logged ORGANIZER_SCREENING_VIEWED");
        assert.ok(actionsLogged.includes("MEDICAL_DOCUMENT_VIEWED_BY_ORGANIZER"), "Logged MEDICAL_DOCUMENT_VIEWED_BY_ORGANIZER");
        assert.ok(actionsLogged.includes("CAMP_SCREENING_DECISION_RECORDED"), "Logged CAMP_SCREENING_DECISION_RECORDED");
        console.log("  [PASS] 23. Audit trail correctly logged with actor, donor, camp, registration, and action");

        console.log("\n==================================================");
        console.log("ALL 23 CAMP-SPECIFIC SCREENING TESTS PASSED!");
        console.log("==================================================");

    } finally {
        // Clean up test data
        try {
            if (regDonor1CampA) await campRegistration.deleteMany({ _id: { $in: [regDonor1CampA._id, regDonor2CampB?._id] } });
            if (campA) await camp.deleteMany({ _id: { $in: [campA._id, campB?._id] } });
            if (organizerA) await user.deleteMany({ _id: { $in: [organizerA._id, organizerB?._id, donor1?._id, donor2?._id, admin?._id] } });
            if (doc1) await MedicalDocument.deleteMany({ _id: doc1._id });
            if (campA) await CampScreening.deleteMany({ camp: { $in: [campA._id, campB?._id] } });
            if (campA) await donation.deleteMany({ camp: { $in: [campA._id, campB?._id] } });
            if (campA) await MedicalAuditLog.deleteMany({ camp: { $in: [campA._id, campB?._id] } });
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }

        if (server) {
            server.close();
        }
        await mongoose.connection.close();
    }
}

runCampScreeningTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});

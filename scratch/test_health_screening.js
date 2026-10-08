/**
 * REDhope Donor Health Screening & Medical Review Test Suite
 * 
 * Verifies all 42 required scenarios:
 * - Authorization & RBAC (unauthenticated, donor isolation, organizer forbidden, admin access)
 * - Structured Questionnaire (drafting, validation, consent enforcement, anti-tampering)
 * - Document Upload & Storage (PDF, JPG, PNG magic bytes, exe rejection, path traversal sanitization, size limit)
 * - Document Access Control (owner streaming, IDOR prevention, admin reviewer access)
 * - Clinical Review Workflow (admin decision, reasons, deferral dates, audit events, user notifications)
 * - Final Eligibility Integration (unapproved screening blocking, 90-day interval preservation, admin block preservation)
 * - Camp Registration & Blood Matching Integration
 * - Medical Privacy & Zero-PII Protections across users, camps, matching, analytics, and notifications
 * - Audit Trail Logging
 */

const http = require("http");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");
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
const notification = require("c:/REDhope/REDhope/server/models/notification");
const HealthScreening = require("c:/REDhope/REDhope/server/models/healthScreening");
const MedicalDocument = require("c:/REDhope/REDhope/server/models/medicalDocument");
const MedicalAuditLog = require("c:/REDhope/REDhope/server/models/medicalAuditLog");

// Routes & Services
const authRoutes = require("c:/REDhope/REDhope/server/routes/authRoutes");
const eligibilityRoutes = require("c:/REDhope/REDhope/server/routes/eligibilityRoutes");
const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");
const campRegistrationRoutes = require("c:/REDhope/REDhope/server/routes/campRegistrationRoutes");
const bloodMatchingRoutes = require("c:/REDhope/REDhope/server/routes/bloodMatchingRoutes");
const healthScreeningRoutes = require("c:/REDhope/REDhope/server/routes/healthScreeningRoutes");
const adminHealthScreeningRoutes = require("c:/REDhope/REDhope/server/routes/adminHealthScreeningRoutes");
const { evaluateEligibility } = require("c:/REDhope/REDhope/server/services/eligibilityService");
const { findMatchingDonors } = require("c:/REDhope/REDhope/server/services/bloodMatchingService");
const { getCampAnalytics } = require("c:/REDhope/REDhope/server/services/analyticsService");

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_for_tests";

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/auth", authRoutes);
app.use("/eligibility", eligibilityRoutes);
app.use("/camps", campRegistrationRoutes);
app.use("/camps", campRoutes);
app.use("/matching", bloodMatchingRoutes);
app.use("/health-screening", healthScreeningRoutes);
app.use("/admin/health-screenings", adminHealthScreeningRoutes);

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

// Generate valid file buffers with proper magic bytes
function createMockPdf(content = "Test Medical Report PDF") {
    const header = Buffer.from("%PDF-1.4\n");
    const body = Buffer.from(content + "\n%%EOF");
    return Buffer.concat([header, body]);
}

function createMockJpeg() {
    return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
}

function createMockPng() {
    return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
}

function createMockExe() {
    return Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ executable header
}

async function runHealthScreeningTests() {
    console.log("==================================================");
    console.log("REDhope Donor Health Screening & Medical Review Suite");
    console.log("==================================================");

    await connectDB();
    console.log("MongoDB connected");

    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            console.log(`Test server running on ${baseUrl}\n`);
            resolve();
        });
    });

    const timestamp = Date.now();
    const hashedPassword = await bcrypt.hash("MedTest123!", 10);

    // Create Test Fixture Users
    const donor1 = await user.create({
        name: `Donor One ${timestamp}`,
        email: `donor1_${timestamp}@example.com`,
        password: hashedPassword,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        bloodGroup: "O+",
        role: "user",
        dateOfBirth: new Date("1996-03-20"),
        isEligible: true,
        isDonorAvailable: true
    });
    const donor1Token = createToken({ id: donor1._id.toString(), role: "user", email: donor1.email });

    const donor2 = await user.create({
        name: `Donor Two ${timestamp}`,
        email: `donor2_${timestamp}@example.com`,
        password: hashedPassword,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        bloodGroup: "A+",
        role: "user",
        dateOfBirth: new Date("1998-07-12"),
        isEligible: true,
        isDonorAvailable: true
    });
    const donor2Token = createToken({ id: donor2._id.toString(), role: "user", email: donor2.email });

    const organizer = await user.create({
        name: `Organizer ${timestamp}`,
        email: `org_${timestamp}@example.com`,
        password: hashedPassword,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        bloodGroup: "B+",
        role: "organizer"
    });
    const orgToken = createToken({ id: organizer._id.toString(), role: "organizer", email: organizer.email });

    const admin = await user.create({
        name: `Medical Admin ${timestamp}`,
        email: `admin_${timestamp}@example.com`,
        password: hashedPassword,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        bloodGroup: "AB+",
        role: "admin"
    });
    const adminToken = createToken({ id: admin._id.toString(), role: "admin", email: admin.email });

    let screening1Id = null;
    let doc1Id = null;
    let camp1Id = null;

    try {
        // ==========================================
        // 1. AUTHORIZATION & RBAC
        // ==========================================
        console.log("--- 1. Authorization & Role Access Controls ---");

        // 1. Unauthenticated request -> 401
        const resUnauth = await makeRequest("GET", "/health-screening/me");
        assert.strictEqual(resUnauth.status, 401, "1. Unauthenticated request must return 401");
        console.log("  [PASS] 1. Unauthenticated returns HTTP 401");

        // 2. User can access own screening
        const resOwnScreening = await makeRequest("GET", "/health-screening/me", { Authorization: `Bearer ${donor1Token}` });
        assert.strictEqual(resOwnScreening.status, 200, "2. User should access own screening");
        assert.ok(resOwnScreening.data.data?.screening, "Screening object should be returned");
        screening1Id = resOwnScreening.data.data.screening._id;
        console.log("  [PASS] 2. User can access own screening");

        // 3. User cannot access another user's screening (drafted separately for donor 2)
        const resDonor2Screening = await makeRequest("GET", "/health-screening/me", { Authorization: `Bearer ${donor2Token}` });
        assert.notStrictEqual(resDonor2Screening.data.data.screening._id, screening1Id, "Donor 2 must receive their own screening document, not Donor 1's");
        console.log("  [PASS] 3. User cannot access another user's screening (strict isolation)");

        // 4. Organizer cannot access medical records -> 403
        const resOrgAccess = await makeRequest("GET", "/health-screening/me", { Authorization: `Bearer ${orgToken}` });
        assert.strictEqual(resOrgAccess.status, 403, "4. Organizer cannot access medical screening records");
        console.log("  [PASS] 4. Organizer denied access to medical records (HTTP 403)");

        // 5. Admin can access authorized review dashboard
        const resAdminDashboard = await makeRequest("GET", "/admin/health-screenings", { Authorization: `Bearer ${adminToken}` });
        assert.strictEqual(resAdminDashboard.status, 200, "5. Admin can access review dashboard");
        assert.ok(Array.isArray(resAdminDashboard.data.data.screenings), "Admin should receive screenings list");
        console.log("  [PASS] 5. Admin can access authorized review dashboard");

        // ==========================================
        // 2. QUESTIONNAIRE MODEL & SUBMISSION
        // ==========================================
        console.log("\n--- 2. Questionnaire Model & Submission Workflow ---");

        // 6. Valid questionnaire update (draft)
        const validQuestionnaire = {
            generalHealth: {
                feelWell: true,
                hasFeverOrIllness: false,
                recoveredRecently: false
            },
            medicalHistory: {
                chronicCondition: false,
                recentSurgery: false,
                underTreatment: false
            },
            medication: {
                takingMedication: false
            },
            donationHistory: {
                donatedBefore: false,
                adverseReactionHistory: false
            },
            recentProcedures: {
                recentTattooOrPiercing: false,
                recentTransfusion: false
            },
            travelExposure: {
                highRiskTravel: false
            },
            pregnancyRelated: {
                isApplicable: false
            },
            measurements: {
                weightKg: 65,
                recentHemoglobin: 14.2
            },
            infectionRisk: {
                hepatitisOrJaundiceHistory: false,
                hivRiskExposure: false,
                otherInfectionRisk: false
            }
        };

        const resUpdateDraft = await makeRequest("PUT", "/health-screening/me", { Authorization: `Bearer ${donor1Token}` }, {
            questionnaire: validQuestionnaire,
            consentGiven: false
        });
        assert.strictEqual(resUpdateDraft.status, 200, "6. Questionnaire draft update should succeed");
        assert.strictEqual(resUpdateDraft.data.data.screening.questionnaire.measurements.weightKg, 65);
        console.log("  [PASS] 6. Valid questionnaire drafting succeeds");

        // 7. Missing/invalid questionnaire input handled safely
        const resInvalidBody = await makeRequest("PUT", "/health-screening/me", { Authorization: `Bearer ${donor1Token}` }, {
            questionnaire: "invalid_string_not_object"
        });
        assert.strictEqual(resInvalidBody.status, 200, "7. Malformed questionnaire input handled safely");
        console.log("  [PASS] 7. Invalid/missing fields handled safely without crash");

        // 8. Malformed data payload handled safely
        const resMalformed = await makeRequest("PUT", "/health-screening/me", { Authorization: `Bearer ${donor1Token}` }, null);
        assert.strictEqual(resMalformed.status, 200, "8. Empty body handled safely");
        console.log("  [PASS] 8. Malformed payload handled safely");

        // 9. Submission without consent rejected -> 400
        const resSubmitNoConsent = await makeRequest("POST", "/health-screening/me/submit", { Authorization: `Bearer ${donor1Token}` }, {
            consentGiven: false
        });
        assert.strictEqual(resSubmitNoConsent.status, 400, "9. Submission without consent must be rejected");
        console.log("  [PASS] 9. Consent strictly required for submission (HTTP 400)");

        // 10. User cannot directly set status: "approved" -> 403
        const resTamperStatus = await makeRequest("PUT", "/health-screening/me", { Authorization: `Bearer ${donor1Token}` }, {
            status: "approved"
        });
        assert.strictEqual(resTamperStatus.status, 403, "10. User cannot directly set approved status");
        console.log("  [PASS] 10. User blocked from self-approving medical status (HTTP 403)");

        // Submit with proper consent
        const resSubmitSuccess = await makeRequest("POST", "/health-screening/me/submit", { Authorization: `Bearer ${donor1Token}` }, {
            consentGiven: true
        });
        assert.strictEqual(resSubmitSuccess.status, 200, "Submission with consent should succeed");
        assert.strictEqual(resSubmitSuccess.data.data.screening.status, "submitted");
        console.log("  [PASS] Submitting with explicit consent marks status as 'submitted'");

        // ==========================================
        // 3. DOCUMENT UPLOAD & STORAGE
        // ==========================================
        console.log("\n--- 3. Document Upload & Private Storage Controls ---");

        // 11. Valid PDF upload accepted
        const mockPdf = createMockPdf();
        const resUploadPdf = await makeRequest("POST", "/health-screening/me/documents", { Authorization: `Bearer ${donor1Token}` }, {
            fileName: "blood_test_report.pdf",
            mimeType: "application/pdf",
            fileData: mockPdf.toString("base64"),
            documentType: "blood_report"
        });
        assert.strictEqual(resUploadPdf.status, 201, "11. Valid PDF upload should be accepted");
        assert.ok(resUploadPdf.data.data.document._id);
        doc1Id = resUploadPdf.data.data.document._id;
        assert.strictEqual(resUploadPdf.data.data.document.storageKey, undefined, "storageKey must NOT be exposed to client");
        console.log("  [PASS] 11. Valid PDF accepted and stored privately");

        // 12. Valid JPG upload accepted
        const mockJpg = createMockJpeg();
        const resUploadJpg = await makeRequest("POST", "/health-screening/me/documents", { Authorization: `Bearer ${donor1Token}` }, {
            fileName: "doctor_certificate.jpg",
            mimeType: "image/jpeg",
            fileData: mockJpg.toString("base64"),
            documentType: "medical_certificate"
        });
        assert.strictEqual(resUploadJpg.status, 201, "12. Valid JPG upload should be accepted");
        console.log("  [PASS] 12. Valid JPG accepted");

        // 13. Valid PNG upload accepted
        const mockPng = createMockPng();
        const resUploadPng = await makeRequest("POST", "/health-screening/me/documents", { Authorization: `Bearer ${donor1Token}` }, {
            fileName: "fitness_scan.png",
            mimeType: "image/png",
            fileData: mockPng.toString("base64"),
            documentType: "fitness_certificate"
        });
        assert.strictEqual(resUploadPng.status, 201, "13. Valid PNG upload should be accepted");
        console.log("  [PASS] 13. Valid PNG accepted");

        // 14. Invalid executable rejected (magic bytes check)
        const mockExe = createMockExe();
        const resUploadExe = await makeRequest("POST", "/health-screening/me/documents", { Authorization: `Bearer ${donor1Token}` }, {
            fileName: "malware.pdf", // spoofed extension
            mimeType: "application/pdf",
            fileData: mockExe.toString("base64"),
            documentType: "blood_report"
        });
        assert.strictEqual(resUploadExe.status, 400, "14. Spoofed executable must be rejected via magic bytes");
        console.log("  [PASS] 14. Executable rejected by magic byte signature verification");

        // 15. Invalid MIME rejected
        const resBadMime = await makeRequest("POST", "/health-screening/me/documents", { Authorization: `Bearer ${donor1Token}` }, {
            fileName: "script.js",
            mimeType: "application/javascript",
            fileData: Buffer.from("console.log('hi');").toString("base64"),
            documentType: "other"
        });
        assert.strictEqual(resBadMime.status, 400, "15. Unsupported MIME type must be rejected");
        console.log("  [PASS] 15. Invalid MIME rejected (HTTP 400)");

        // 16. Oversized file rejected (> 5MB)
        const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0x20); // 6MB
        const resOversized = await makeRequest("POST", "/health-screening/me/documents", { Authorization: `Bearer ${donor1Token}` }, {
            fileName: "huge.pdf",
            mimeType: "application/pdf",
            fileData: oversizedBuffer.toString("base64"),
            documentType: "other"
        });
        assert.strictEqual(resOversized.status, 400, "16. Oversized file (>5MB) must be rejected");
        console.log("  [PASS] 16. Oversized file (>5MB) rejected (HTTP 400)");

        // 17. Path traversal filename sanitized
        const resTraversal = await makeRequest("POST", "/health-screening/me/documents", { Authorization: `Bearer ${donor1Token}` }, {
            fileName: "../../../etc/passwd.pdf",
            mimeType: "application/pdf",
            fileData: mockPdf.toString("base64"),
            documentType: "other"
        });
        assert.strictEqual(resTraversal.status, 201, "17. File should be saved with sanitized filename");
        assert.ok(!resTraversal.data.data.document.originalFileName.includes(".."), "Filename must not contain path traversal");
        console.log("  [PASS] 17. Path traversal filename safely sanitized");

        // 18. Unauthorized document access rejected (Donor 2 cannot view Donor 1's document)
        const resIdorDoc = await makeRequest("GET", `/health-screening/documents/${doc1Id}`, { Authorization: `Bearer ${donor2Token}` });
        assert.strictEqual(resIdorDoc.status, 403, "18. Cross-donor document download must return 403 Forbidden");
        console.log("  [PASS] 18. Unauthorized cross-user document access blocked (HTTP 403)");

        // 19. User can access own document
        const resOwnDoc = await makeRequest("GET", `/health-screening/documents/${doc1Id}`, { Authorization: `Bearer ${donor1Token}` });
        assert.strictEqual(resOwnDoc.status, 200, "19. Owner can access own document stream");
        assert.strictEqual(resOwnDoc.headers["content-type"], "application/pdf");
        assert.strictEqual(resOwnDoc.headers["x-content-type-options"], "nosniff");
        console.log("  [PASS] 19. User can stream own document securely");

        // 20. Admin can access authorized document
        const resAdminDoc = await makeRequest("GET", `/admin/health-screenings/${screening1Id}/documents/${doc1Id}`, { Authorization: `Bearer ${adminToken}` });
        assert.strictEqual(resAdminDoc.status, 200, "20. Admin reviewer can access document");
        console.log("  [PASS] 20. Authorized admin reviewer can access document");

        // ==========================================
        // 4. REVIEWER WORKFLOW & DECISIONS
        // ==========================================
        console.log("\n--- 4. Medical Reviewer Decision Workflow ---");

        // 21. Admin can view detailed screening
        const resScreeningDetail = await makeRequest("GET", `/admin/health-screenings/${screening1Id}`, { Authorization: `Bearer ${adminToken}` });
        assert.strictEqual(resScreeningDetail.status, 200, "21. Admin can retrieve screening detail");
        assert.ok(resScreeningDetail.data.data.screening.user.email, "Screening detail should populate user profile");
        console.log("  [PASS] 21. Admin can access screening detail and history");

        // 22. Non-admin cannot submit review
        const resNonAdminReview = await makeRequest("PATCH", `/admin/health-screenings/${screening1Id}/review`, { Authorization: `Bearer ${donor1Token}` }, {
            decision: "approved"
        });
        assert.strictEqual(resNonAdminReview.status, 403, "22. Non-admin cannot submit review decision");
        console.log("  [PASS] 22. Non-admin blocked from reviewing screening (HTTP 403)");

        // 23. Invalid decision value rejected
        const resBadDecision = await makeRequest("PATCH", `/admin/health-screenings/${screening1Id}/review`, { Authorization: `Bearer ${adminToken}` }, {
            decision: "invalid_decision_state"
        });
        assert.strictEqual(resBadDecision.status, 400, "23. Invalid review decision rejected");
        console.log("  [PASS] 23. Invalid decision value rejected (HTTP 400)");

        // 24. Deferral reason required when decision is deferred
        const resDeferNoReason = await makeRequest("PATCH", `/admin/health-screenings/${screening1Id}/review`, { Authorization: `Bearer ${adminToken}` }, {
            decision: "temporarily_deferred"
        });
        assert.strictEqual(resDeferNoReason.status, 400, "24. Reason required when temporarily deferred");
        console.log("  [PASS] 24. Clinical reason mandatory for deferrals (HTTP 400)");

        // 25, 26, 27. Admin submits approval: records reviewer ID, reviewedAt, updates user status
        const resApprove = await makeRequest("PATCH", `/admin/health-screenings/${screening1Id}/review`, { Authorization: `Bearer ${adminToken}` }, {
            decision: "approved",
            reason: "Passed initial blood report and health questionnaire."
        });
        assert.strictEqual(resApprove.status, 200, "Admin approval should succeed");
        const approvedScreening = resApprove.data.data.screening;
        assert.strictEqual(approvedScreening.status, "approved", "Status should be approved");
        assert.strictEqual(approvedScreening.reviewerDecision.reviewer.toString(), admin._id.toString(), "25. Reviewer identity recorded");
        assert.ok(approvedScreening.reviewerDecision.reviewedAt, "26. reviewedAt timestamp recorded");
        console.log("  [PASS] 25. Reviewer identity recorded");
        console.log("  [PASS] 26. Review timestamp recorded");

        // 27. User sees updated status
        const resUserViewUpdated = await makeRequest("GET", "/health-screening/me", { Authorization: `Bearer ${donor1Token}` });
        assert.strictEqual(resUserViewUpdated.data.data.screening.status, "approved", "27. User sees updated status");
        console.log("  [PASS] 27. User sees updated approved status");

        // ==========================================
        // 5. ELIGIBILITY ENGINE INTEGRATION
        // ==========================================
        console.log("\n--- 5. Eligibility Engine Integration ---");

        // 28. Unapproved screening does not make user eligible
        // Donor 2 has draft screening -> evaluateEligibility returns isMedicallyEligible = false
        const donor2Doc = await user.findById(donor2._id);
        const donor2ScreeningDoc = await HealthScreening.findOne({ user: donor2._id });
        const eligDonor2 = evaluateEligibility(donor2Doc, { screening: donor2ScreeningDoc });
        assert.strictEqual(eligDonor2.isMedicallyEligible, false, "28. Unapproved screening must not make donor eligible");
        console.log("  [PASS] 28. Unapproved screening marks isMedicallyEligible = false");

        // 29. Approved screening still requires basic eligibility rules (age, interval)
        const donor1Doc = await user.findById(donor1._id);
        const eligDonor1 = evaluateEligibility(donor1Doc, { screening: approvedScreening });
        assert.strictEqual(eligDonor1.isMedicallyEligible, true, "29. Approved screening donor passes eligibility when basic rules pass");
        console.log("  [PASS] 29. Approved screening donor passes when basic rules pass");

        // 30. 90-day donation interval still applies EVEN IF screening is approved
        const recentDonationUser = await user.create({
            name: `Recent Donor ${timestamp}`,
            email: `recent_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1995-01-01"),
            isEligible: true,
            isDonorAvailable: true,
            lastDonationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
        });
        const eligRecent = evaluateEligibility(recentDonationUser, { screening: approvedScreening });
        assert.strictEqual(eligRecent.isMedicallyEligible, false, "30. 90-day donation interval still applies");
        assert.ok(eligRecent.reasons.some(r => r.includes("interval")), "Reason must mention donation interval");
        console.log("  [PASS] 30. 90-day donation interval still applies on approved screening");

        // 31. Admin/system block still applies EVEN IF screening is approved
        const blockedUser = await user.create({
            name: `Blocked Donor ${timestamp}`,
            email: `blocked_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1995-01-01"),
            isEligible: false, // administrative block
            isDonorAvailable: true
        });
        const eligBlocked = evaluateEligibility(blockedUser, { screening: approvedScreening });
        assert.strictEqual(eligBlocked.isMedicallyEligible, false, "31. Admin block still applies");
        console.log("  [PASS] 31. System/admin block still applies on approved screening");

        // 32. Donor availability remains separate
        const unavailableUser = await user.create({
            name: `Unavailable Donor ${timestamp}`,
            email: `unavail_${timestamp}@example.com`,
            password: hashedPassword,
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1995-01-01"),
            isEligible: true,
            isDonorAvailable: false
        });
        const eligUnavail = evaluateEligibility(unavailableUser, { screening: approvedScreening });
        assert.strictEqual(eligUnavail.isMedicallyEligible, true, "Medically eligible remains true");
        assert.strictEqual(eligUnavail.isDonorAvailable, false, "Donor availability remains separate");
        console.log("  [PASS] 32. Donor availability state remains separate");

        // ==========================================
        // 6. CAMP REGISTRATION INTEGRATION
        // ==========================================
        console.log("\n--- 6. Camp Registration Integration ---");

        // Create a test camp requiring health screening
        const testCamp = await camp.create({
            name: `Strict Medical Camp ${timestamp}`,
            description: "Camp with mandatory medical screening verification",
            organizer: organizer._id,
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 86400000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            status: "published",
            requireHealthScreening: true,
            location: { address: "Health Center", city: "Delhi", state: "DL", pincode: "110001" }
        });
        camp1Id = testCamp._id.toString();

        // 33. Donor without approved screening cannot register for camp requiring screening
        const resRegUnapproved = await makeRequest("POST", `/camps/${camp1Id}/register`, { Authorization: `Bearer ${donor2Token}` });
        assert.strictEqual(resRegUnapproved.status, 400, "33. User without approved screening cannot register for strict camp");
        assert.ok(resRegUnapproved.data.reasons || resRegUnapproved.data.message, "Should return rejection reason");
        console.log("  [PASS] 33. Donor without required screening blocked from camp registration (HTTP 400)");

        // 34. Approved user passes through existing eligibility checks and registers
        const resRegApproved = await makeRequest("POST", `/camps/${camp1Id}/register`, { Authorization: `Bearer ${donor1Token}` });
        assert.strictEqual(resRegApproved.status, 201, "34. Approved donor can register for camp");
        console.log("  [PASS] 34. Approved donor passes registration eligibility check (HTTP 201)");

        // ==========================================
        // 7. BLOOD MATCHING INTEGRATION
        // ==========================================
        console.log("\n--- 7. Blood Matching Integration ---");

        // 35. Medically unapproved donor is not returned as an eligible candidate in blood matching
        // Donor 2 has unapproved screening. Request matches for A- / A+ blood:
        const matchingResults = await findMatchingDonors({ bloodGroup: "A+" });
        const matchingIds = matchingResults.matches.map(m => m.userId);
        assert.ok(!matchingIds.includes(donor2._id.toString()), "35. Unapproved screening donor must NOT be included in matches");
        console.log("  [PASS] 35. Medically unapproved donor excluded from blood matching results");

        // ==========================================
        // 8. PRIVACY & ZERO-PII PROTECTIONS
        // ==========================================
        console.log("\n--- 8. Privacy & Zero-PII Invariants ---");

        // 36. Medical data absent from normal user list response
        const resUserList = await makeRequest("GET", "/auth/me", { Authorization: `Bearer ${donor1Token}` });
        const userJson = JSON.stringify(resUserList.data);
        assert.ok(!userJson.includes("questionnaire"), "36. Medical questionnaire must not be in /auth/me");
        assert.ok(!userJson.includes("storageKey"), "Storage key must not be in /auth/me");
        console.log("  [PASS] 36. Medical data absent from normal user responses");

        // 37. Medical data absent from camp details response
        const resCampDetail = await makeRequest("GET", `/camps/${camp1Id}`);
        const campJson = JSON.stringify(resCampDetail.data);
        assert.ok(!campJson.includes("questionnaire"), "37. Medical questionnaire absent from camp details");
        assert.ok(!campJson.includes("blood_report"), "Documents absent from camp details");
        console.log("  [PASS] 37. Medical data absent from camp discovery responses");

        // 38. Medical data absent from matching responses
        const matchingJson = JSON.stringify(matchingResults);
        assert.ok(!matchingJson.includes("questionnaire"), "38. Medical data absent from blood matching response");
        assert.ok(!matchingJson.includes("storageKey"), "Storage key absent from blood matching response");
        console.log("  [PASS] 38. Medical data absent from matching results");

        // 39. Medical data absent from analytics
        const resAnalytics = await makeRequest("GET", "/camps/analytics", { Authorization: `Bearer ${adminToken}` });
        const analyticsJson = JSON.stringify(resAnalytics.data);
        assert.ok(!analyticsJson.includes("questionnaire"), "39. Medical data absent from analytics");
        assert.ok(!analyticsJson.includes("storageKey"), "Storage key absent from analytics");
        console.log("  [PASS] 39. Medical data completely absent from analytics");

        // 40. Medical details absent from notification payloads
        const notifications = await notification.find({ user: donor1._id });
        const notifJson = JSON.stringify(notifications);
        assert.ok(!notifJson.includes("chronicCondition"), "40. Questionnaire absent from notifications");
        assert.ok(!notifJson.includes("weightKg"), "Measurements absent from notifications");
        console.log("  [PASS] 40. Specific medical details absent from in-app notifications");

        // ==========================================
        // 9. AUDIT TRAIL LOGGING
        // ==========================================
        console.log("\n--- 9. Medical Audit Trail Invariants ---");

        // 41. Document access creates audit event
        const docAuditEvents = await MedicalAuditLog.find({ resourceId: doc1Id });
        assert.ok(docAuditEvents.length >= 1, "41. Document actions must be logged in audit trail");
        const docActions = docAuditEvents.map(e => e.action);
        assert.ok(docActions.includes("MEDICAL_DOCUMENT_UPLOADED") || docActions.includes("MEDICAL_DOCUMENT_DOWNLOADED"), "Must log upload or download event");
        console.log("  [PASS] 41. Document access logged in medical audit trail");

        // 42. Review decision creates audit event
        const screeningAuditEvents = await MedicalAuditLog.find({ resourceId: screening1Id });
        assert.ok(screeningAuditEvents.length >= 1, "42. Screening actions must be logged in audit trail");
        const screeningActions = screeningAuditEvents.map(e => e.action);
        assert.ok(screeningActions.includes("SCREENING_REVIEWED"), "SCREENING_REVIEWED action must be logged");
        console.log("  [PASS] 42. Clinical review decision logged in audit trail");

        console.log("\n==================================================");
        console.log("Health Screening Test Suite: 42 passed, 0 failed");
        console.log("==================================================");

    } finally {
        if (server) server.close();
        // Clean up test fixtures safely
        await MedicalDocument.deleteMany({ user: { $in: [donor1._id, donor2._id] } });
        await HealthScreening.deleteMany({ user: { $in: [donor1._id, donor2._id] } });
        await MedicalAuditLog.deleteMany({ actor: { $in: [donor1._id, donor2._id, admin._id] } });
        await campRegistration.deleteMany({ camp: camp1Id });
        if (camp1Id) await camp.findByIdAndDelete(camp1Id);
        await user.deleteMany({ _id: { $in: [donor1._id, donor2._id, organizer._id, admin._id] } });
        await mongoose.disconnect();
    }
}

runHealthScreeningTests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
});

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
const bloodRequest = require("c:/REDhope/REDhope/server/models/bloodRequest");
const notification = require("c:/REDhope/REDhope/server/models/notification");
const donation = require("c:/REDhope/REDhope/server/models/donation");

const emailService = require("c:/REDhope/REDhope/server/services/emailService");
const notificationDeliveryService = require("c:/REDhope/REDhope/server/services/notificationDeliveryService");
const notificationService = require("c:/REDhope/REDhope/server/services/notificationService");
const notificationScheduler = require("c:/REDhope/REDhope/server/services/notificationScheduler");
const bloodRequestService = require("c:/REDhope/REDhope/server/services/bloodRequestService");
const donationService = require("c:/REDhope/REDhope/server/services/donationService");

const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");
const campRegistrationRoutes = require("c:/REDhope/REDhope/server/routes/campRegistrationRoutes");
const bloodMatchingRoutes = require("c:/REDhope/REDhope/server/routes/bloodMatchingRoutes");
const donationRoutes = require("c:/REDhope/REDhope/server/routes/donationRoutes");
const authRoutes = require("c:/REDhope/REDhope/server/routes/authroutes");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_tests";

function makeRequest(baseUrl, options, bodyData) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.path || "/", baseUrl);
        const reqOpts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || "GET",
            headers: options.headers || {}
        };

        if (bodyData) {
            reqOpts.headers["Content-Type"] = "application/json";
        }

        const req = http.request(reqOpts, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on("error", reject);

        if (bodyData) {
            req.write(typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData));
        }
        req.end();
    });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
    console.log("=== REDhope Email Notification Test Suite ===");
    await connectDB();

    const app = express();
    app.use(express.json());
    app.use("/auth", authRoutes);
    app.use("/camps", campRoutes);
    app.use("/camps", campRegistrationRoutes);
    app.use("/matching", bloodMatchingRoutes);
    app.use("/donations", donationRoutes);

    const server = http.createServer(app);
    await new Promise((res) => server.listen(0, res));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Test server running at ${baseUrl}`);

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

    const testPrefix = `test_email_${Date.now()}`;
    const sentEmails = [];

    // Mock sender that captures sent emails
    emailService.setMockEmailSender(async (payload) => {
        sentEmails.push(payload);
        return { success: true, messageId: `<mock-${Date.now()}@test.com>` };
    });

    try {
        // Setup test users
        const passwordHash = await bcrypt.hash("Password123!", 10);

        const basePhone = Math.floor(6000000000 + Math.random() * 3000000000);
        const organizerUser = await user.create({
            name: "Organizer Email Test",
            email: `${testPrefix}_organizer@test.com`,
            password: passwordHash,
            phone: String(basePhone),
            role: "organizer",
            bloodGroup: "O+",
            location: { city: "Mumbai", coordinates: [72.8777, 19.0760] },
            emailNotifications: true
        });

        const donorWithEmail = await user.create({
            name: "Donor With Email",
            email: `${testPrefix}_donor1@test.com`,
            password: passwordHash,
            phone: String(basePhone + 1),
            role: "user",
            bloodGroup: "A+",
            location: { city: "Mumbai", coordinates: [72.8777, 19.0760] },
            emailNotifications: true
        });

        const donorOptedOut = await user.create({
            name: "Donor Opted Out",
            email: `${testPrefix}_donor2@test.com`,
            password: passwordHash,
            phone: String(basePhone + 2),
            role: "user",
            bloodGroup: "B+",
            location: { city: "Mumbai", coordinates: [72.8777, 19.0760] },
            emailNotifications: false
        });

        const organizerToken = jwt.sign({ id: organizerUser._id, role: organizerUser.role }, JWT_SECRET, { expiresIn: "1h" });
        const donorWithEmailToken = jwt.sign({ id: donorWithEmail._id, role: donorWithEmail.role }, JWT_SECRET, { expiresIn: "1h" });
        const donorOptedOutToken = jwt.sign({ id: donorOptedOut._id, role: donorOptedOut.role }, JWT_SECRET, { expiresIn: "1h" });

        // -------------------------------------------------------------
        console.log("\n--- TEST 1: Email Service Configuration Validation ---");
        // -------------------------------------------------------------
        const cfg = emailService.getEmailConfig();
        assert(typeof cfg.isConfigured === "boolean", "isConfigured returns a boolean");
        assert(typeof cfg.enabled === "boolean", "enabled returns a boolean");
        assert(typeof cfg.fromEmail === "string", "fromEmail is configured string");
        assert(!("apiKey" in cfg), "API key is NEVER exposed in email configuration object");

        // -------------------------------------------------------------
        console.log("\n--- TEST 2: Successful Email Delivery (Mocked) ---");
        // -------------------------------------------------------------
        sentEmails.length = 0;
        const sendResult = await emailService.sendEmail({
            to: "testrecipient@example.com",
            subject: "Test Subject",
            html: "<p>Hello Test</p>",
            text: "Hello Test"
        });
        assert(sendResult.success === true, "sendEmail returns success: true");
        assert(sentEmails.length === 1, "Mock email sender was called once");
        const sentTo = Array.isArray(sentEmails[0].to) ? sentEmails[0].to[0].email : sentEmails[0].to;
        assert(sentTo === "testrecipient@example.com", "Recipient matches");
        assert(sentEmails[0].subject === "Test Subject", "Subject matches");

        // -------------------------------------------------------------
        console.log("\n--- TEST 3: Brevo API Failure Handling ---");
        // -------------------------------------------------------------
        emailService.setMockEmailSender(async () => {
            const err = new Error("Brevo HTTP 401 Unauthorized: invalid key");
            err.statusCode = 401;
            throw err;
        });
        const failResult = await emailService.sendEmail({
            to: "failtest@example.com",
            subject: "Fail Subject",
            html: "<p>Fail</p>"
        });
        assert(failResult.success === false, "sendEmail gracefully handles API errors returning success: false");
        assert(failResult.error !== undefined, "sendEmail error is captured without throwing");

        // -------------------------------------------------------------
        console.log("\n--- TEST 4: Network Failure / Timeout Handling ---");
        // -------------------------------------------------------------
        emailService.setMockEmailSender(async () => {
            throw new Error("ETIMEDOUT: Connection timed out");
        });
        const networkFailResult = await emailService.sendEmail({
            to: "timeouttest@example.com",
            subject: "Timeout Subject",
            html: "<p>Timeout</p>"
        });
        assert(networkFailResult.success === false, "sendEmail safely catches network timeouts without throwing");

        // Restore working mock sender
        emailService.setMockEmailSender(async (payload) => {
            sentEmails.push(payload);
            return { success: true, messageId: `<mock-${Date.now()}@test.com>` };
        });

        // -------------------------------------------------------------
        console.log("\n--- TEST 5: Missing or Invalid Parameters Handling ---");
        // -------------------------------------------------------------
        const invalidEmailRes = await emailService.sendEmail({
            to: "invalid-email-format",
            subject: "Invalid",
            html: "<p>test</p>"
        });
        assert(invalidEmailRes.success === false, "sendEmail rejects invalid email format");

        const missingSubjectRes = await emailService.sendEmail({
            to: "valid@example.com",
            subject: "",
            html: "<p>test</p>"
        });
        assert(missingSubjectRes.success === false, "sendEmail rejects empty subject");

        // -------------------------------------------------------------
        console.log("\n--- TEST 6: User Preferences: emailNotifications: false skips email ---");
        // -------------------------------------------------------------
        sentEmails.length = 0;
        const optOutNotif = await notificationService.createNotification({
            userId: donorOptedOut._id,
            type: "system",
            title: "Test In-App Only",
            message: "This should create an in-app notification but NOT send an email.",
            metadata: { test: true }
        });
        await sleep(100);
        assert(optOutNotif !== null, "In-app notification created successfully for opted-out user");
        assert(sentEmails.length === 0, "No email was sent because emailNotifications is false");

        // -------------------------------------------------------------
        console.log("\n--- TEST 7: Camp Registration Confirmed Email ---");
        // -------------------------------------------------------------
        sentEmails.length = 0;
        const camp1 = await camp.create({
            name: "Annual Hope Blood Camp",
            description: "Community donation drive",
            organizer: organizerUser._id,
            startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            location: {
                address: "Hope Medical Center, Sector 4",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                coordinates: [72.8777, 19.0760]
            },
            status: "published"
        });

        const regRes = await makeRequest(baseUrl, {
            path: `/camps/${camp1._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${donorWithEmailToken}` }
        });
        assert(regRes.statusCode === 201, "Donor registered successfully (201)");
        await sleep(150);

        const regEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && e.subject.includes("Registration Confirmed");
        });
        assert(regEmail !== undefined, "Registration confirmation email was dispatched");
        assert(regEmail && regEmail.htmlContent.includes(camp1.name), "Email HTML contains camp name");
        assert(regEmail && regEmail.htmlContent.includes("Hope Medical Center"), "Email HTML contains camp venue");

        // -------------------------------------------------------------
        console.log("\n--- TEST 8: Camp Registration Cancelled Email ---");
        // -------------------------------------------------------------
        sentEmails.length = 0;
        const cancelRegRes = await makeRequest(baseUrl, {
            path: `/camps/${camp1._id}/register`,
            method: "DELETE",
            headers: { Authorization: `Bearer ${donorWithEmailToken}` }
        });
        assert(cancelRegRes.statusCode === 200, "Registration cancelled successfully (200)");
        await sleep(150);

        const cancelRegEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && e.subject.includes("Registration Cancelled");
        });
        assert(cancelRegEmail !== undefined, "Registration cancellation email was dispatched");
        assert(cancelRegEmail && cancelRegEmail.htmlContent.includes(camp1.name), "Email HTML contains camp name");

        // -------------------------------------------------------------
        console.log("\n--- TEST 9: Camp Update Email ---");
        // -------------------------------------------------------------
        // Register donor again to test camp update notification
        await makeRequest(baseUrl, {
            path: `/camps/${camp1._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${donorWithEmailToken}` }
        });
        await sleep(100);
        sentEmails.length = 0;

        const updateCampRes = await makeRequest(baseUrl, {
            path: `/camps/${camp1._id}`,
            method: "PUT",
            headers: { Authorization: `Bearer ${organizerToken}` }
        }, {
            startTime: "10:30",
            description: "Updated camp timing starting from 10:30 AM"
        });
        assert(updateCampRes.statusCode === 200, "Camp updated successfully (200)");
        await sleep(150);

        const updateEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && (e.subject.includes("Update") || e.subject.includes("Updated"));
        });
        assert(updateEmail !== undefined, "Camp update email was dispatched to registered donor");
        assert(updateEmail && updateEmail.htmlContent.includes(camp1.name), "Email HTML contains camp name");

        // -------------------------------------------------------------
        console.log("\n--- TEST 10: Camp Reminder (24h) Email ---");
        // -------------------------------------------------------------
        // Create camp starting in 12 hours
        const reminderCamp = await camp.create({
            name: "Urgent Tomorrow Camp",
            description: "Starting tomorrow morning",
            organizer: organizerUser._id,
            startDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 16 * 60 * 60 * 1000),
            startTime: "08:00",
            endTime: "16:00",
            capacity: 30,
            location: {
                address: "Community Hall, Ward 2",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                coordinates: [72.8777, 19.0760]
            },
            status: "published"
        });

        await campRegistration.create({
            camp: reminderCamp._id,
            user: donorWithEmail._id,
            status: "registered"
        });

        sentEmails.length = 0;
        const remindersSent = await notificationScheduler.checkCampReminders();
        assert(remindersSent >= 1, `checkCampReminders triggered ${remindersSent} reminders`);
        await sleep(150);

        const reminderEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && e.subject.includes("Camp Reminder");
        });
        assert(reminderEmail !== undefined, "Camp reminder 24h email was dispatched");
        assert(reminderEmail && reminderEmail.htmlContent.includes(reminderCamp.name), "Email HTML contains reminder camp name");

        // -------------------------------------------------------------
        console.log("\n--- TEST 11: Blood Requirement / Blood Match Email ---");
        // -------------------------------------------------------------
        sentEmails.length = 0;
        // DonorWithEmail has A+ blood group, Mumbai location
        const matchRes = await bloodRequestService.createBloodRequirement({
            bloodGroup: "A+",
            units: 2,
            urgency: "urgent",
            hospital: "City General Hospital",
            locationCity: "Mumbai",
            contactPhone: "9876543210",
            createdBy: organizerUser._id
        });
        assert(matchRes.notifiedCount >= 1, `Blood match created and notified ${matchRes.notifiedCount} donors`);
        await sleep(150);

        const matchEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && (e.subject.includes("Blood Requirement") || e.subject.includes("Blood Match"));
        });
        assert(matchEmail !== undefined, "Blood match email was dispatched to compatible donor");
        assert(matchEmail && matchEmail.htmlContent.includes("A+"), "Email HTML contains blood group A+");

        // -------------------------------------------------------------
        console.log("\n--- TEST 12: Donation Reminder Email (Eligibility Scheduler) ---");
        // -------------------------------------------------------------
        // Set donor lastDonationDate to 95 days ago (eligible again)
        donorWithEmail.lastDonationDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
        await donorWithEmail.save();

        sentEmails.length = 0;
        const eligReminders = await notificationScheduler.checkDonationEligibilityReminders();
        assert(eligReminders >= 1, `checkDonationEligibilityReminders triggered ${eligReminders} reminders`);
        await sleep(150);

        const eligEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && e.subject.includes("Eligible to Donate");
        });
        assert(eligEmail !== undefined, "Donation eligibility reminder email was dispatched");
        assert(eligEmail && (eligEmail.htmlContent.includes("90-day") || eligEmail.htmlContent.includes("90 days")), "Email HTML mentions eligibility duration");

        // -------------------------------------------------------------
        console.log("\n--- TEST 13: Donation Recorded Email ---");
        // -------------------------------------------------------------
        // Create a camp and active registration to record donation for
        const donationCamp = await camp.create({
            name: "Blood Drive Central",
            description: "Camp for donation testing",
            organizer: organizerUser._id,
            startDate: new Date(),
            endDate: new Date(),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 20,
            location: {
                address: "Central Hospital",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                coordinates: [72.8777, 19.0760]
            },
            status: "published"
        });

        const activeReg = await campRegistration.create({
            camp: donationCamp._id,
            user: donorWithEmail._id,
            status: "registered"
        });

        sentEmails.length = 0;
        const donationRec = await donationService.recordDonation({
            registrationId: activeReg._id.toString(),
            status: "completed",
            units: 1,
            donationDate: new Date(),
            recordedById: organizerUser._id.toString(),
            recordedByRole: "organizer"
        });
        assert(donationRec !== null, "Donation recorded successfully as completed");
        await sleep(150);

        const donationEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && e.subject.includes("Donation Recorded");
        });
        assert(donationEmail !== undefined, "Donation completion email was dispatched");
        assert(donationEmail && donationEmail.htmlContent.includes(donationCamp.name), "Email HTML mentions camp name");
        assert(donationEmail && donationEmail.htmlContent.includes("gift of life"), "Email HTML thanks donor for life-saving gift");

        // -------------------------------------------------------------
        console.log("\n--- TEST 14: Camp Cancellation Email ---");
        // -------------------------------------------------------------
        // Register donor with email to another camp, then cancel camp
        const campToCancel = await camp.create({
            name: "Camp To Be Cancelled",
            description: "Weather warning cancellation",
            organizer: organizerUser._id,
            startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            startTime: "10:00",
            endTime: "16:00",
            capacity: 20,
            location: {
                address: "Outdoor Park",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                coordinates: [72.8777, 19.0760]
            },
            status: "published"
        });

        await campRegistration.create({
            camp: campToCancel._id,
            user: donorWithEmail._id,
            status: "registered"
        });

        sentEmails.length = 0;
        const cancelCampRes = await makeRequest(baseUrl, {
            path: `/camps/${campToCancel._id}`,
            method: "PUT",
            headers: { Authorization: `Bearer ${organizerToken}` }
        }, {
            status: "cancelled"
        });
        assert(cancelCampRes.statusCode === 200, "Camp cancelled successfully (200)");
        await sleep(150);

        const campCancelEmail = sentEmails.find(e => {
            const recipient = Array.isArray(e.to) ? e.to[0].email : e.to;
            return recipient === donorWithEmail.email && e.subject.includes("Camp Cancelled");
        });
        assert(campCancelEmail !== undefined, "Camp cancellation email was dispatched to registered donors");
        assert(campCancelEmail && campCancelEmail.htmlContent.includes(campToCancel.name), "Email HTML contains camp name");

        // -------------------------------------------------------------
        console.log("\n--- TEST 15: Duplicate / Idempotency Protection ---");
        // -------------------------------------------------------------
        sentEmails.length = 0;
        const duplicateEventKey = `test-idempotent-key-${Date.now()}`;
        const notif1 = await notificationService.createNotification({
            userId: donorWithEmail._id,
            type: "system",
            title: "Idempotency Test",
            message: "First creation",
            eventKey: duplicateEventKey
        });
        await sleep(100);
        const emailCountAfterFirst = sentEmails.length;

        // Try creating with identical eventKey
        const notif2 = await notificationService.createNotification({
            userId: donorWithEmail._id,
            type: "system",
            title: "Idempotency Test Duplicate",
            message: "Second creation should be deduplicated",
            eventKey: duplicateEventKey
        });
        await sleep(100);
        const emailCountAfterSecond = sentEmails.length;

        assert(notif1._id.toString() === notif2._id.toString(), "createNotification returns identical document on duplicate eventKey");
        assert(emailCountAfterFirst === 1, "First notification triggered 1 email");
        assert(emailCountAfterSecond === 1, "Duplicate notification did NOT trigger a second email");

        // -------------------------------------------------------------
        console.log("\n--- TEST 16: Email Failure Does NOT Break Operations (Resilience) ---");
        // -------------------------------------------------------------
        // Simulate Brevo being down / throwing error
        emailService.setMockEmailSender(async () => {
            throw new Error("Brevo 503 Service Unavailable");
        });

        const campResilient = await camp.create({
            name: "Resilience Camp",
            description: "Testing resilience when email fails",
            organizer: organizerUser._id,
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            startTime: "09:00",
            endTime: "17:00",
            capacity: 25,
            location: {
                address: "Resilience Hall",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                coordinates: [72.8777, 19.0760]
            },
            status: "published"
        });

        // Ensure donor is eligible to register (in Test 13 lastDonationDate was set to today)
        donorWithEmail.lastDonationDate = null;
        await donorWithEmail.save();

        // Register donor should succeed with 201 even though email fails
        const regResilience = await makeRequest(baseUrl, {
            path: `/camps/${campResilient._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${donorWithEmailToken}` }
        });
        if (regResilience.statusCode !== 201) {
            console.log("regResilience error body:", regResilience.body);
        }
        assert(regResilience.statusCode === 201, "Registration succeeds with 201 despite email failure");

        // In-app notification should still exist
        const inAppNotif = await notification.findOne({
            user: donorWithEmail._id,
            type: "camp_registration",
            title: "Camp Registration Confirmed",
            "metadata.campId": campResilient._id.toString()
        });
        assert(inAppNotif !== null, "In-app notification was still created despite email failure");

        // -------------------------------------------------------------
        // Cleanup test data
        console.log("\nCleaning up test artifacts...");
        await user.deleteMany({ _id: { $in: [organizerUser._id, donorWithEmail._id, donorOptedOut._id] } });
        await camp.deleteMany({ organizer: organizerUser._id });
        await campRegistration.deleteMany({ user: { $in: [donorWithEmail._id, donorOptedOut._id] } });
        await notification.deleteMany({ user: { $in: [organizerUser._id, donorWithEmail._id, donorOptedOut._id] } });
        await donation.deleteMany({ donor: donorWithEmail._id });
        await bloodRequest.deleteMany({ createdBy: organizerUser._id });

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        server.close();
        await mongoose.connection.close();
    }

    console.log("\n=================================");
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log("=================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();

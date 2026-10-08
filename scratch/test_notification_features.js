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

const notificationService = require("c:/REDhope/REDhope/server/services/notificationService");
const notificationScheduler = require("c:/REDhope/REDhope/server/services/notificationScheduler");
const bloodRequestService = require("c:/REDhope/REDhope/server/services/bloodRequestService");
const eligibilityService = require("c:/REDhope/REDhope/server/services/eligibilityService");

const notificationRoutes = require("c:/REDhope/REDhope/server/routes/notificationRoutes");
const campRoutes = require("c:/REDhope/REDhope/server/routes/campRoutes");
const campRegistrationRoutes = require("c:/REDhope/REDhope/server/routes/campRegistrationRoutes");
const bloodMatchingRoutes = require("c:/REDhope/REDhope/server/routes/bloodMatchingRoutes");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_tests";

// Helper HTTP request function
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
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on("error", reject);

        if (bodyData) {
            req.write(JSON.stringify(bodyData));
        }
        req.end();
    });
}

function generateToken(userDoc) {
    return jwt.sign(
        { id: userDoc._id.toString(), email: userDoc.email, role: userDoc.role },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  [PASS] ${testName}`);
        passedCount++;
    } else {
        console.error(`  [FAIL] ${testName}`);
        failedCount++;
    }
}

async function runTests() {
    console.log("=== Starting Notification Features Test Suite ===");

    await connectDB();

    const app = express();
    app.use(express.json());
    app.use("/notifications", notificationRoutes);
    app.use("/camps", campRegistrationRoutes);
    app.use("/camps", campRoutes);
    app.use("/matching", bloodMatchingRoutes);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Test server running at ${baseUrl}`);

    const createdUserIds = [];
    const createdCampIds = [];
    const createdRequestIds = [];

    try {
        const hashedPassword = await bcrypt.hash("Password123!", 10);
        const testRunId = Date.now();

        // Setup Test Users
        // 1. Donor User A (O+, eligible, available)
        const donorA = await user.create({
            name: "Donor Alpha",
            email: `donor_a_${testRunId}@test.com`,
            phone: `9111${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1995-05-15"),
            isEligible: true,
            isDonorAvailable: true,
            location: {
                city: "Ahmedabad",
                state: "Gujarat",
                coordinates: [72.5714, 23.0225] // Navrangpura
            }
        });
        createdUserIds.push(donorA._id);
        const tokenA = generateToken(donorA);

        // 2. Donor User B (A+, eligible, available, located in Surat)
        const donorB = await user.create({
            name: "Donor Beta",
            email: `donor_b_${testRunId}@test.com`,
            phone: `9222${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "A+",
            role: "user",
            dateOfBirth: new Date("1992-08-20"),
            isEligible: true,
            isDonorAvailable: true,
            location: {
                city: "Surat",
                state: "Gujarat",
                coordinates: [72.8311, 21.1702] // Surat (~200km away)
            }
        });
        createdUserIds.push(donorB._id);
        const tokenB = generateToken(donorB);

        // 3. Ineligible Donor (isEligible: false)
        const ineligibleDonor = await user.create({
            name: "Donor Ineligible",
            email: `donor_ineligible_${testRunId}@test.com`,
            phone: `9333${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1995-01-01"),
            isEligible: false,
            isDonorAvailable: true
        });
        createdUserIds.push(ineligibleDonor._id);

        // 4. Unavailable Donor
        const unavailableDonor = await user.create({
            name: "Donor Unavailable",
            email: `donor_unavail_${testRunId}@test.com`,
            phone: `9444${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "O+",
            role: "user",
            dateOfBirth: new Date("1990-01-01"),
            isEligible: true,
            isDonorAvailable: false
        });
        createdUserIds.push(unavailableDonor._id);

        // 5. Incompatible Blood Group Donor (AB+)
        const incompatibleDonor = await user.create({
            name: "Donor Incompatible",
            email: `donor_incompat_${testRunId}@test.com`,
            phone: `9555${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "AB+",
            role: "user",
            dateOfBirth: new Date("1990-01-01"),
            isEligible: true,
            isDonorAvailable: true
        });
        createdUserIds.push(incompatibleDonor._id);

        // 6. Organizer User
        const organizer = await user.create({
            name: "Organizer One",
            email: `organizer_${testRunId}@test.com`,
            phone: `9666${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "O+",
            role: "organizer"
        });
        createdUserIds.push(organizer._id);
        const tokenOrg = generateToken(organizer);

        // 7. Donor with prior donation (90 days elapsed -> eligible again)
        const ninetyDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
        const cycleDonor = await user.create({
            name: "Cycle Donor",
            email: `donor_cycle_${testRunId}@test.com`,
            phone: `9777${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "B+",
            role: "user",
            dateOfBirth: new Date("1988-04-10"),
            isEligible: true,
            isDonorAvailable: true,
            lastDonationDate: ninetyDaysAgo
        });
        createdUserIds.push(cycleDonor._id);

        // 8. Donor with recent donation (only 10 days ago -> ineligible)
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const recentDonor = await user.create({
            name: "Recent Donor",
            email: `donor_recent_${testRunId}@test.com`,
            phone: `9888${String(testRunId).slice(-6)}`,
            password: hashedPassword,
            bloodGroup: "B+",
            role: "user",
            dateOfBirth: new Date("1988-04-10"),
            isEligible: true,
            isDonorAvailable: true,
            lastDonationDate: tenDaysAgo
        });
        createdUserIds.push(recentDonor._id);

        // Create a Published Camp for registration testing
        const futureCampDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        const testCamp = await camp.create({
            name: "Red Cross Mega Camp",
            description: "Annual blood drive",
            location: {
                address: "Community Hall, SG Highway",
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380054"
            },
            startDate: futureCampDate,
            endDate: futureCampDate,
            startTime: "09:00",
            endTime: "17:00",
            capacity: 50,
            status: "published",
            organizer: organizer._id
        });
        createdCampIds.push(testCamp._id);

        // ==========================================
        // FEATURE 1: CAMP REGISTRATION NOTIFICATIONS
        // ==========================================
        console.log("\n--- Feature 1: Camp Registration Notifications ---");

        // 1. Successful registration creates in-app notification
        const regRes = await makeRequest(baseUrl, {
            path: `/camps/${testCamp._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        assert(regRes.status === 201, "1. POST /camps/:id/register succeeds with HTTP 201");

        // Check user A's notifications
        const notifsA = await notificationService.getUserNotifications(donorA._id);
        const regNotif = notifsA.notifications.find((n) => n.type === "camp_registration" && n.title.includes("Confirmed"));
        assert(regNotif !== undefined, "2. Successful registration creates 'camp_registration' notification");
        assert(regNotif && regNotif.metadata && regNotif.metadata.campId === testCamp._id.toString(), "3. Notification metadata contains correct campId");
        assert(regNotif && regNotif.message.includes(testCamp.name), "4. Notification message contains camp name");

        // 2. Failed registration (duplicate registration) does NOT create an extra notification
        const initialNotifCount = notifsA.notifications.length;
        const dupRes = await makeRequest(baseUrl, {
            path: `/camps/${testCamp._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        assert(dupRes.status === 409, "5. Duplicate registration rejected with HTTP 409");
        const afterDupNotifs = await notificationService.getUserNotifications(donorA._id);
        assert(afterDupNotifs.notifications.length === initialNotifCount, "6. Rejected registration creates no additional notifications");

        // 3. Failed registration for ineligible user creates no notification
        const ineligToken = generateToken(ineligibleDonor);
        const ineligRes = await makeRequest(baseUrl, {
            path: `/camps/${testCamp._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${ineligToken}` }
        });
        assert(ineligRes.status === 400, "7. Ineligible registration rejected with HTTP 400");
        const ineligNotifs = await notificationService.getUserNotifications(ineligibleDonor._id);
        assert(ineligNotifs.notifications.length === 0, "8. Ineligible user received 0 notifications");

        // 4. Cancellation creates cancellation notification
        const cancelRes = await makeRequest(baseUrl, {
            path: `/camps/${testCamp._id}/register`,
            method: "DELETE",
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        assert(cancelRes.status === 200, "9. DELETE /camps/:id/register succeeds with HTTP 200");
        const afterCancelNotifs = await notificationService.getUserNotifications(donorA._id);
        const cancelNotif = afterCancelNotifs.notifications.find((n) => n.title.includes("Cancelled"));
        assert(cancelNotif !== undefined, "10. Registration cancellation creates cancellation notification");
        assert(cancelNotif && cancelNotif.type === "camp_registration", "11. Cancellation notification type is 'camp_registration'");

        // 5. Re-registration creates a new confirmed notification
        const reRegRes = await makeRequest(baseUrl, {
            path: `/camps/${testCamp._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        assert(reRegRes.status === 201, "12. Re-registration succeeds with HTTP 201");
        const afterReRegNotifs = await notificationService.getUserNotifications(donorA._id);
        const reRegConfirmed = afterReRegNotifs.notifications.filter((n) => n.title.includes("Confirmed"));
        assert(reRegConfirmed.length === 2, "13. Re-registration generates a new confirmed notification");

        // 6. Organizer camp cancellation notifies registered donors
        const cancelCampRes = await makeRequest(baseUrl, {
            path: `/camps/${testCamp._id}`,
            method: "PUT",
            headers: { Authorization: `Bearer ${tokenOrg}` }
        }, { status: "cancelled" });
        assert(cancelCampRes.status === 200, "14. Organizer cancelled camp (HTTP 200)");
        const notifsAfterCampCancel = await notificationService.getUserNotifications(donorA._id);
        const campCancelledNotif = notifsAfterCampCancel.notifications.find((n) => n.type === "camp_cancellation");
        assert(campCancelledNotif !== undefined, "15. Registered donor received 'camp_cancellation' notification");
        assert(campCancelledNotif && campCancelledNotif.title === "Camp Cancelled", "16. Camp cancellation notification title is 'Camp Cancelled'");

        // ==========================================
        // FEATURE 2: CAMP REMINDER NOTIFICATIONS
        // ==========================================
        console.log("\n--- Feature 2: Camp Reminder Notifications ---");

        // Create a Camp starting within the 24-hour reminder window (e.g. 12 hours from now)
        const reminderCampStart = new Date(Date.now() + 12 * 60 * 60 * 1000);
        const reminderCamp = await camp.create({
            name: "Tomorrow Blood Drive",
            description: "Urgent drive",
            location: {
                address: "Civil Hospital Campus",
                city: "Ahmedabad",
                state: "Gujarat",
                pincode: "380016"
            },
            startDate: reminderCampStart,
            endDate: reminderCampStart,
            startTime: `${String(reminderCampStart.getHours()).padStart(2, "0")}:${String(reminderCampStart.getMinutes()).padStart(2, "0")}`,
            endTime: "18:00",
            capacity: 30,
            status: "published",
            organizer: organizer._id
        });
        createdCampIds.push(reminderCamp._id);

        // Register Donor B for the reminder camp
        const regBRes = await makeRequest(baseUrl, {
            path: `/camps/${reminderCamp._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        assert(regBRes.status === 201, "17. Donor B registered for reminder camp");

        // Register Donor A and then cancel Donor A
        await makeRequest(baseUrl, {
            path: `/camps/${reminderCamp._id}/register`,
            method: "POST",
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        await makeRequest(baseUrl, {
            path: `/camps/${reminderCamp._id}/register`,
            method: "DELETE",
            headers: { Authorization: `Bearer ${tokenA}` }
        });

        // Run camp reminders check
        const remindersCount1 = await notificationScheduler.checkCampReminders();
        assert(remindersCount1 >= 1, "18. Camp reminder job identified upcoming camp and sent reminder");

        // Verify Donor B received the reminder
        const notifsDonorB = await notificationService.getUserNotifications(donorB._id);
        const bReminder = notifsDonorB.notifications.find((n) => n.title === "Camp Reminder");
        assert(bReminder !== undefined, "19. Active registrant (Donor B) received 'Camp Reminder'");
        assert(bReminder && bReminder.type === "camp_update", "20. Reminder notification type is 'camp_update'");
        assert(bReminder && bReminder.metadata.campId === reminderCamp._id.toString(), "21. Reminder metadata includes campId");
        assert(bReminder && bReminder.message.includes("Tomorrow Blood Drive"), "22. Reminder message includes camp name");

        // Verify cancelled Donor A did NOT receive a Camp Reminder for this camp
        const notifsDonorA = await notificationService.getUserNotifications(donorA._id);
        const aReminder = notifsDonorA.notifications.find(
            (n) => n.title === "Camp Reminder" && n.metadata && n.metadata.campId === reminderCamp._id.toString()
        );
        assert(aReminder === undefined, "23. Cancelled registration (Donor A) did NOT receive Camp Reminder");

        // Run camp reminders check AGAIN (Idempotency verification)
        const remindersCount2 = await notificationScheduler.checkCampReminders();
        assert(remindersCount2 === 0, "24. Repeated scheduler execution creates zero duplicate reminders (count is 0)");

        const notifsDonorBSecond = await notificationService.getUserNotifications(donorB._id);
        const bRemindersTotal = notifsDonorBSecond.notifications.filter((n) => n.title === "Camp Reminder");
        assert(bRemindersTotal.length === 1, "25. Donor B has exactly 1 Camp Reminder notification");

        // ==========================================
        // FEATURE 3: BLOOD REQUIREMENT NOTIFICATIONS
        // ==========================================
        console.log("\n--- Feature 3: Blood Requirement Notifications ---");

        // 1. Create a Blood Requirement for O- recipient in Ahmedabad (O- can receive ONLY O-)
        // Donor A is O+ (incompatible with O- recipient), so Donor A must NOT be notified.
        const reqResult1 = await bloodRequestService.createBloodRequirement({
            bloodGroup: "O-",
            unitsNeeded: 2,
            urgency: "urgent",
            location: {
                city: "Ahmedabad",
                coordinates: [72.5714, 23.0225]
            },
            radius: 30000,
            createdBy: organizer._id
        });
        createdRequestIds.push(reqResult1.request._id);
        assert(reqResult1.request.bloodGroup === "O-", "26. BloodRequest created for O- blood group");
        assert(reqResult1.notifiedCount === 0, "27. Incompatible O+ donor was NOT notified for O- request");

        // 2. Create Blood Requirement for A+ recipient in Ahmedabad within 30km
        // Compatible groups for A+: A+, A-, O+, O-.
        // Donor A is O+ in Ahmedabad (~0km away) -> Should be notified!
        // Donor B is A+ in Surat (~200km away) -> Outside 30km radius -> Should NOT be notified!
        // Ineligible donor is O+ in Ahmedabad -> Medically ineligible -> Should NOT be notified!
        // Unavailable donor is O+ in Ahmedabad -> Unavailable -> Should NOT be notified!
        const reqResult2 = await bloodRequestService.createBloodRequirement({
            bloodGroup: "A+",
            unitsNeeded: 3,
            urgency: "critical",
            location: {
                city: "Ahmedabad",
                coordinates: [72.5714, 23.0225]
            },
            radius: 30000, // 30 km
            createdBy: organizer._id
        });
        createdRequestIds.push(reqResult2.request._id);
        assert(reqResult2.notifiedCount >= 1, "28. Matching eligible nearby donor received notification");

        // Check Donor A received blood_match notification
        const notifsAfterMatch = await notificationService.getUserNotifications(donorA._id);
        const bloodNotif = notifsAfterMatch.notifications.find((n) => n.type === "blood_match" && n.metadata.requestId === reqResult2.request._id.toString());
        assert(bloodNotif !== undefined, "29. Donor A received 'blood_match' notification for A+ requirement");
        assert(bloodNotif && bloodNotif.title.includes("Critical"), "30. Critical urgency reflected in notification title");
        assert(bloodNotif && bloodNotif.metadata.bloodGroup === "A+", "31. Metadata contains required bloodGroup 'A+'");
        assert(bloodNotif && bloodNotif.metadata.unitsNeeded === 3, "32. Metadata contains unitsNeeded: 3");

        // Verify Donor B (Surat, 200km away) did not receive notification due to 30km radius
        const notifsDonorBMatches = await notificationService.getUserNotifications(donorB._id);
        const bBloodNotif = notifsDonorBMatches.notifications.find((n) => n.type === "blood_match" && n.metadata.requestId === reqResult2.request._id.toString());
        assert(bBloodNotif === undefined, "33. Distant donor (Donor B in Surat) excluded by geographic radius filter");

        // Verify Ineligible and Unavailable donors received 0 blood notifications
        const ineligBloodNotifs = await notificationService.getUserNotifications(ineligibleDonor._id);
        assert(ineligBloodNotifs.notifications.length === 0, "34. Medically ineligible donor excluded from blood notifications");

        const unavailBloodNotifs = await notificationService.getUserNotifications(unavailableDonor._id);
        assert(unavailBloodNotifs.notifications.length === 0, "35. Unavailable donor excluded from blood notifications");

        // Verify Privacy: Ensure no private PII or passwords leaked
        assert(!JSON.stringify(bloodNotif).includes("password"), "36. Blood requirement notification payload does not contain password");
        assert(!JSON.stringify(bloodNotif).includes(donorA.phone), "37. Private donor phone not exposed in notification payload");

        // 3. Test API endpoint POST /matching/requests
        const apiReqRes = await makeRequest(baseUrl, {
            path: "/matching/requests",
            method: "POST",
            headers: { Authorization: `Bearer ${tokenA}` }
        }, {
            bloodGroup: "O+",
            unitsNeeded: 1,
            urgency: "standard",
            location: { city: "Ahmedabad" }
        });
        assert(apiReqRes.status === 201, "38. POST /matching/requests endpoint returns HTTP 201");
        assert(apiReqRes.body.success === true, "39. API response has success: true");
        createdRequestIds.push(apiReqRes.body.data.request._id);

        // ==========================================
        // FEATURE 4: DONATION REMINDERS
        // ==========================================
        console.log("\n--- Feature 4: Donation Reminders ---");

        // 1. Run eligibility reminder check
        const donationRemindersCount1 = await notificationScheduler.checkDonationEligibilityReminders();
        assert(donationRemindersCount1 >= 1, "40. Donation eligibility reminder job identified eligible donor");

        // Verify cycleDonor (95 days since last donation) received "You're Eligible to Donate Again"
        const notifsCycleDonor = await notificationService.getUserNotifications(cycleDonor._id);
        const cycleNotif = notifsCycleDonor.notifications.find((n) => n.title === "You're Eligible to Donate Again");
        assert(cycleNotif !== undefined, "41. Eligible donor (90+ days) received 'You're Eligible to Donate Again' notification");
        assert(cycleNotif && cycleNotif.type === "system", "42. Donation reminder type is 'system'");

        // Verify recentDonor (only 10 days since donation) did NOT receive eligible reminder
        const notifsRecentDonor = await notificationService.getUserNotifications(recentDonor._id);
        const recentNotif = notifsRecentDonor.notifications.find((n) => n.title === "You're Eligible to Donate Again");
        assert(recentNotif === undefined, "43. Ineligible recent donor did NOT receive 'You're Eligible to Donate Again'");

        // Verify donor record was NOT modified by notification logic
        const unchangedDonor = await user.findById(cycleDonor._id);
        assert(unchangedDonor.lastDonationDate.getTime() === ninetyDaysAgo.getTime(), "44. lastDonationDate was NOT modified by notification logic");
        assert(unchangedDonor.isEligible === true, "45. isEligible was NOT modified by notification logic");

        // 2. Idempotency: Run donation reminder check AGAIN
        const donationRemindersCount2 = await notificationScheduler.checkDonationEligibilityReminders();
        assert(donationRemindersCount2 === 0, "46. Repeated execution creates zero duplicate donation reminders (count is 0)");

        const notifsCycleDonorSecond = await notificationService.getUserNotifications(cycleDonor._id);
        const cycleNotifsTotal = notifsCycleDonorSecond.notifications.filter((n) => n.title === "You're Eligible to Donate Again");
        assert(cycleNotifsTotal.length === 1, "47. Donor has exactly 1 eligibility reminder for this donation cycle");

        // ==========================================
        // SCHEDULER: CRASH RESILIENCE & RUNALLJOBS
        // ==========================================
        console.log("\n--- Scheduler Lifecycle & Resilience ---");

        // runAllJobs executes safely
        const allJobsResult = await notificationScheduler.runAllJobs();
        assert(allJobsResult && typeof allJobsResult.campReminders === "number", "48. runAllJobs executes both jobs and returns result");

        // startScheduler and stopScheduler work safely
        notificationScheduler.startScheduler({ intervalMs: 100000 });
        assert(notificationScheduler.isSchedulerRunning() === true, "49. notificationScheduler.startScheduler() starts background interval");
        notificationScheduler.stopScheduler();
        assert(notificationScheduler.isSchedulerRunning() === false, "50. notificationScheduler.stopScheduler() cleans up interval");

    } finally {
        console.log("\n--- Cleaning up test artifacts ---");
        notificationScheduler.stopScheduler();
        server.close();

        if (createdCampIds.length > 0) {
            await camp.deleteMany({ _id: { $in: createdCampIds } });
            await campRegistration.deleteMany({ camp: { $in: createdCampIds } });
        }
        if (createdRequestIds.length > 0) {
            await bloodRequest.deleteMany({ _id: { $in: createdRequestIds } });
        }
        if (createdUserIds.length > 0) {
            await user.deleteMany({ _id: { $in: createdUserIds } });
            await notification.deleteMany({ user: { $in: createdUserIds } });
        }
        console.log("Cleanup complete");
        await mongoose.connection.close();
    }

    console.log(`\n=== Test Results: ${passedCount} Passed, ${failedCount} Failed ===`);
    process.exit(failedCount > 0 ? 1 : 0);
}

runTests().catch(async (err) => {
    console.error("Test suite fatal error:", err);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
});

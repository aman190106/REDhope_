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
const notification = require("c:/REDhope/REDhope/server/models/notification");
const notificationService = require("c:/REDhope/REDhope/server/services/notificationService");
const notificationRoutes = require("c:/REDhope/REDhope/server/routes/notificationRoutes");

const app = express();
app.use(express.json());
app.use("/notifications", notificationRoutes);

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
    console.log("=== Starting In-App Notification System Test Suite ===");

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

    const testTimestamp = Date.now();
    const createdUserIds = [];
    const createdNotificationIds = [];

    async function createTestUser(role = "user", overrides = {}) {
        const unique = `${testTimestamp}_${Math.floor(Math.random() * 1000000)}`;
        const userData = {
            name: `User ${unique}`,
            email: `user_${unique}@example.com`,
            password: "hashedPassword123!",
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            bloodGroup: "O+",
            role,
            dateOfBirth: new Date("1995-05-15"),
            isDonorAvailable: true,
            isEligible: true,
            ...overrides
        };
        const u = await user.create(userData);
        createdUserIds.push(u._id);
        return u;
    }

    try {
        const userA = await createTestUser("user", { name: "User Alice" });
        const tokenA = generateToken(userA);

        const userB = await createTestUser("user", { name: "User Bob" });
        const tokenB = generateToken(userB);

        // ─────────────────────────────────────────────
        // 1. Model / Creation Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 1: Model & Service Creation ---");

        // 1. Notification can be created via internal service
        const notif1 = await notificationService.createNotification({
            userId: userA._id,
            type: "system",
            title: "Welcome to REDhope",
            message: "Thank you for joining our life-saving community.",
            metadata: { welcomeBonus: true }
        });
        createdNotificationIds.push(notif1._id);

        assert(notif1 && notif1._id, "1. Notification created successfully");

        // 2. Default isRead is false
        assert(notif1.isRead === false, "2. Default isRead is false");

        // 3. Timestamps exist
        assert(!!notif1.createdAt && !!notif1.updatedAt, "3. Timestamps createdAt and updatedAt exist");

        // 4. Valid notification types accepted
        const validTypes = ["blood_match", "camp_registration", "camp_update", "camp_cancellation", "system"];
        for (const t of validTypes) {
            const n = await notificationService.createNotification({
                userId: userA._id,
                type: t,
                title: `Test ${t}`,
                message: `Testing type ${t}`
            });
            createdNotificationIds.push(n._id);
            assert(n.type === t, `4. Valid type '${t}' accepted`);
        }

        // 5. Invalid notification type rejected
        let invalidTypeCaught = false;
        try {
            await notificationService.createNotification({
                userId: userA._id,
                type: "invalid_type",
                title: "Invalid",
                message: "Should fail"
            });
        } catch (err) {
            invalidTypeCaught = true;
            assert(err.message.includes("invalid notification type"), "5. Invalid notification type rejected with error");
        }
        assert(invalidTypeCaught, "5b. Service throws on invalid notification type");

        // ─────────────────────────────────────────────
        // 2. Authorization & Isolation Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 2: Authorization & Isolation ---");

        // 6. Unauthenticated GET /notifications returns 401
        const unauthRes = await makeRequest("GET", "/notifications");
        assert(unauthRes.status === 401, "6. Unauthenticated GET /notifications returns 401");
        assert(unauthRes.data.success === false, "6b. 401 response has success: false");

        // 7. Authenticated user can view own notifications
        const listResA = await makeRequest("GET", "/notifications", {
            Authorization: `Bearer ${tokenA}`
        });
        assert(listResA.status === 200, "7. Authenticated user can view own notifications (HTTP 200)");
        assert(listResA.data.success === true, "7b. Response has success: true");

        // Create notification for User B
        const notifB = await notificationService.createNotification({
            userId: userB._id,
            type: "camp_registration",
            title: "Camp Confirmed",
            message: "You are registered for Ahmedabad Blood Camp."
        });
        createdNotificationIds.push(notifB._id);

        // 8. User A cannot view User B's notification
        const userANotifIds = listResA.data.data.notifications.map((n) => n._id);
        assert(!userANotifIds.includes(notifB._id.toString()), "8. User A cannot view User B's notifications");

        // 9. User A cannot modify User B's notification
        const modRes = await makeRequest("PATCH", `/notifications/${notifB._id}/read`, {
            Authorization: `Bearer ${tokenA}`
        });
        assert(modRes.status === 404, "9. User A modifying User B's notification returns 404 (safe isolation)");

        // 10. User A cannot delete User B's notification
        const delRes = await makeRequest("DELETE", `/notifications/${notifB._id}`, {
            Authorization: `Bearer ${tokenA}`
        });
        assert(delRes.status === 404, "10. User A deleting User B's notification returns 404 (safe isolation)");

        // ─────────────────────────────────────────────
        // 3. Pagination Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 3: Pagination ---");

        // Create additional notifications for User A to test pagination
        for (let i = 1; i <= 5; i++) {
            const extra = await notificationService.createNotification({
                userId: userA._id,
                type: "system",
                title: `System Alert ${i}`,
                message: `Numbered alert message ${i}`
            });
            createdNotificationIds.push(extra._id);
        }

        // 11. Notifications returned newest first
        const pageRes = await makeRequest("GET", "/notifications?page=1&limit=3", {
            Authorization: `Bearer ${tokenA}`
        });
        assert(pageRes.status === 200, "Pagination query returns 200");
        const notifs = pageRes.data.data.notifications;
        assert(notifs.length === 3, "Page 1 limit 3 returns 3 notifications");

        const isNewestFirst = new Date(notifs[0].createdAt) >= new Date(notifs[1].createdAt) &&
                              new Date(notifs[1].createdAt) >= new Date(notifs[2].createdAt);
        assert(isNewestFirst, "11. Notifications returned newest first");

        // 12. Pagination metadata works
        assert(pageRes.data.data.pagination.page === 1, "12a. Pagination page is 1");
        assert(pageRes.data.data.pagination.limit === 3, "12b. Pagination limit is 3");
        assert(pageRes.data.data.pagination.total >= 6, "12c. Pagination total reflects all User A notifications");
        assert(pageRes.data.data.pagination.totalPages >= 2, "12d. Pagination totalPages is calculated correctly");

        // Page 2 query
        const page2Res = await makeRequest("GET", "/notifications?page=2&limit=3", {
            Authorization: `Bearer ${tokenA}`
        });
        const notifsPage2 = page2Res.data.data.notifications;
        assert(notifsPage2.length === 3, "Page 2 returns 3 notifications");
        assert(notifsPage2[0]._id !== notifs[0]._id, "Page 2 notifications differ from Page 1");

        // 13. Maximum limit enforced (capped at 100)
        const excessiveLimitRes = await makeRequest("GET", "/notifications?limit=250", {
            Authorization: `Bearer ${tokenA}`
        });
        assert(excessiveLimitRes.data.data.pagination.limit === 100, "13. Maximum page limit capped at 100");

        // ─────────────────────────────────────────────
        // 4. Unread Count & State Transition Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 4: Unread Count & State Transitions ---");

        // 14. Unread count correct
        const unreadCountRes1 = await makeRequest("GET", "/notifications/unread-count", {
            Authorization: `Bearer ${tokenA}`
        });
        assert(unreadCountRes1.status === 200, "GET /notifications/unread-count returns 200");
        const initialUnreadA = unreadCountRes1.data.data.count;
        assert(initialUnreadA > 0, `14. Initial unread count for User A is ${initialUnreadA}`);

        // 15. Marking one notification as read works
        const targetNotif = notifs[0];
        const markRes = await makeRequest("PATCH", `/notifications/${targetNotif._id}/read`, {
            Authorization: `Bearer ${tokenA}`
        });
        assert(markRes.status === 200, "15. PATCH /notifications/:id/read returns 200");
        assert(markRes.data.notification.isRead === true, "15b. Notification isRead updated to true");

        // 16. Unread count decreases
        const unreadCountRes2 = await makeRequest("GET", "/notifications/unread-count", {
            Authorization: `Bearer ${tokenA}`
        });
        assert(
            unreadCountRes2.data.data.count === initialUnreadA - 1,
            `16. Unread count decreased by 1 (now ${unreadCountRes2.data.data.count})`
        );

        // 18. Already-read notification remains read (idempotency)
        const reMarkRes = await makeRequest("PATCH", `/notifications/${targetNotif._id}/read`, {
            Authorization: `Bearer ${tokenA}`
        });
        assert(reMarkRes.status === 200, "18a. Re-marking already read notification returns 200");
        assert(reMarkRes.data.notification.isRead === true, "18b. Remains read without error");

        // 17. Mark all read works
        const markAllRes = await makeRequest("PATCH", "/notifications/read-all", {
            Authorization: `Bearer ${tokenA}`
        });
        assert(markAllRes.status === 200, "17a. PATCH /notifications/read-all returns 200");
        assert(markAllRes.data.data.modifiedCount > 0, `17b. Modified count returned (${markAllRes.data.data.modifiedCount})`);

        const unreadCountRes3 = await makeRequest("GET", "/notifications/unread-count", {
            Authorization: `Bearer ${tokenA}`
        });
        assert(unreadCountRes3.data.data.count === 0, "17c. Unread count is now 0 after mark-all-read");

        // User B's unread notification was untouched by User A's mark-all-read
        const unreadCountResB = await makeRequest("GET", "/notifications/unread-count", {
            Authorization: `Bearer ${tokenB}`
        });
        assert(unreadCountResB.data.data.count === 1, "17d. User B's unread notifications remain untouched");

        // ─────────────────────────────────────────────
        // 5. Deletion Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 5: Deletion ---");

        // 19. User can delete own notification
        const deleteRes = await makeRequest("DELETE", `/notifications/${targetNotif._id}`, {
            Authorization: `Bearer ${tokenA}`
        });
        assert(deleteRes.status === 200, "19. DELETE /notifications/:id returns 200");
        assert(deleteRes.data.success === true, "19b. Delete response has success: true");

        // 20. Deleted notification no longer appears
        const checkListRes = await makeRequest("GET", "/notifications", {
            Authorization: `Bearer ${tokenA}`
        });
        const remainingIds = checkListRes.data.data.notifications.map((n) => n._id);
        assert(!remainingIds.includes(targetNotif._id.toString()), "20. Deleted notification no longer appears in user's list");

        // Second delete returns 404
        const secondDel = await makeRequest("DELETE", `/notifications/${targetNotif._id}`, {
            Authorization: `Bearer ${tokenA}`
        });
        assert(secondDel.status === 404, "20b. Deleting already-deleted notification returns 404");

        // ─────────────────────────────────────────────
        // 6. Privacy & Security Tests
        // ─────────────────────────────────────────────
        console.log("\n--- Group 6: Privacy & Security ---");

        const fullJson = JSON.stringify(checkListRes.data);

        // 21. No password in response
        assert(!fullJson.includes("password"), "21. Notification payload contains no 'password'");

        // 22. No JWT / auth token leakage
        assert(!fullJson.includes("jwt") && !fullJson.includes("token"), "22. Notification payload contains no auth tokens");

        // 23. Metadata does not expose unauthorized private information
        assert(!fullJson.includes(userA.email) && !fullJson.includes(userA.phone), "23. Private user email and phone not leaked in notification listing");

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        console.log("\n--- Cleaning up test artifacts ---");
        try {
            if (createdNotificationIds.length > 0) {
                await notification.deleteMany({ _id: { $in: createdNotificationIds } });
            }
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


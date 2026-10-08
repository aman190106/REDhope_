const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    getNotifications,
    getUnreadNotificationCount,
    markRead,
    markAllRead,
    removeNotification
} = require("../controllers/notificationController");

// All notification routes are strictly user-protected
router.get("/", authMiddleware, getNotifications);
router.get("/unread-count", authMiddleware, getUnreadNotificationCount);
router.patch("/read-all", authMiddleware, markAllRead);
router.patch("/:id/read", authMiddleware, markRead);
router.delete("/:id", authMiddleware, removeNotification);

module.exports = router;


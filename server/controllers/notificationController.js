/**
 * REDhope Notification Controller
 * 
 * Exposes protected endpoints for querying, reading, and managing user notifications.
 */

const mongoose = require("mongoose");
const {
    getUserNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification
} = require("../services/notificationService");

/**
 * GET /notifications
 * Fetches paginated notifications for the authenticated user (newest first).
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page, limit } = req.query;

        const data = await getUserNotifications(userId, { page, limit });

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        console.error("getNotifications error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /notifications/unread-count
 * Returns the unread notification count for the authenticated user.
 */
const getUnreadNotificationCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await getUnreadCount(userId);

        return res.status(200).json({
            success: true,
            data: {
                count
            }
        });

    } catch (error) {
        console.error("getUnreadNotificationCount error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * PATCH /notifications/:id/read
 * Marks a single notification as read if owned by the authenticated user.
 */
const markRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid notification ID"
            });
        }

        const updated = await markNotificationRead(userId, id);
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "notification not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "notification marked as read",
            notification: updated
        });

    } catch (error) {
        console.error("markRead error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * PATCH /notifications/read-all
 * Marks all unread notifications of the authenticated user as read.
 */
const markAllRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const modifiedCount = await markAllNotificationsRead(userId);

        return res.status(200).json({
            success: true,
            message: "all notifications marked as read",
            data: {
                modifiedCount
            }
        });

    } catch (error) {
        console.error("markAllRead error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * DELETE /notifications/:id
 * Deletes a single notification owned by the authenticated user.
 */
const removeNotification = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid notification ID"
            });
        }

        const deleted = await deleteNotification(userId, id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "notification not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "notification deleted successfully"
        });

    } catch (error) {
        console.error("removeNotification error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadNotificationCount,
    markRead,
    markAllRead,
    removeNotification
};


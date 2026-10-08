/**
 * REDhope Notification Service
 * 
 * Centralized internal service for creating, querying, updating, and managing
 * user-specific in-app notifications.
 * 
 * Strictly isolates notifications by user ownership.
 */

const mongoose = require("mongoose");
const notification = require("../models/notification");
const { VALID_NOTIFICATION_TYPES } = notification;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Creates a notification for a specific user.
 * Called only by internal system events and services.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - Target recipient user ID
 * @param {string} params.type - Notification type enum
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {Object} [params.metadata] - Optional arbitrary metadata (must not contain sensitive PII)
 * @param {string} [params.eventKey] - Optional deterministic key to prevent duplicate notifications
 * @returns {Promise<Object>} Created notification document
 */
async function createNotification({ userId, type, title, message, metadata = {}, eventKey = null }) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error("valid userId is required");
        err.statusCode = 400;
        throw err;
    }

    if (!type || !VALID_NOTIFICATION_TYPES.includes(type)) {
        const err = new Error(`invalid notification type '${type}'`);
        err.statusCode = 400;
        throw err;
    }

    if (!title || typeof title !== "string" || !title.trim()) {
        const err = new Error("title is required");
        err.statusCode = 400;
        throw err;
    }

    if (!message || typeof message !== "string" || !message.trim()) {
        const err = new Error("message is required");
        err.statusCode = 400;
        throw err;
    }

    const effectiveEventKey = eventKey || (metadata && metadata.eventKey) || undefined;

    // Idempotency: If a deterministic eventKey was provided, check if already sent to this user
    if (effectiveEventKey) {
        const existing = await notification.findOne({
            user: userId,
            eventKey: effectiveEventKey
        });
        if (existing) {
            return existing;
        }
    }

    try {
        const docToCreate = {
            user: userId,
            type,
            title: title.trim(),
            message: message.trim(),
            metadata: metadata || {},
            isRead: false
        };

        if (effectiveEventKey) {
            docToCreate.eventKey = effectiveEventKey;
        }

        const newNotification = await notification.create(docToCreate);

        // Attempt asynchronous email notification (fire-and-forget; never breaks in-app notifications)
        try {
            const { deliverNotificationEmail } = require("./notificationDeliveryService");
            deliverNotificationEmail({
                user: userId,
                type,
                title: docToCreate.title,
                message: docToCreate.message,
                metadata: docToCreate.metadata,
                notificationId: newNotification._id ? newNotification._id.toString() : null,
                eventKey: effectiveEventKey
            }).catch((emailErr) => {
                console.error(`Email delivery error for notification ${newNotification._id}:`, emailErr.message);
            });
        } catch (dispatchErr) {
            console.error("Failed to initiate email delivery:", dispatchErr.message);
        }

        return newNotification;
    } catch (createError) {
        // Handle race conditions on the unique index gracefully
        if (createError.code === 11000 && effectiveEventKey) {
            const existing = await notification.findOne({
                user: userId,
                eventKey: effectiveEventKey
            });
            if (existing) {
                return existing;
            }
        }
        throw createError;
    }
}

/**
 * Fetches paginated notifications for the authenticated user, sorted newest first.
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<Object>} Notifications list and pagination metadata
 */
async function getUserNotifications(userId, { page = 1, limit = DEFAULT_LIMIT } = {}) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error("valid userId is required");
        err.statusCode = 400;
        throw err;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
    const skip = (pageNum - 1) * limitNum;

    const query = { user: userId };

    const [notifications, total] = await Promise.all([
        notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        notification.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum) || 0;

    return {
        notifications,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages
        }
    };
}

/**
 * Retrieves the count of unread notifications for a user.
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<number>} Count of unread notifications
 */
async function getUnreadCount(userId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error("valid userId is required");
        err.statusCode = 400;
        throw err;
    }

    const count = await notification.countDocuments({
        user: userId,
        isRead: false
    });

    return count;
}

/**
 * Marks a single notification as read if owned by the user.
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} notificationId
 * @returns {Promise<Object|null>} Updated notification or null if not found
 */
async function markNotificationRead(userId, notificationId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error("valid userId is required");
        err.statusCode = 400;
        throw err;
    }

    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
        const err = new Error("invalid notification ID");
        err.statusCode = 400;
        throw err;
    }

    const found = await notification.findOne({
        _id: notificationId,
        user: userId
    });

    if (!found) {
        return null;
    }

    if (!found.isRead) {
        found.isRead = true;
        await found.save();
    }

    return found;
}

/**
 * Marks all unread notifications belonging to the user as read.
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<number>} Number of modified notifications
 */
async function markAllNotificationsRead(userId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error("valid userId is required");
        err.statusCode = 400;
        throw err;
    }

    const result = await notification.updateMany(
        { user: userId, isRead: false },
        { $set: { isRead: true } }
    );

    return result.modifiedCount;
}

/**
 * Deletes a notification belonging to the user.
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} notificationId
 * @returns {Promise<Object|null>} Deleted notification or null if not found
 */
async function deleteNotification(userId, notificationId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error("valid userId is required");
        err.statusCode = 400;
        throw err;
    }

    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
        const err = new Error("invalid notification ID");
        err.statusCode = 400;
        throw err;
    }

    const deleted = await notification.findOneAndDelete({
        _id: notificationId,
        user: userId
    });

    return deleted;
}

module.exports = {
    createNotification,
    getUserNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    DEFAULT_LIMIT,
    MAX_LIMIT
};


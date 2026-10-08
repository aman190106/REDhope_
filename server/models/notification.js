const mongoose = require("mongoose");

const VALID_NOTIFICATION_TYPES = [
    "blood_match",
    "camp_registration",
    "camp_update",
    "camp_cancellation",
    "system"
];

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "user is required"]
    },

    type: {
        type: String,
        required: [true, "notification type is required"],
        enum: {
            values: VALID_NOTIFICATION_TYPES,
            message: "invalid notification type"
        }
    },

    title: {
        type: String,
        required: [true, "notification title is required"],
        trim: true,
        maxlength: [200, "title cannot exceed 200 characters"]
    },

    message: {
        type: String,
        required: [true, "notification message is required"],
        trim: true,
        maxlength: [1000, "message cannot exceed 1000 characters"]
    },

    isRead: {
        type: Boolean,
        default: false
    },

    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    eventKey: {
        type: String,
        trim: true
    }

}, {
    timestamps: true
});

// Compound indexes for user notification queries and unread counting
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// Partial unique compound index to guarantee idempotency and avoid duplicate keyed events
notificationSchema.index(
    { user: 1, eventKey: 1 },
    { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } }
);

const notification = mongoose.model("notification", notificationSchema);

module.exports = notification;
module.exports.VALID_NOTIFICATION_TYPES = VALID_NOTIFICATION_TYPES;


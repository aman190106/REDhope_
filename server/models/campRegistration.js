const mongoose = require("mongoose");

const VALID_STATUSES = ["registered", "cancelled"];

const campRegistrationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "user reference is required"]
    },

    camp: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "camp",
        required: [true, "camp reference is required"]
    },

    status: {
        type: String,
        enum: {
            values: VALID_STATUSES,
            message: "invalid registration status"
        },
        default: "registered"
    },

    registeredAt: {
        type: Date,
        default: Date.now
    },

    cancelledAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Compound unique index to prevent duplicate records for the same user and camp
campRegistrationSchema.index({ user: 1, camp: 1 }, { unique: true });

// Secondary indexes for queries by camp and user status
campRegistrationSchema.index({ camp: 1, status: 1 });
campRegistrationSchema.index({ user: 1, status: 1 });

const campRegistration = mongoose.model("campRegistration", campRegistrationSchema);

module.exports = campRegistration;


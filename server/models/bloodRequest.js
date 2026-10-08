const mongoose = require("mongoose");
const { VALID_BLOOD_GROUPS } = require("../rules/bloodCompatibilityRules");

const bloodRequestSchema = new mongoose.Schema({
    bloodGroup: {
        type: String,
        required: [true, "bloodGroup is required"],
        enum: {
            values: VALID_BLOOD_GROUPS,
            message: "invalid blood group"
        }
    },

    unitsNeeded: {
        type: Number,
        default: 1,
        min: [1, "unitsNeeded must be at least 1"]
    },

    urgency: {
        type: String,
        enum: ["standard", "urgent", "critical"],
        default: "urgent"
    },

    location: {
        address: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: undefined
        }
    },

    radius: {
        type: Number, // Search radius in meters
        default: 25000,
        min: [1, "radius must be positive"],
        max: [500000, "radius cannot exceed 500km"]
    },

    status: {
        type: String,
        enum: ["active", "fulfilled", "cancelled"],
        default: "active"
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "createdBy is required"]
    },

    expiresAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for active queries and user requests
bloodRequestSchema.index({ status: 1, createdAt: -1 });
bloodRequestSchema.index({ createdBy: 1, createdAt: -1 });

const bloodRequest = mongoose.model("bloodRequest", bloodRequestSchema);

module.exports = bloodRequest;


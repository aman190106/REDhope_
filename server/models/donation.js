const mongoose = require("mongoose");

const VALID_DONATION_STATUSES = ["scheduled", "completed", "cancelled", "no_show"];
const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const donationSchema = new mongoose.Schema({
    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "donor reference is required"]
    },

    camp: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "camp",
        required: [true, "camp reference is required"]
    },

    registration: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "campRegistration",
        required: [true, "camp registration reference is required"]
    },

    donationDate: {
        type: Date,
        default: Date.now,
        validate: {
            validator: function(val) {
                if (!val) return false;
                const d = new Date(val);
                if (isNaN(d.getTime())) return false;
                // Allow past dates and reasonable future dates (up to 1 year for scheduled test camps)
                const maxFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
                return d <= maxFuture;
            },
            message: "donationDate cannot be more than 1 year in the future"
        }
    },

    units: {
        type: Number,
        default: 1,
        min: [1, "units must be at least 1"],
        validate: {
            validator: function(val) {
                return typeof val === "number" && Number.isInteger(val) && val >= 1;
            },
            message: "units must be a positive integer >= 1"
        }
    },

    bloodGroup: {
        type: String,
        required: [true, "blood group snapshot is required"],
        enum: {
            values: VALID_BLOOD_GROUPS,
            message: "invalid blood group snapshot"
        },
        uppercase: true,
        trim: true
    },

    status: {
        type: String,
        enum: {
            values: VALID_DONATION_STATUSES,
            message: "invalid donation status"
        },
        default: "scheduled"
    },

    notes: {
        type: String,
        trim: true,
        maxlength: [500, "notes cannot exceed 500 characters"],
        default: ""
    },

    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "recordedBy reference is required"]
    },

    verifiedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

// Enforce one donation record per camp registration at the database level
donationSchema.index({ registration: 1 }, { unique: true });

// Secondary indexes for queries by donor, camp, and status
donationSchema.index({ donor: 1, donationDate: -1 });
donationSchema.index({ donor: 1, status: 1 });
donationSchema.index({ camp: 1, status: 1, donationDate: -1 });
donationSchema.index({ camp: 1, donationDate: -1 });

const donation = mongoose.model("donation", donationSchema);

module.exports = donation;
module.exports.VALID_DONATION_STATUSES = VALID_DONATION_STATUSES;
module.exports.VALID_BLOOD_GROUPS = VALID_BLOOD_GROUPS;


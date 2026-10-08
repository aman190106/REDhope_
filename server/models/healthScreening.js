const mongoose = require("mongoose");

const VALID_SCREENING_STATUSES = [
    "draft",
    "submitted",
    "under_review",
    "needs_information",
    "approved",
    "temporarily_deferred",
    "permanently_deferred",
    "rejected"
];

const VALID_REVIEW_DECISIONS = [
    "approved",
    "temporarily_deferred",
    "permanently_deferred",
    "needs_information"
];

const healthScreeningSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "user reference is required"],
        index: true
    },

    status: {
        type: String,
        enum: {
            values: VALID_SCREENING_STATUSES,
            message: "invalid health screening status"
        },
        default: "draft",
        index: true
    },

    // Structured Health Questionnaire
    questionnaire: {
        generalHealth: {
            feelWell: { type: Boolean, default: null },
            hasFeverOrIllness: { type: Boolean, default: null },
            recoveredRecently: { type: Boolean, default: null },
            recentIllnessDetails: { type: String, trim: true, default: "" }
        },

        medicalHistory: {
            chronicCondition: { type: Boolean, default: null },
            chronicConditionDetails: { type: String, trim: true, default: "" },
            recentSurgery: { type: Boolean, default: null },
            recentSurgeryDetails: { type: String, trim: true, default: "" },
            underTreatment: { type: Boolean, default: null },
            underTreatmentDetails: { type: String, trim: true, default: "" }
        },

        medication: {
            takingMedication: { type: Boolean, default: null },
            medicationDetails: { type: String, trim: true, default: "" }
        },

        donationHistory: {
            donatedBefore: { type: Boolean, default: null },
            lastDonationDate: { type: Date, default: null },
            adverseReactionHistory: { type: Boolean, default: null },
            reactionDetails: { type: String, trim: true, default: "" }
        },

        recentProcedures: {
            recentTattooOrPiercing: { type: Boolean, default: null },
            recentTransfusion: { type: Boolean, default: null },
            procedureDetails: { type: String, trim: true, default: "" }
        },

        travelExposure: {
            highRiskTravel: { type: Boolean, default: null },
            travelDetails: { type: String, trim: true, default: "" }
        },

        pregnancyRelated: {
            isApplicable: { type: Boolean, default: false },
            currentlyPregnant: { type: Boolean, default: false },
            breastfeeding: { type: Boolean, default: false },
            recentDelivery: { type: Boolean, default: false }
        },

        measurements: {
            weightKg: { type: Number, default: null },
            recentHemoglobin: { type: Number, default: null },
            bloodPressureSystolic: { type: Number, default: null },
            bloodPressureDiastolic: { type: Number, default: null },
            pulseRate: { type: Number, default: null }
        },

        infectionRisk: {
            hepatitisOrJaundiceHistory: { type: Boolean, default: null },
            hivRiskExposure: { type: Boolean, default: null },
            otherInfectionRisk: { type: Boolean, default: null },
            infectionRiskDetails: { type: String, trim: true, default: "" }
        }
    },

    // Automated preliminary review flags (transparent pointers for human reviewer)
    preliminaryFlags: [{
        code: { type: String, required: true },
        severity: { type: String, enum: ["info", "review", "warning"], default: "review" },
        message: { type: String, required: true },
        category: { type: String, required: true }
    }],

    // Medical Reviewer Decision (Human Authority)
    reviewerDecision: {
        decision: {
            type: String,
            enum: {
                values: VALID_REVIEW_DECISIONS,
                message: "invalid reviewer decision"
            },
            default: null
        },
        reason: { type: String, trim: true, default: null },
        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null
        },
        reviewedAt: { type: Date, default: null },
        deferredUntil: { type: Date, default: null }
    },

    consentGiven: {
        type: Boolean,
        default: false,
        required: true
    },

    consentTimestamp: {
        type: Date,
        default: null
    },

    submittedAt: {
        type: Date,
        default: null,
        index: true
    }
}, {
    timestamps: true
});

// Compound index to quickly find user's latest screening
healthScreeningSchema.index({ user: 1, createdAt: -1 });
healthScreeningSchema.index({ status: 1, submittedAt: -1 });

const HealthScreening = mongoose.model("HealthScreening", healthScreeningSchema);

module.exports = HealthScreening;
module.exports.VALID_SCREENING_STATUSES = VALID_SCREENING_STATUSES;
module.exports.VALID_REVIEW_DECISIONS = VALID_REVIEW_DECISIONS;


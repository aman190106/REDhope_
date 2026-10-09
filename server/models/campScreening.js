const mongoose = require("mongoose");

const VALID_CAMP_SCREENING_DECISIONS = [
    "pending",
    "approved",
    "temporarily_deferred",
    "needs_medical_review",
    "rejected"
];

const campScreeningSchema = new mongoose.Schema({
    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "donor user reference is required"],
        index: true
    },

    camp: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "camp",
        required: [true, "camp reference is required"],
        index: true
    },

    registration: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "campRegistration",
        required: [true, "camp registration reference is required"],
        unique: true,
        index: true
    },

    // Manual camp-specific screening questionnaire (completed by organizer)
    questionnaire: {
        appearsWell: { type: Boolean, default: null },
        currentIllnessFever: { type: Boolean, default: null },
        recentMedicationTreatment: { type: Boolean, default: null },
        recentSurgeryProcedure: { type: Boolean, default: null },
        previousAdverseReaction: { type: Boolean, default: null },
        relevantMedicalCondition: { type: Boolean, default: null },
        basicMeasurementsChecked: { type: Boolean, default: null },
        hemoglobin: { type: Number, default: null },
        bloodPressureSystolic: { type: Number, default: null },
        bloodPressureDiastolic: { type: Number, default: null },
        pulse: { type: Number, default: null }
    },

    observations: {
        type: String,
        trim: true,
        default: ""
    },

    reviewedDocuments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "MedicalDocument"
    }],

    decision: {
        type: String,
        enum: {
            values: VALID_CAMP_SCREENING_DECISIONS,
            message: "invalid camp screening decision"
        },
        default: "pending",
        index: true
    },

    decisionReason: {
        type: String,
        trim: true,
        default: null
    },

    screenedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null
    },

    screenedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Compound index on donor and camp
campScreeningSchema.index({ donor: 1, camp: 1 });
campScreeningSchema.index({ camp: 1, decision: 1 });

const CampScreening = mongoose.model("CampScreening", campScreeningSchema);

module.exports = CampScreening;
module.exports.VALID_CAMP_SCREENING_DECISIONS = VALID_CAMP_SCREENING_DECISIONS;


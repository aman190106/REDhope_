const mongoose = require("mongoose");

const VALID_AUDIT_ACTIONS = [
    "MEDICAL_DOCUMENT_UPLOADED",
    "MEDICAL_DOCUMENT_VIEWED",
    "MEDICAL_DOCUMENT_DOWNLOADED",
    "MEDICAL_DOCUMENT_DELETED",
    "SCREENING_CREATED",
    "SCREENING_SUBMITTED",
    "SCREENING_REVIEWED",
    "SCREENING_STATUS_CHANGED",
    "ORGANIZER_SCREENING_VIEWED",
    "MEDICAL_DOCUMENT_VIEWED_BY_ORGANIZER",
    "MEDICAL_DOCUMENT_DOWNLOADED_BY_ORGANIZER",
    "CAMP_SCREENING_CREATED",
    "CAMP_SCREENING_UPDATED",
    "CAMP_SCREENING_DECISION_RECORDED"
];

const medicalAuditLogSchema = new mongoose.Schema({
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "actor user reference is required"],
        index: true
    },

    actorRole: {
        type: String,
        required: [true, "actor role is required"]
    },

    action: {
        type: String,
        enum: {
            values: VALID_AUDIT_ACTIONS,
            message: "invalid medical audit action"
        },
        required: [true, "action is required"],
        index: true
    },

    resourceType: {
        type: String,
        enum: ["HealthScreening", "MedicalDocument", "CampScreening"],
        required: true
    },

    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
        index: true
    },

    camp: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "camp",
        default: null,
        index: true
    },

    registration: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "campRegistration",
        default: null,
        index: true
    },

    // Non-sensitive operational metadata only. Never store medical questionnaire answers or file contents!
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    ipAddress: {
        type: String,
        default: null
    },

    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

const MedicalAuditLog = mongoose.model("MedicalAuditLog", medicalAuditLogSchema);

module.exports = MedicalAuditLog;
module.exports.VALID_AUDIT_ACTIONS = VALID_AUDIT_ACTIONS;


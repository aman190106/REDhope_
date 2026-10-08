const mongoose = require("mongoose");

const VALID_AUDIT_ACTIONS = [
    "MEDICAL_DOCUMENT_UPLOADED",
    "MEDICAL_DOCUMENT_VIEWED",
    "MEDICAL_DOCUMENT_DOWNLOADED",
    "MEDICAL_DOCUMENT_DELETED",
    "SCREENING_CREATED",
    "SCREENING_SUBMITTED",
    "SCREENING_REVIEWED",
    "SCREENING_STATUS_CHANGED"
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
        enum: ["HealthScreening", "MedicalDocument"],
        required: true
    },

    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
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


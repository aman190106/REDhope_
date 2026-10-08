const mongoose = require("mongoose");

const VALID_DOCUMENT_TYPES = [
    "blood_report",
    "hemoglobin_report",
    "medical_certificate",
    "fitness_certificate",
    "other"
];

const VALID_DOCUMENT_STATUSES = [
    "uploaded",
    "reviewed",
    "archived",
    "rejected"
];

const medicalDocumentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "user reference is required"],
        index: true
    },

    screening: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HealthScreening",
        required: [true, "health screening reference is required"],
        index: true
    },

    documentType: {
        type: String,
        enum: {
            values: VALID_DOCUMENT_TYPES,
            message: "invalid document type"
        },
        default: "other"
    },

    originalFileName: {
        type: String,
        required: [true, "original file name is required"],
        trim: true,
        maxlength: [255, "file name cannot exceed 255 characters"]
    },

    mimeType: {
        type: String,
        required: [true, "mime type is required"],
        enum: ["application/pdf", "image/jpeg", "image/png"]
    },

    fileSize: {
        type: Number,
        required: [true, "file size is required"],
        max: [5 * 1024 * 1024, "file size cannot exceed 5MB"]
    },

    // Internal private storage key — NEVER expose in public API responses
    storageKey: {
        type: String,
        required: [true, "storage key is required"],
        unique: true
    },

    status: {
        type: String,
        enum: {
            values: VALID_DOCUMENT_STATUSES,
            message: "invalid document status"
        },
        default: "uploaded"
    },

    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },

    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null
    },

    reviewedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

medicalDocumentSchema.index({ user: 1, screening: 1 });

const MedicalDocument = mongoose.model("MedicalDocument", medicalDocumentSchema);

module.exports = MedicalDocument;
module.exports.VALID_DOCUMENT_TYPES = VALID_DOCUMENT_TYPES;
module.exports.VALID_DOCUMENT_STATUSES = VALID_DOCUMENT_STATUSES;


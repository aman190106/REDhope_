/**
 * REDhope Donor Health Screening Controller
 * 
 * Manages donor health questionnaires, document uploads, and submissions.
 * Strictly enforces user ownership and data privacy.
 */

const mongoose = require("mongoose");
const HealthScreening = require("../models/healthScreening");
const MedicalDocument = require("../models/medicalDocument");
const user = require("../models/user");
const { saveDocument, getDocumentStream, deleteDocument, sanitizeFileName } = require("../services/storageService");
const { logMedicalEvent } = require("../services/medicalAuditService");
const { generatePreliminaryFlags } = require("../rules/preliminaryScreeningRules");
const { createNotification } = require("../services/notificationService");

const MAX_DOCUMENTS_PER_SCREENING = 5;

/**
 * Helper to ensure organizers cannot access donor medical records.
 */
function ensureNotOrganizer(req, res) {
    if (req.user?.role === "organizer") {
        res.status(403).json({
            success: false,
            message: "organizers are not authorized to access medical screening records"
        });
        return false;
    }
    return true;
}

/**
 * GET /health-screening/me
 * Retrieves current user's active health screening or creates a draft.
 */
const getMyScreening = async (req, res) => {
    try {
        if (!ensureNotOrganizer(req, res)) return;

        const userId = req.user.id;
        let screening = await HealthScreening.findOne({ user: userId }).sort({ createdAt: -1 });

        if (!screening) {
            screening = await HealthScreening.create({
                user: userId,
                status: "draft",
                questionnaire: {},
                preliminaryFlags: [],
                consentGiven: false
            });

            await logMedicalEvent({
                actor: userId,
                actorRole: req.user.role,
                action: "SCREENING_CREATED",
                resourceType: "HealthScreening",
                resourceId: screening._id,
                ipAddress: req.ip
            });
        }

        // Fetch associated documents (sanitized metadata only)
        const documents = await MedicalDocument.find({ screening: screening._id })
            .select("-storageKey")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                screening,
                documents
            }
        });
    } catch (error) {
        console.error("Error retrieving health screening:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * PUT /health-screening/me or POST /health-screening
 * Saves questionnaire draft. Normal users cannot tamper with status or reviewerDecision.
 */
const updateMyScreening = async (req, res) => {
    try {
        if (!ensureNotOrganizer(req, res)) return;

        const userId = req.user.id;
        const body = req.body || {};
        const { questionnaire, consentGiven } = body;

        // Disallow direct client elevation to approved or changing reviewer decision
        if (body.status && body.status === "approved" && req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "users cannot directly modify screening status to approved"
            });
        }

        let screening = await HealthScreening.findOne({ user: userId }).sort({ createdAt: -1 });

        if (!screening) {
            screening = new HealthScreening({
                user: userId,
                status: "draft"
            });
        }

        // Prevent modification if screening is permanently deferred or approved
        if (screening.status === "permanently_deferred") {
            return res.status(400).json({
                success: false,
                message: "screening is permanently deferred and cannot be edited"
            });
        }

        if (questionnaire && typeof questionnaire === "object") {
            screening.questionnaire = {
                ...screening.questionnaire?.toObject(),
                ...questionnaire
            };
            screening.preliminaryFlags = generatePreliminaryFlags(screening.questionnaire);
        }

        if (typeof consentGiven === "boolean") {
            screening.consentGiven = consentGiven;
            if (consentGiven && !screening.consentTimestamp) {
                screening.consentTimestamp = new Date();
            }
        }

        await screening.save();

        const documents = await MedicalDocument.find({ screening: screening._id })
            .select("-storageKey")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                screening,
                documents
            }
        });
    } catch (error) {
        console.error("Error updating health screening:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * POST /health-screening/me/submit
 * Submits the completed screening for human medical review.
 */
const submitMyScreening = async (req, res) => {
    try {
        if (!ensureNotOrganizer(req, res)) return;

        const userId = req.user.id;
        const { consentGiven } = req.body || {};

        let screening = await HealthScreening.findOne({ user: userId }).sort({ createdAt: -1 });
        if (!screening) {
            return res.status(404).json({
                success: false,
                message: "no active health screening draft found"
            });
        }

        // Enforce explicit user consent
        const isConsented = consentGiven === true || screening.consentGiven === true;
        if (!isConsented) {
            return res.status(400).json({
                success: false,
                message: "informed consent is required before submitting health screening"
            });
        }

        screening.consentGiven = true;
        screening.consentTimestamp = screening.consentTimestamp || new Date();

        // Regenerate preliminary flags for reviewer
        screening.preliminaryFlags = generatePreliminaryFlags(screening.questionnaire);
        screening.status = "submitted";
        screening.submittedAt = new Date();

        await screening.save();

        // Audit log
        await logMedicalEvent({
            actor: userId,
            actorRole: req.user.role,
            action: "SCREENING_SUBMITTED",
            resourceType: "HealthScreening",
            resourceId: screening._id,
            details: { flagsCount: screening.preliminaryFlags.length },
            ipAddress: req.ip
        });

        // Send generic confirmation in-app notification (zero PII)
        try {
            await createNotification({
                userId,
                type: "system",
                title: "Health Screening Submitted",
                message: "Your donor health screening has been submitted and queued for authorized medical review."
            });
        } catch (notifErr) {
            console.warn("Notification error:", notifErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "health screening submitted successfully for medical review",
            data: {
                screening
            }
        });
    } catch (error) {
        console.error("Error submitting health screening:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * POST /health-screening/me/documents
 * Securely uploads a medical document into private storage.
 * Supports multipart upload (req.file) or base64 JSON payload.
 */
const uploadDocument = async (req, res) => {
    try {
        if (!ensureNotOrganizer(req, res)) return;

        const userId = req.user.id;
        let screening = await HealthScreening.findOne({ user: userId }).sort({ createdAt: -1 });

        if (!screening) {
            screening = await HealthScreening.create({
                user: userId,
                status: "draft"
            });
        }

        // Enforce max documents per screening
        const existingDocsCount = await MedicalDocument.countDocuments({ screening: screening._id });
        if (existingDocsCount >= MAX_DOCUMENTS_PER_SCREENING) {
            return res.status(400).json({
                success: false,
                message: `maximum of ${MAX_DOCUMENTS_PER_SCREENING} documents per screening allowed`
            });
        }

        let fileBuffer;
        let originalFileName;
        let mimeType;
        let documentType = req.body.documentType || "other";

        if (req.file) {
            // Handled via multer
            fileBuffer = req.file.buffer;
            originalFileName = req.file.originalname;
            mimeType = req.file.mimetype;
        } else if (req.body.fileData && req.body.fileName && req.body.mimeType) {
            // Handled via base64 JSON
            fileBuffer = Buffer.from(req.body.fileData, "base64");
            originalFileName = req.body.fileName;
            mimeType = req.body.mimeType;
        } else {
            return res.status(400).json({
                success: false,
                message: "file is required (multipart or base64 data)"
            });
        }

        // Save into private storage adapter
        const { storageKey, fileSize, sanitizedFileName } = await saveDocument(
            fileBuffer,
            originalFileName,
            mimeType
        );

        const docRecord = await MedicalDocument.create({
            user: userId,
            screening: screening._id,
            documentType,
            originalFileName: sanitizedFileName,
            mimeType,
            fileSize,
            storageKey,
            uploadedBy: userId,
            status: "uploaded"
        });

        await logMedicalEvent({
            actor: userId,
            actorRole: req.user.role,
            action: "MEDICAL_DOCUMENT_UPLOADED",
            resourceType: "MedicalDocument",
            resourceId: docRecord._id,
            details: { documentType, fileSize },
            ipAddress: req.ip
        });

        // Return sanitized metadata — NEVER expose storageKey
        return res.status(201).json({
            success: true,
            data: {
                document: {
                    _id: docRecord._id,
                    documentType: docRecord.documentType,
                    originalFileName: docRecord.originalFileName,
                    mimeType: docRecord.mimeType,
                    fileSize: docRecord.fileSize,
                    status: docRecord.status,
                    createdAt: docRecord.createdAt
                }
            }
        });
    } catch (error) {
        console.error("Error uploading medical document:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "internal server error"
        });
    }
};

/**
 * GET /health-screening/me/documents
 * Lists user's uploaded medical documents metadata.
 */
const getMyDocuments = async (req, res) => {
    try {
        if (!ensureNotOrganizer(req, res)) return;

        const userId = req.user.id;
        const documents = await MedicalDocument.find({ user: userId })
            .select("-storageKey")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: { documents }
        });
    } catch (error) {
        console.error("Error listing documents:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /health-screening/documents/:documentId
 * Secure streaming download of own medical document.
 */
const downloadMyDocument = async (req, res) => {
    try {
        if (!ensureNotOrganizer(req, res)) return;

        const { documentId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({
                success: false,
                message: "invalid document ID"
            });
        }

        const docRecord = await MedicalDocument.findById(documentId);
        if (!docRecord) {
            return res.status(404).json({
                success: false,
                message: "medical document not found"
            });
        }

        // Strict ownership check (IDOR protection)
        if (docRecord.user.toString() !== userId && req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "unauthorized: cannot access documents belonging to another user"
            });
        }

        await logMedicalEvent({
            actor: userId,
            actorRole: req.user.role,
            action: "MEDICAL_DOCUMENT_DOWNLOADED",
            resourceType: "MedicalDocument",
            resourceId: docRecord._id,
            ipAddress: req.ip
        });

        const fileStream = getDocumentStream(docRecord.storageKey);

        res.setHeader("Content-Type", docRecord.mimeType);
        res.setHeader("Content-Disposition", `inline; filename="${sanitizeFileName(docRecord.originalFileName)}"`);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

        fileStream.pipe(res);
    } catch (error) {
        console.error("Error downloading medical document:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "internal server error"
        });
    }
};

/**
 * DELETE /health-screening/me/documents/:documentId
 * Deletes user's own uploaded document.
 */
const deleteMyDocument = async (req, res) => {
    try {
        if (!ensureNotOrganizer(req, res)) return;

        const { documentId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({
                success: false,
                message: "invalid document ID"
            });
        }

        const docRecord = await MedicalDocument.findById(documentId);
        if (!docRecord) {
            return res.status(404).json({
                success: false,
                message: "document not found"
            });
        }

        if (docRecord.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "unauthorized: cannot delete another user's document"
            });
        }

        // Delete from private storage
        await deleteDocument(docRecord.storageKey);

        // Delete from MongoDB
        await MedicalDocument.findByIdAndDelete(documentId);

        await logMedicalEvent({
            actor: userId,
            actorRole: req.user.role,
            action: "MEDICAL_DOCUMENT_DELETED",
            resourceType: "MedicalDocument",
            resourceId: docRecord._id,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "document deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting document:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    getMyScreening,
    updateMyScreening,
    submitMyScreening,
    uploadDocument,
    getMyDocuments,
    downloadMyDocument,
    deleteMyDocument
};

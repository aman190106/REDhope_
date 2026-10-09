/**
 * REDhope Camp-Specific Donor Screening Controller
 * 
 * Provides camp-level manual donor screening workflows for camp owners/organizers and admins.
 * Strictly verifies camp ownership, registration validity, and document-donor association.
 * Zero medical diagnosis automation: records human screening observations and decisions.
 */

const mongoose = require("mongoose");
const camp = require("../models/camp");
const campRegistration = require("../models/campRegistration");
const CampScreening = require("../models/campScreening");
const HealthScreening = require("../models/healthScreening");
const MedicalDocument = require("../models/medicalDocument");
const user = require("../models/user");
const { getDocumentStream, sanitizeFileName } = require("../services/storageService");
const { logMedicalEvent } = require("../services/medicalAuditService");
const { createNotification } = require("../services/notificationService");
const { sendEmail } = require("../services/emailService");

const { VALID_CAMP_SCREENING_DECISIONS } = CampScreening;

/**
 * Calculates approximate age from Date of Birth.
 */
function calculateAge(dob) {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
}

/**
 * Validates camp existence and organizer ownership (or admin authority).
 */
async function authorizeCampOrganizer(campId, userObj) {
    if (!mongoose.Types.ObjectId.isValid(campId)) {
        const err = new Error("invalid camp ID");
        err.statusCode = 400;
        throw err;
    }

    if (!userObj || (userObj.role !== "organizer" && userObj.role !== "admin")) {
        const err = new Error("access denied: organizer or administrator access required");
        err.statusCode = 403;
        throw err;
    }

    const targetCamp = await camp.findById(campId);
    if (!targetCamp) {
        const err = new Error("camp not found");
        err.statusCode = 404;
        throw err;
    }

    if (userObj.role === "organizer" && targetCamp.organizer.toString() !== userObj.id.toString()) {
        const err = new Error("access denied: you do not own this camp");
        err.statusCode = 403;
        throw err;
    }

    return targetCamp;
}

/**
 * GET /camps/:campId/screenings
 * Lists donors registered for the camp along with their camp screening status summary.
 * Does NOT expose full questionnaires or document files.
 */
const getCampScreenings = async (req, res) => {
    try {
        const { campId } = req.params;
        const targetCamp = await authorizeCampOrganizer(campId, req.user);

        const { status, page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const skip = (pageNum - 1) * limitNum;

        // Fetch registered donors for this camp
        const regFilter = { camp: campId };
        const registrations = await campRegistration.find(regFilter)
            .sort({ registeredAt: -1 })
            .populate("user", "_id name bloodGroup gender phone")
            .lean();

        // Fetch existing camp screenings for these registrations
        const regIds = registrations.map((r) => r._id);
        const screenings = await CampScreening.find({ registration: { $in: regIds } })
            .populate("screenedBy", "name email")
            .lean();

        const screeningByRegId = new Map();
        for (const s of screenings) {
            screeningByRegId.set(s.registration.toString(), s);
        }

        // Map summary records
        const donorSummaries = registrations.map((r) => {
            const s = screeningByRegId.get(r._id.toString());
            const decision = s ? s.decision : "pending";
            return {
                donorId: r.user ? r.user._id : null,
                name: r.user ? r.user.name : "Anonymous Donor",
                bloodGroup: r.user ? r.user.bloodGroup : "—",
                gender: r.user ? r.user.gender : "—",
                registrationId: r._id,
                registrationStatus: r.status,
                registeredAt: r.registeredAt,
                screeningStatus: decision,
                screenedAt: s ? s.screenedAt : null,
                screenedBy: s && s.screenedBy ? s.screenedBy.name : null
            };
        });

        // Apply optional status filter
        let filtered = donorSummaries;
        if (status && status !== "all") {
            filtered = donorSummaries.filter((d) => d.screeningStatus === status);
        }

        const total = filtered.length;
        const paginated = filtered.slice(skip, skip + limitNum);

        return res.status(200).json({
            success: true,
            data: {
                camp: {
                    _id: targetCamp._id,
                    name: targetCamp.name,
                    requireHealthScreening: targetCamp.requireHealthScreening
                },
                screenings: paginated,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum) || 1
                }
            }
        });
    } catch (error) {
        if (!error.statusCode || error.statusCode >= 500) {
            console.error("Error in getCampScreenings:", error);
        }
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "internal server error"
        });
    }
};

/**
 * GET /camps/:campId/screenings/:registrationId
 * Opens the comprehensive screening workspace for one registered donor.
 */
const getCampScreeningWorkspace = async (req, res) => {
    try {
        const { campId, registrationId } = req.params;
        const targetCamp = await authorizeCampOrganizer(campId, req.user);

        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({
                success: false,
                message: "invalid registration ID"
            });
        }

        const reg = await campRegistration.findById(registrationId)
            .populate("user", "_id name email phone bloodGroup gender dateOfBirth location")
            .lean();

        if (!reg) {
            return res.status(404).json({
                success: false,
                message: "registration not found"
            });
        }

        if (reg.camp.toString() !== campId.toString()) {
            return res.status(400).json({
                success: false,
                message: "registration does not belong to this camp"
            });
        }

        if (!reg.user) {
            return res.status(404).json({
                success: false,
                message: "registered donor not found"
            });
        }

        const donorId = reg.user._id;

        // 1. Fetch Donor's Layer 1 Health Screening (Submitted by donor)
        const donorHealthScreening = await HealthScreening.findOne({ user: donorId })
            .sort({ createdAt: -1 })
            .select("questionnaire preliminaryFlags status submittedAt consentGiven consentTimestamp")
            .lean();

        // 2. Fetch Donor's Uploaded Medical Documents (Sanitized metadata, NO storageKey)
        const medicalDocuments = await MedicalDocument.find({ user: donorId })
            .select("_id documentType originalFileName mimeType fileSize status createdAt")
            .sort({ createdAt: -1 })
            .lean();

        // 3. Fetch or initialize Layer 2 Camp Screening (Completed by camp screener)
        let campScreening = await CampScreening.findOne({ registration: registrationId })
            .populate("screenedBy", "name email role")
            .lean();

        if (!campScreening) {
            campScreening = {
                donor: donorId,
                camp: targetCamp._id,
                registration: reg._id,
                questionnaire: {},
                observations: "",
                reviewedDocuments: [],
                decision: "pending",
                decisionReason: null,
                screenedBy: null,
                screenedAt: null
            };
        }

        // Log audit event for accessing medical screening workspace
        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: "ORGANIZER_SCREENING_VIEWED",
            resourceType: "CampScreening",
            resourceId: campScreening._id || reg._id,
            donor: donorId,
            camp: targetCamp._id,
            registration: reg._id,
            details: {
                campName: targetCamp.name,
                hasDonorScreening: Boolean(donorHealthScreening),
                documentCount: medicalDocuments.length
            },
            ipAddress: req.ip
        });

        const donorAge = calculateAge(reg.user.dateOfBirth);

        return res.status(200).json({
            success: true,
            data: {
                camp: {
                    _id: targetCamp._id,
                    name: targetCamp.name,
                    requireHealthScreening: targetCamp.requireHealthScreening
                },
                donor: {
                    _id: reg.user._id,
                    name: reg.user.name,
                    email: reg.user.email,
                    phone: reg.user.phone,
                    bloodGroup: reg.user.bloodGroup,
                    gender: reg.user.gender,
                    dateOfBirth: reg.user.dateOfBirth,
                    age: donorAge,
                    location: reg.user.location
                },
                registration: {
                    _id: reg._id,
                    status: reg.status,
                    registeredAt: reg.registeredAt
                },
                donorHealthScreening: donorHealthScreening || null,
                medicalDocuments,
                campScreening
            }
        });
    } catch (error) {
        if (!error.statusCode || error.statusCode >= 500) {
            console.error("Error in getCampScreeningWorkspace:", error);
        }
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "internal server error"
        });
    }
};

/**
 * PUT/POST /camps/:campId/screenings/:registrationId
 * Saves manual camp screening observations, questionnaire, and decision.
 */
const saveCampScreening = async (req, res) => {
    try {
        const { campId, registrationId } = req.params;
        const targetCamp = await authorizeCampOrganizer(campId, req.user);

        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({
                success: false,
                message: "invalid registration ID"
            });
        }

        const reg = await campRegistration.findById(registrationId).populate("user");
        if (!reg) {
            return res.status(404).json({
                success: false,
                message: "registration not found"
            });
        }

        if (reg.camp.toString() !== campId.toString()) {
            return res.status(400).json({
                success: false,
                message: "registration does not belong to this camp"
            });
        }

        if (!reg.user) {
            return res.status(404).json({
                success: false,
                message: "registered donor not found"
            });
        }

        const {
            questionnaire,
            observations,
            reviewedDocuments,
            decision,
            decisionReason
        } = req.body || {};

        // Validate decision
        const validDecision = decision || "pending";
        if (!VALID_CAMP_SCREENING_DECISIONS.includes(validDecision)) {
            return res.status(400).json({
                success: false,
                message: `invalid camp screening decision: must be one of ${VALID_CAMP_SCREENING_DECISIONS.join(", ")}`
            });
        }

        // Require explanation reason for deferral, rejection, or further review
        if (["temporarily_deferred", "needs_medical_review", "rejected"].includes(validDecision)) {
            if (!decisionReason || typeof decisionReason !== "string" || !decisionReason.trim()) {
                return res.status(400).json({
                    success: false,
                    message: `decisionReason is required when setting decision to '${validDecision}'`
                });
            }
        }

        // Validate reviewed documents IDs format if provided
        let safeReviewedDocs = [];
        if (Array.isArray(reviewedDocuments)) {
            safeReviewedDocs = reviewedDocuments.filter((id) => mongoose.Types.ObjectId.isValid(id));
        }

        let existingScreening = await CampScreening.findOne({ registration: registrationId });
        const isNewRecord = !existingScreening;

        if (!existingScreening) {
            existingScreening = new CampScreening({
                donor: reg.user._id,
                camp: targetCamp._id,
                registration: reg._id
            });
        }

        // Update Layer 2 Manual Screening Questionnaire (completed by organizer)
        if (questionnaire && typeof questionnaire === "object") {
            existingScreening.questionnaire = {
                ...existingScreening.questionnaire?.toObject(),
                ...questionnaire
            };
        }

        if (typeof observations === "string") {
            existingScreening.observations = observations.trim();
        }

        if (safeReviewedDocs.length > 0) {
            existingScreening.reviewedDocuments = safeReviewedDocs;
        }

        existingScreening.decision = validDecision;
        existingScreening.decisionReason = decisionReason ? decisionReason.trim() : null;

        // Automatically derive screener identity and timestamp from backend authentication
        existingScreening.screenedBy = req.user.id;
        existingScreening.screenedAt = new Date();

        await existingScreening.save();

        // Log audit trail
        const auditAction = isNewRecord ? "CAMP_SCREENING_CREATED" : "CAMP_SCREENING_UPDATED";
        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: auditAction,
            resourceType: "CampScreening",
            resourceId: existingScreening._id,
            donor: reg.user._id,
            camp: targetCamp._id,
            registration: reg._id,
            details: {
                decision: validDecision,
                decisionReason: existingScreening.decisionReason
            },
            ipAddress: req.ip
        });

        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: "CAMP_SCREENING_DECISION_RECORDED",
            resourceType: "CampScreening",
            resourceId: existingScreening._id,
            donor: reg.user._id,
            camp: targetCamp._id,
            registration: reg._id,
            details: { decision: validDecision },
            ipAddress: req.ip
        });

        // Notifications: Non-sensitive status updates to donor
        if (validDecision !== "pending") {
            let notifMessage = `Your screening status for ${targetCamp.name} has been updated.`;
            if (validDecision === "approved") {
                notifMessage = `Your screening for ${targetCamp.name} has been completed.`;
            } else if (validDecision === "needs_medical_review") {
                notifMessage = `Your screening for ${targetCamp.name} requires further review.`;
            }

            try {
                await createNotification({
                    userId: reg.user._id,
                    type: "system",
                    title: "Camp Screening Update",
                    message: notifMessage,
                    metadata: {
                        campId: targetCamp._id.toString(),
                        registrationId: reg._id.toString(),
                        decision: validDecision
                    }
                });
            } catch (notifErr) {
                console.warn("Notification error:", notifErr.message);
            }

            // Brevo email notification (Generic, zero medical details)
            if (reg.user.email) {
                try {
                    await sendEmail({
                        to: { email: reg.user.email, name: reg.user.name },
                        subject: `Donor Screening Update — ${targetCamp.name}`,
                        text: `Your donor screening status for ${targetCamp.name} has been updated. Log in to REDhope to view your status.`
                    });
                } catch (emailErr) {
                    console.warn("Email error:", emailErr.message);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: `camp screening decision successfully saved as '${validDecision}'`,
            data: {
                campScreening: existingScreening
            }
        });
    } catch (error) {
        if (!error.statusCode || error.statusCode >= 500) {
            console.error("Error in saveCampScreening:", error);
        }
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "internal server error"
        });
    }
};

/**
 * GET /camps/:campId/screenings/:registrationId/documents/:documentId
 * Secure streaming access for camp organizer to view/download registered donor's medical documents.
 * Strictly verifies camp ownership and donor registration.
 */
const streamCampMedicalDocument = async (req, res) => {
    try {
        const { campId, registrationId, documentId } = req.params;
        const targetCamp = await authorizeCampOrganizer(campId, req.user);

        if (!mongoose.Types.ObjectId.isValid(registrationId) || !mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({
                success: false,
                message: "invalid registration or document ID"
            });
        }

        const reg = await campRegistration.findById(registrationId).lean();
        if (!reg) {
            return res.status(404).json({
                success: false,
                message: "registration not found"
            });
        }

        if (reg.camp.toString() !== campId.toString()) {
            return res.status(400).json({
                success: false,
                message: "registration does not belong to this camp"
            });
        }

        const docRecord = await MedicalDocument.findById(documentId);
        if (!docRecord) {
            return res.status(404).json({
                success: false,
                message: "medical document not found"
            });
        }

        // Strict relationship verification: document MUST belong to the registered donor
        if (docRecord.user.toString() !== reg.user.toString()) {
            return res.status(403).json({
                success: false,
                message: "access denied: document does not belong to the registered donor for this camp"
            });
        }

        // Audit log document access by organizer
        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: "MEDICAL_DOCUMENT_VIEWED_BY_ORGANIZER",
            resourceType: "MedicalDocument",
            resourceId: docRecord._id,
            donor: reg.user,
            camp: targetCamp._id,
            registration: reg._id,
            details: {
                campName: targetCamp.name,
                documentType: docRecord.documentType
            },
            ipAddress: req.ip
        });

        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: "MEDICAL_DOCUMENT_DOWNLOADED_BY_ORGANIZER",
            resourceType: "MedicalDocument",
            resourceId: docRecord._id,
            donor: reg.user,
            camp: targetCamp._id,
            registration: reg._id,
            details: {
                campName: targetCamp.name,
                fileName: docRecord.originalFileName
            },
            ipAddress: req.ip
        });

        const fileStream = getDocumentStream(docRecord.storageKey);

        res.setHeader("Content-Type", docRecord.mimeType);
        res.setHeader("Content-Disposition", `inline; filename="${sanitizeFileName(docRecord.originalFileName)}"`);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

        fileStream.pipe(res);
    } catch (error) {
        if (!error.statusCode || error.statusCode >= 500) {
            console.error("Error streaming camp medical document:", error);
        }
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "internal server error"
        });
    }
};

module.exports = {
    getCampScreenings,
    getCampScreeningWorkspace,
    saveCampScreening,
    streamCampMedicalDocument
};

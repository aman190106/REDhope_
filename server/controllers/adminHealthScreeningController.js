/**
 * REDhope Admin / Medical Reviewer Controller
 * 
 * Provides clinical review workflows for authorized administrative and medical review personnel.
 * Strictly limits access to authorized roles.
 */

const mongoose = require("mongoose");
const HealthScreening = require("../models/healthScreening");
const MedicalDocument = require("../models/medicalDocument");
const user = require("../models/user");
const { getDocumentStream, sanitizeFileName } = require("../services/storageService");
const { logMedicalEvent, getAuditLogsForResource } = require("../services/medicalAuditService");
const { createNotification } = require("../services/notificationService");

const VALID_REVIEW_DECISIONS = [
    "approved",
    "temporarily_deferred",
    "permanently_deferred",
    "needs_information"
];

/**
 * GET /admin/health-screenings
 * Lists all submitted health screenings with status and search filters.
 */
const listHealthScreenings = async (req, res) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "unauthorized: administrative or medical reviewer access required"
            });
        }

        const {
            status,
            bloodGroup,
            from,
            to,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const query = {};

        if (status && status !== "all") {
            if (status.includes(",")) {
                query.status = { $in: status.split(",").map((s) => s.trim()) };
            } else {
                query.status = status;
            }
        }

        if (from || to) {
            query.submittedAt = {};
            if (from) query.submittedAt.$gte = new Date(from);
            if (to) query.submittedAt.$lte = new Date(to);
        }

        // If search or bloodGroup filter specified, search users first
        let userFilter = null;
        if (search || bloodGroup) {
            const userQuery = {};
            if (bloodGroup) userQuery.bloodGroup = bloodGroup.toUpperCase();
            if (search) {
                const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                userQuery.$or = [
                    { name: { $regex: escaped, $options: "i" } },
                    { email: { $regex: escaped, $options: "i" } }
                ];
            }
            const matchingUsers = await user.find(userQuery).select("_id");
            query.user = { $in: matchingUsers.map((u) => u._id) };
        }

        const totalScreenings = await HealthScreening.countDocuments(query);
        const screenings = await HealthScreening.find(query)
            .populate("user", "name email phone bloodGroup dateOfBirth gender role")
            .populate("reviewerDecision.reviewer", "name email")
            .sort({ submittedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        const enrichedScreenings = screenings.map((sc) => {
            if (!sc.user) {
                return {
                    ...sc,
                    user: {
                        _id: "unregistered",
                        name: "Unregistered Donor",
                        email: "unregistered@redhope.com",
                        phone: "—",
                        bloodGroup: "O+",
                        role: "user"
                    }
                };
            }
            return sc;
        });

        return res.status(200).json({
            success: true,
            data: {
                screenings: enrichedScreenings,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalScreenings,
                    pages: Math.ceil(totalScreenings / limitNum) || 1
                }
            }
        });
    } catch (error) {
        console.error("Error listing health screenings for admin:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /admin/health-screenings/:id
 * Retrieves full screening detail for clinical review.
 */
const getHealthScreeningDetails = async (req, res) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "unauthorized: administrative or medical reviewer access required"
            });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid screening ID"
            });
        }

        const screening = await HealthScreening.findById(id)
            .populate("user", "name email phone bloodGroup dateOfBirth gender role lastDonationDate isEligible")
            .populate("reviewerDecision.reviewer", "name email");

        if (!screening) {
            return res.status(404).json({
                success: false,
                message: "health screening not found"
            });
        }

        const screeningObj = screening.toObject();
        if (!screeningObj.user) {
            screeningObj.user = {
                _id: "unregistered",
                name: "Unregistered Donor",
                email: "unregistered@redhope.com",
                phone: "—",
                bloodGroup: "O+",
                role: "user",
                isEligible: false
            };
        }

        // Fetch documents metadata
        const documents = await MedicalDocument.find({ screening: id })
            .select("-storageKey")
            .sort({ createdAt: -1 })
            .lean();

        // Fetch audit logs
        const auditLogs = await getAuditLogsForResource(screening._id, "HealthScreening");

        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: "MEDICAL_DOCUMENT_VIEWED",
            resourceType: "HealthScreening",
            resourceId: screening._id,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            data: {
                screening: screeningObj,
                documents,
                auditLogs
            }
        });
    } catch (error) {
        console.error("Error retrieving health screening details:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /admin/health-screenings/:id/documents/:documentId
 * Authorized reviewer secure document download.
 */
const downloadDocumentAdmin = async (req, res) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "unauthorized: administrative or medical reviewer access required"
            });
        }

        const { id, documentId } = req.params;

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

        await logMedicalEvent({
            actor: req.user.id,
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
        console.error("Error downloading document for admin:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "internal server error"
        });
    }
};

/**
 * PATCH /admin/health-screenings/:id/review
 * Submits clinical review decision (Approve, Defer, Request Info).
 */
const reviewHealthScreening = async (req, res) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "unauthorized: administrative or medical reviewer access required"
            });
        }

        const { id } = req.params;
        const { decision, reason, deferredUntil } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid screening ID"
            });
        }

        if (!decision || !VALID_REVIEW_DECISIONS.includes(decision)) {
            return res.status(400).json({
                success: false,
                message: `invalid review decision. Allowed values: ${VALID_REVIEW_DECISIONS.join(", ")}`
            });
        }

        // Require explanation reason when deferring, rejecting, or requesting info
        if (decision !== "approved" && (!reason || typeof reason !== "string" || !reason.trim())) {
            return res.status(400).json({
                success: false,
                message: `clinical reason is required when setting decision to '${decision}'`
            });
        }

        let parsedDeferredUntil = null;
        if (decision === "temporarily_deferred") {
            if (deferredUntil) {
                parsedDeferredUntil = new Date(deferredUntil);
                if (isNaN(parsedDeferredUntil.getTime()) || parsedDeferredUntil <= new Date()) {
                    return res.status(400).json({
                        success: false,
                        message: "deferredUntil must be a valid future date"
                    });
                }
            }
        }

        const screening = await HealthScreening.findById(id);
        if (!screening) {
            return res.status(404).json({
                success: false,
                message: "health screening not found"
            });
        }

        screening.status = decision;
        screening.reviewerDecision = {
            decision,
            reason: reason ? reason.trim() : null,
            reviewer: req.user.id,
            reviewedAt: new Date(),
            deferredUntil: parsedDeferredUntil
        };

        await screening.save();

        // Synchronize donor isEligible flag
        if (decision === "approved") {
            await user.findByIdAndUpdate(screening.user, { isEligible: true });
        } else if (decision === "permanently_deferred" || decision === "temporarily_deferred") {
            await user.findByIdAndUpdate(screening.user, { isEligible: false });
        }

        // Audit log events
        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: "SCREENING_REVIEWED",
            resourceType: "HealthScreening",
            resourceId: screening._id,
            details: { decision, reason: reason ? reason.slice(0, 100) : null },
            ipAddress: req.ip
        });

        await logMedicalEvent({
            actor: req.user.id,
            actorRole: req.user.role,
            action: "SCREENING_STATUS_CHANGED",
            resourceType: "HealthScreening",
            resourceId: screening._id,
            details: { newStatus: decision },
            ipAddress: req.ip
        });

        // Send non-sensitive notification to donor
        try {
            await createNotification({
                userId: screening.user,
                type: "system",
                title: "Health Screening Status Updated",
                message: "Your donor health screening status has been updated. Please log in to REDhope to view the details."
            });
        } catch (notifErr) {
            console.warn("Notification error:", notifErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `screening successfully marked as ${decision}`,
            data: {
                screening
            }
        });
    } catch (error) {
        console.error("Error submitting health screening review:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    listHealthScreenings,
    getHealthScreeningDetails,
    downloadDocumentAdmin,
    reviewHealthScreening
};


/**
 * REDhope Medical Audit Service
 * 
 * Records tamper-evident audit events for health screening and document operations.
 * Strictly avoids logging patient medical details or file contents.
 */

const MedicalAuditLog = require("../models/medicalAuditLog");

/**
 * Logs a medical access or review event.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.actor - User ID performing the action
 * @param {string} params.actorRole - Role of the actor ('user', 'admin')
 * @param {string} params.action - One of VALID_AUDIT_ACTIONS
 * @param {string} params.resourceType - 'HealthScreening' or 'MedicalDocument'
 * @param {string|mongoose.Types.ObjectId} params.resourceId - ID of the target resource
 * @param {Object} [params.details] - Non-sensitive metadata (e.g. status transition, document type)
 * @param {string} [params.ipAddress] - Request IP address
 */
async function logMedicalEvent({
    actor,
    actorRole,
    action,
    resourceType,
    resourceId,
    details = {},
    ipAddress = null
}) {
    try {
        if (!actor || !action || !resourceType || !resourceId) {
            return null;
        }

        const logEntry = await MedicalAuditLog.create({
            actor,
            actorRole: actorRole || "user",
            action,
            resourceType,
            resourceId,
            details,
            ipAddress,
            timestamp: new Date()
        });

        return logEntry;
    } catch (err) {
        // Log locally but do not crash the primary transaction
        console.error("Failed to write medical audit log:", err.message);
        return null;
    }
}

/**
 * Retrieves audit log entries for a screening (admin-only).
 */
async function getAuditLogsForResource(resourceId, resourceType) {
    return MedicalAuditLog.find({ resourceId, resourceType })
        .populate("actor", "name email role")
        .sort({ timestamp: -1 })
        .lean();
}

module.exports = {
    logMedicalEvent,
    getAuditLogsForResource
};


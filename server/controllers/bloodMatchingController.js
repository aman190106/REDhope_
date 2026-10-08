/**
 * REDhope Blood Matching Controller
 * 
 * Handles HTTP requests for matching blood donor candidates.
 */

const { findMatchingDonors } = require("../services/bloodMatchingService");
const { createBloodRequirement, getBloodRequests } = require("../services/bloodRequestService");
const { isValidBloodGroup } = require("../rules/bloodCompatibilityRules");

/**
 * POST /matching/donors
 * Protected endpoint for requesting compatible donor candidates.
 */
const matchDonors = async (req, res) => {
    try {
        const { bloodGroup, latitude, longitude, radius, limit } = req.body || {};

        // 1. Validate required bloodGroup
        if (!bloodGroup || typeof bloodGroup !== "string" || !bloodGroup.trim()) {
            return res.status(400).json({
                success: false,
                message: "bloodGroup is required"
            });
        }

        if (!isValidBloodGroup(bloodGroup)) {
            return res.status(400).json({
                success: false,
                message: "invalid blood group"
            });
        }

        // 2. Delegate to matching service
        const data = await findMatchingDonors({
            bloodGroup,
            latitude,
            longitude,
            radius,
            limit
        });

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error("matchDonors error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * POST /matching/requests
 * Creates a blood requirement and notifies matching eligible donors.
 */
const createRequirement = async (req, res) => {
    try {
        const { bloodGroup, unitsNeeded, urgency, location, radius, maxDonorsToNotify } = req.body || {};
        const createdBy = req.user.id;

        if (!bloodGroup || !isValidBloodGroup(bloodGroup)) {
            return res.status(400).json({
                success: false,
                message: "valid bloodGroup is required"
            });
        }

        const result = await createBloodRequirement({
            bloodGroup,
            unitsNeeded,
            urgency,
            location,
            radius,
            createdBy,
            maxDonorsToNotify
        });

        return res.status(201).json({
            success: true,
            message: "blood requirement created and matching donors notified",
            data: result
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error("createRequirement error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /matching/requests
 * Lists recent blood requirements.
 */
const getRequirements = async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const result = await getBloodRequests({ status, page, limit });
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("getRequirements error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    matchDonors,
    createRequirement,
    getRequirements
};


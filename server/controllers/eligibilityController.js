/**
 * REDhope Eligibility Controller
 * Handles HTTP requests related to blood donation eligibility.
 */

const user = require("../models/user");
const HealthScreening = require("../models/healthScreening");
const { evaluateEligibility } = require("../services/eligibilityService");

/**
 * GET /eligibility/me
 * Retrieves the authenticated user and evaluates their medical eligibility,
 * integrating basic eligibility rules and health screening review state.
 */
const getMyEligibility = async (req, res) => {
    try {
        const userId = req.user.id;
        const foundUser = await user.findById(userId).select("-password");

        if (!foundUser) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        // Retrieve latest health screening record if available
        const latestScreening = await HealthScreening.findOne({ user: userId }).sort({ createdAt: -1 });

        const eligibilityData = evaluateEligibility(foundUser, { screening: latestScreening });

        return res.status(200).json({
            success: true,
            data: {
                ...eligibilityData,
                screening: latestScreening ? {
                    id: latestScreening._id,
                    status: latestScreening.status,
                    submittedAt: latestScreening.submittedAt,
                    reviewerDecision: latestScreening.reviewerDecision?.decision ? {
                        decision: latestScreening.reviewerDecision.decision,
                        reason: latestScreening.reviewerDecision.reason,
                        reviewedAt: latestScreening.reviewerDecision.reviewedAt,
                        deferredUntil: latestScreening.reviewerDecision.deferredUntil
                    } : null
                } : null
            }
        });
    } catch (error) {
        console.error("Error evaluating eligibility:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    getMyEligibility
};

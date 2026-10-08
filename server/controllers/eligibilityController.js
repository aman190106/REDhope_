/**
 * REDhope Eligibility Controller
 * Handles HTTP requests related to blood donation eligibility.
 */

const user = require("../models/user");
const { evaluateEligibility } = require("../services/eligibilityService");

/**
 * GET /eligibility/me
 * Retrieves the authenticated user and evaluates their medical eligibility.
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

        const eligibilityData = evaluateEligibility(foundUser);

        return res.status(200).json({
            success: true,
            data: eligibilityData
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


/**
 * REDhope Eligibility Service
 * Evaluates donor medical eligibility based on defined eligibility rules.
 * 
 * Reusable directly by future modules (Camp Registration, Blood Matching, Donation Tracking).
 */

const { rules } = require("../rules/eligibilityRules");

/**
 * Evaluates a user object against all eligibility rules.
 * 
 * @param {Object} user - User document or plain user object
 * @returns {Object} Structured eligibility result
 */
function evaluateEligibility(user) {
    if (!user) {
        throw new Error("User object is required for eligibility evaluation");
    }

    const reasons = [];
    let isMedicallyEligible = true;
    let nextEligibleDate = null;

    for (const rule of rules) {
        const result = rule(user);

        if (!result.passed) {
            isMedicallyEligible = false;
            if (result.reason) {
                reasons.push(result.reason);
            }
        }

        // If a rule calculated a nextEligibleDate and it hasn't passed, record it
        if (result.nextEligibleDate) {
            nextEligibleDate = result.nextEligibleDate;
        }
    }

    return {
        isMedicallyEligible,
        isDonorAvailable: user.isDonorAvailable !== undefined ? Boolean(user.isDonorAvailable) : true,
        nextEligibleDate,
        reasons,
        checkedAt: new Date().toISOString()
    };
}

module.exports = {
    evaluateEligibility
};


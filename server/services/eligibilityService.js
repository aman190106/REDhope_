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
 * @param {Object} [options] - Optional evaluation options
 * @param {Object|null} [options.screening] - User's latest health screening record
 * @param {boolean} [options.requireScreening] - Enforces approved screening requirement
 * @returns {Object} Structured eligibility result
 */
function evaluateEligibility(user, options = {}) {
    if (!user) {
        throw new Error("User object is required for eligibility evaluation");
    }

    const reasons = [];
    let isMedicallyEligible = true;
    let nextEligibleDate = null;

    const screening = options.screening !== undefined 
        ? options.screening 
        : (user.healthScreening || null);

    for (const rule of rules) {
        const result = rule(user, screening);

        if (!result.passed) {
            isMedicallyEligible = false;
            if (result.reason) {
                reasons.push(result.reason);
            }
        }

        // If a rule calculated a nextEligibleDate, record it
        if (result.nextEligibleDate) {
            nextEligibleDate = result.nextEligibleDate;
        }
    }

    // If screening is explicitly required and not approved
    if (options.requireScreening && (!screening || screening.status !== "approved")) {
        isMedicallyEligible = false;
        const reqReason = !screening
            ? "Health screening review is required before donation."
            : `Health screening review is not approved (Status: ${screening.status.replace("_", " ")}).`;
        if (!reasons.includes(reqReason)) {
            reasons.push(reqReason);
        }
    }

    return {
        isMedicallyEligible,
        isDonorAvailable: user.isDonorAvailable !== undefined ? Boolean(user.isDonorAvailable) : true,
        nextEligibleDate,
        reasons,
        screeningStatus: screening ? screening.status : "none",
        checkedAt: new Date().toISOString()
    };
}

module.exports = {
    evaluateEligibility
};

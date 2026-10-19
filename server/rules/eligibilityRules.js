/**
 * REDhope Eligibility Rules
 * Isolated, modular business rules for blood donation eligibility.
 * 
 * Rules can be added or adjusted here without rewriting the evaluation service.
 */

// Configurable REDhope business rule constant for donation interval
const MIN_DONATION_INTERVAL_DAYS = 90;

/**
 * 1. Administrative / System Block Rule
 * If isEligible is explicitly false on the user record, the user is blocked.
 */
function checkAdminSystemBlock(user, screening) {
    if (user.isEligible === false) {
        if (user.eligibilityStatus === "pending" || (screening && (screening.status === "submitted" || screening.status === "under_review"))) {
            return {
                passed: false,
                reason: "Eligibility test submitted and pending administrator approval."
            };
        }
        if (user.eligibilityStatus === "deferred" || (screening && (screening.status === "temporarily_deferred" || screening.status === "permanently_deferred"))) {
            return {
                passed: false,
                reason: "Account deferred from blood donation."
            };
        }
        if (user.eligibilityStatus === "ineligible" || (!screening || screening.status === "draft")) {
            return {
                passed: false,
                reason: "Eligibility test required before donation."
            };
        }
        return {
            passed: false,
            reason: "Account marked ineligible by system or administrator."
        };
    }
    return { passed: true };
}

/**
 * 2. Age Rule
 * Calculates current age from dateOfBirth.
 * Ensures the donor is at least 18 years old at the moment of evaluation.
 */
function checkAge(user) {
    if (!user.dateOfBirth) {
        return { passed: true }; // If dateOfBirth is not set, skip or handled by registration
    }

    const birthDate = new Date(user.dateOfBirth);
    if (isNaN(birthDate.getTime())) {
        return { passed: true };
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 18) {
        return {
            passed: false,
            reason: "Donor must be at least 18 years old."
        };
    }

    return { passed: true };
}

/**
 * 3. Donation Interval Rule
 * Calculates whether MIN_DONATION_INTERVAL_DAYS have passed since lastDonationDate.
 * Calculates nextEligibleDate = lastDonationDate + MIN_DONATION_INTERVAL_DAYS.
 */
function checkDonationInterval(user) {
    if (!user.lastDonationDate) {
        return {
            passed: true,
            nextEligibleDate: null
        };
    }

    const lastDonation = new Date(user.lastDonationDate);
    if (isNaN(lastDonation.getTime())) {
        return {
            passed: true,
            nextEligibleDate: null
        };
    }

    // Calculate nextEligibleDate by adding MIN_DONATION_INTERVAL_DAYS
    const nextEligible = new Date(lastDonation.getTime());
    nextEligible.setDate(nextEligible.getDate() + MIN_DONATION_INTERVAL_DAYS);

    const now = new Date();
    if (now < nextEligible) {
        return {
            passed: false,
            nextEligibleDate: nextEligible.toISOString(),
            reason: "Minimum donation interval has not passed."
        };
    }

    return {
        passed: true,
        nextEligibleDate: null
    };
}

/**
 * 4. Health Screening Rule
 * Evaluates donor medical screening status when a screening record is present.
 */
function checkHealthScreening(user, screening) {
    if (!screening) {
        if (user && user.isEligible === false) {
            return {
                passed: false,
                reason: user.eligibilityStatus === "pending"
                    ? "Eligibility test submitted and pending administrator approval."
                    : "Eligibility test required before donation."
            };
        }
        return { passed: true };
    }

    if (screening.status === "approved") {
        return { passed: true };
    }

    if (screening.status === "draft") {
        return {
            passed: false,
            reason: "Eligibility test required before donation."
        };
    }

    if (screening.status === "submitted" || screening.status === "under_review") {
        return {
            passed: false,
            reason: "Eligibility test submitted and pending administrator approval."
        };
    }

    if (screening.status === "temporarily_deferred") {
        return {
            passed: false,
            reason: screening.reviewerDecision?.reason
                ? `Temporarily deferred from donation: ${screening.reviewerDecision.reason}`
                : "Temporarily deferred by medical reviewer.",
            nextEligibleDate: screening.reviewerDecision?.deferredUntil
                ? new Date(screening.reviewerDecision.deferredUntil).toISOString()
                : null
        };
    }

    if (screening.status === "permanently_deferred") {
        return {
            passed: false,
            reason: screening.reviewerDecision?.reason
                ? `Permanently deferred from blood donation: ${screening.reviewerDecision.reason}`
                : "Permanently deferred from blood donation by medical reviewer."
        };
    }

    if (screening.status === "needs_information") {
        return {
            passed: false,
            reason: screening.reviewerDecision?.reason
                ? `Health screening requires additional information: ${screening.reviewerDecision.reason}`
                : "Health screening requires additional information before medical clearance."
        };
    }

    return {
        passed: false,
        reason: `Health screening review is pending or incomplete (Status: ${screening.status.replace("_", " ")}).`
    };
}

module.exports = {
    MIN_DONATION_INTERVAL_DAYS,
    rules: [
        checkAdminSystemBlock,
        checkAge,
        checkDonationInterval,
        checkHealthScreening
    ],
    // Export individual rule helpers for direct testing if needed
    checkAdminSystemBlock,
    checkAge,
    checkDonationInterval,
    checkHealthScreening
};



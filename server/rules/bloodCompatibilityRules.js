/**
 * REDhope Blood Compatibility Rules
 * 
 * Defines pure, isolated business rules for red blood cell (RBC) compatibility.
 * Donor -> Recipient relationships:
 *   O-  -> O-, O+, A-, A+, B-, B+, AB-, AB+  (Universal donor)
 *   O+  -> O+, A+, B+, AB+
 *   A-  -> A-, A+, AB-, AB+
 *   A+  -> A+, AB+
 *   B-  -> B-, B+, AB-, AB+
 *   B+  -> B+, AB+
 *   AB- -> AB-, AB+
 *   AB+ -> AB+                             (Recipient only)
 */

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * Compatible donor blood groups for each recipient blood group.
 */
const COMPATIBLE_DONORS_FOR_RECIPIENT = {
    "O-": ["O-"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"]
};

/**
 * Validates if a blood group string is one of the 8 supported REDhope blood groups.
 * @param {string} bg
 * @returns {boolean}
 */
function isValidBloodGroup(bg) {
    if (!bg || typeof bg !== "string") return false;
    return VALID_BLOOD_GROUPS.includes(bg.trim().toUpperCase());
}

/**
 * Returns an array of compatible donor blood groups for a given recipient blood group.
 * @param {string} recipientBloodGroup
 * @returns {string[]} Array of compatible donor blood group strings
 */
function getCompatibleDonorBloodGroups(recipientBloodGroup) {
    if (!isValidBloodGroup(recipientBloodGroup)) {
        return [];
    }
    const normalized = recipientBloodGroup.trim().toUpperCase();
    return COMPATIBLE_DONORS_FOR_RECIPIENT[normalized] || [];
}

/**
 * Checks if a specific donor blood group is compatible with a recipient blood group.
 * @param {string} donorBloodGroup
 * @param {string} recipientBloodGroup
 * @returns {boolean}
 */
function isBloodCompatible(donorBloodGroup, recipientBloodGroup) {
    if (!isValidBloodGroup(donorBloodGroup) || !isValidBloodGroup(recipientBloodGroup)) {
        return false;
    }
    const compatibleList = getCompatibleDonorBloodGroups(recipientBloodGroup);
    return compatibleList.includes(donorBloodGroup.trim().toUpperCase());
}

module.exports = {
    VALID_BLOOD_GROUPS,
    COMPATIBLE_DONORS_FOR_RECIPIENT,
    isValidBloodGroup,
    getCompatibleDonorBloodGroups,
    isBloodCompatible
};


/**
 * REDhope Preliminary Health Screening Rules
 * 
 * Flags questionnaire responses for human medical reviewer attention.
 * 
 * IMPORTANT:
 * - This does NOT produce an automated medical diagnosis.
 * - This does NOT auto-approve donors.
 * - Flags serve as transparent checklists for authorized medical reviewers.
 */

function generatePreliminaryFlags(questionnaire = {}) {
    const flags = [];

    const {
        generalHealth = {},
        medicalHistory = {},
        medication = {},
        donationHistory = {},
        recentProcedures = {},
        travelExposure = {},
        pregnancyRelated = {},
        measurements = {},
        infectionRisk = {}
    } = questionnaire;

    // 1. General Health
    if (generalHealth.feelWell === false) {
        flags.push({
            code: "GENERAL_UNWELL",
            severity: "review",
            message: "Donor indicated they currently do not feel well today.",
            category: "General Health"
        });
    }

    if (generalHealth.hasFeverOrIllness === true) {
        flags.push({
            code: "FEVER_OR_ILLNESS",
            severity: "review",
            message: "Active fever, acute illness, or infectious symptoms reported.",
            category: "General Health"
        });
    }

    if (generalHealth.recoveredRecently === true) {
        flags.push({
            code: "RECENT_RECOVERY",
            severity: "review",
            message: "Recent recovery from illness reported. Reviewer should verify recovery cooldown.",
            category: "General Health"
        });
    }

    // 2. Medical History
    if (medicalHistory.chronicCondition === true) {
        flags.push({
            code: "CHRONIC_CONDITION",
            severity: "review",
            message: "Chronic or ongoing medical condition reported.",
            category: "Medical History"
        });
    }

    if (medicalHistory.recentSurgery === true) {
        flags.push({
            code: "RECENT_SURGERY",
            severity: "review",
            message: "Recent surgical or invasive procedure reported.",
            category: "Medical History"
        });
    }

    if (medicalHistory.underTreatment === true) {
        flags.push({
            code: "UNDER_TREATMENT",
            severity: "review",
            message: "Donor is currently undergoing medical therapy or clinical care.",
            category: "Medical History"
        });
    }

    // 3. Medication
    if (medication.takingMedication === true) {
        flags.push({
            code: "ACTIVE_MEDICATION",
            severity: "review",
            message: "Active prescription or over-the-counter medications reported.",
            category: "Medication"
        });
    }

    // 4. Donation History
    if (donationHistory.adverseReactionHistory === true) {
        flags.push({
            code: "PAST_ADVERSE_REACTION",
            severity: "review",
            message: "History of adverse reaction (fainting, hematoma) during prior blood donation.",
            category: "Donation History"
        });
    }

    // 5. Recent Procedures / Exposures
    if (recentProcedures.recentTattooOrPiercing === true) {
        flags.push({
            code: "RECENT_TATTOO_PIERCING",
            severity: "review",
            message: "Recent tattoo, body piercing, or acupuncture within last 6 months.",
            category: "Recent Procedures"
        });
    }

    if (recentProcedures.recentTransfusion === true) {
        flags.push({
            code: "PAST_TRANSFUSION",
            severity: "review",
            message: "Prior receipt of blood or blood component transfusion.",
            category: "Recent Procedures"
        });
    }

    // 6. Travel / Exposure
    if (travelExposure.highRiskTravel === true) {
        flags.push({
            code: "TRAVEL_EXPOSURE",
            severity: "review",
            message: "Recent travel to an endemic or high-risk infectious region.",
            category: "Travel / Exposure"
        });
    }

    // 7. Pregnancy-Related
    if (pregnancyRelated.isApplicable) {
        if (pregnancyRelated.currentlyPregnant === true) {
            flags.push({
                code: "CURRENT_PREGNANCY",
                severity: "review",
                message: "Current pregnancy reported. Standard clinical deferral applies.",
                category: "Pregnancy"
            });
        }
        if (pregnancyRelated.breastfeeding === true) {
            flags.push({
                code: "BREASTFEEDING",
                severity: "review",
                message: "Currently breastfeeding or recent delivery reported.",
                category: "Pregnancy"
            });
        }
    }

    // 8. Measurements & Vitals
    if (measurements.weightKg !== null && measurements.weightKg !== undefined) {
        if (measurements.weightKg < 45) {
            flags.push({
                code: "UNDERWEIGHT",
                severity: "warning",
                message: `Reported weight (${measurements.weightKg} kg) is below standard minimum collection threshold (45-50 kg).`,
                category: "Measurements"
            });
        }
    }

    if (measurements.recentHemoglobin !== null && measurements.recentHemoglobin !== undefined) {
        if (measurements.recentHemoglobin < 12.5) {
            flags.push({
                code: "LOW_HEMOGLOBIN",
                severity: "review",
                message: `Reported hemoglobin (${measurements.recentHemoglobin} g/dL) is below 12.5 g/dL guideline.`,
                category: "Measurements"
            });
        }
    }

    // 9. Infection Risk
    if (
        infectionRisk.hepatitisOrJaundiceHistory === true ||
        infectionRisk.hivRiskExposure === true ||
        infectionRisk.otherInfectionRisk === true
    ) {
        flags.push({
            code: "INFECTION_RISK",
            severity: "warning",
            message: "Specific viral or transfusion-transmissible infection risk factor indicated.",
            category: "Infection Screening"
        });
    }

    return flags;
}

module.exports = {
    generatePreliminaryFlags
};


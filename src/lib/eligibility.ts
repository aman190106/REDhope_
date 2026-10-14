/**
 * REDhope Eligibility Display Helper
 * 
 * Provides unified, synchronized eligibility status formatting across
 * Donor Dashboard, User Profile, Eligibility page, and Camp Registration.
 * Eliminates clashes between raw user.isEligible admin flag and
 * real-time medical eligibility / health screening review state.
 */

export interface EligibilityScreeningInfo {
  id?: string;
  status?: string;
  submittedAt?: string;
  reviewerDecision?: {
    decision?: string;
    reason?: string;
    reviewedAt?: string;
    deferredUntil?: string;
  } | null;
}

export interface EligibilityEvaluation {
  isMedicallyEligible: boolean;
  isDonorAvailable: boolean;
  nextEligibleDate: string | null;
  reasons: string[];
  screeningStatus?: string;
  screening?: EligibilityScreeningInfo | null;
  checkedAt?: string;
}

export interface EligibilityDisplayStatus {
  status:
    | "eligible"
    | "waiting_period"
    | "screening_draft"
    | "screening_pending"
    | "screening_action_required"
    | "deferred"
    | "ineligible";
  badgeText: string;
  cardTitle: string;
  cardSubtitle: string;
  color: string;
  icon: string;
  linkTo?: string;
  linkText?: string;
}

/**
 * Calculates a unified display status from medical evaluation and user record.
 */
export function getEligibilityDisplay(
  evaluation: EligibilityEvaluation | null | undefined,
  user?: { isEligible?: boolean; lastDonationDate?: string | null } | null
): EligibilityDisplayStatus {
  // If no evaluation has loaded yet, fall back safely to user record
  if (!evaluation) {
    if (user?.isEligible === false) {
      return {
        status: "ineligible",
        badgeText: "Ineligible",
        cardTitle: "Account Ineligible",
        cardSubtitle: "Administrative block in place",
        color: "var(--primary)",
        icon: "fas fa-ban",
        linkTo: "/eligibility",
        linkText: "View details →"
      };
    }
    return {
      status: "eligible",
      badgeText: "Eligible to Donate",
      cardTitle: "Verified Eligible",
      cardSubtitle: "Ready to save lives",
      color: "var(--success)",
      icon: "fas fa-check-circle",
      linkTo: "/eligibility",
      linkText: "View rules →"
    };
  }

  // 1. Fully Medically Eligible
  if (evaluation.isMedicallyEligible) {
    return {
      status: "eligible",
      badgeText: "Eligible to Donate",
      cardTitle: "Verified Eligible",
      cardSubtitle: "You meet all medical criteria to donate",
      color: "var(--success)",
      icon: "fas fa-check-circle",
      linkTo: "/eligibility",
      linkText: "View criteria & rules →"
    };
  }

  // 2. Ineligible: Check specific reasons & health screening states
  const screeningStatus = evaluation.screeningStatus || evaluation.screening?.status;
  const nextDate = evaluation.nextEligibleDate;

  // Screening Draft
  if (screeningStatus === "draft") {
    return {
      status: "screening_draft",
      badgeText: "Screening Incomplete",
      cardTitle: "Screening Incomplete",
      cardSubtitle: "Complete questionnaire for clearance",
      color: "#d97706",
      icon: "fas fa-clipboard-list",
      linkTo: "/health-screening",
      linkText: "Complete Screening →"
    };
  }

  // Screening Submitted / Awaiting Clinical Review
  if (screeningStatus === "submitted" || screeningStatus === "pending_review") {
    return {
      status: "screening_pending",
      badgeText: "Review in Progress",
      cardTitle: "Review in Progress",
      cardSubtitle: "Awaiting medical clearance",
      color: "#2563eb",
      icon: "fas fa-stethoscope",
      linkTo: "/health-screening",
      linkText: "View Screening →"
    };
  }

  // Screening Needs More Information
  if (screeningStatus === "needs_information") {
    return {
      status: "screening_action_required",
      badgeText: "Action Required",
      cardTitle: "Additional Info Needed",
      cardSubtitle: "Reviewer requested more details",
      color: "#d97706",
      icon: "fas fa-exclamation-circle",
      linkTo: "/health-screening",
      linkText: "Update Screening →"
    };
  }

  // Screening Deferred (Temporarily or Permanently)
  if (screeningStatus === "temporarily_deferred" || screeningStatus === "permanently_deferred") {
    const isTemp = screeningStatus === "temporarily_deferred";
    const formattedNext = nextDate
      ? new Date(nextDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : null;
    return {
      status: "deferred",
      badgeText: isTemp ? "Temporarily Deferred" : "Permanently Deferred",
      cardTitle: isTemp ? "Temporarily Deferred" : "Permanently Deferred",
      cardSubtitle: formattedNext ? `Eligible after ${formattedNext}` : "Medical deferral in place",
      color: "var(--primary)",
      icon: "fas fa-calendar-times",
      linkTo: "/health-screening",
      linkText: "Review Details →"
    };
  }

  // Actual Waiting Period (Next donation date exists or donation within 90 days)
  if (nextDate || user?.lastDonationDate) {
    const formattedDate = nextDate
      ? new Date(nextDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : null;
    return {
      status: "waiting_period",
      badgeText: "Waiting Period",
      cardTitle: "Waiting Period",
      cardSubtitle: formattedDate ? `Next eligible on ${formattedDate}` : "90-day cooldown interval",
      color: "#d97706",
      icon: "fas fa-clock",
      linkTo: "/eligibility",
      linkText: "View criteria & rules →"
    };
  }

  // Account Ineligible (Admin block or Age restriction)
  const firstReason = evaluation.reasons && evaluation.reasons.length > 0
    ? evaluation.reasons[0]
    : "Temporarily ineligible";

  return {
    status: "ineligible",
    badgeText: "Ineligible to Donate",
    cardTitle: "Temporarily Ineligible",
    cardSubtitle: firstReason,
    color: "var(--primary)",
    icon: "fas fa-times-circle",
    linkTo: "/eligibility",
    linkText: "View criteria & rules →"
  };
}


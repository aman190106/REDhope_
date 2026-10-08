/**
 * REDhope Notification Scheduler
 * 
 * Lightweight, in-process periodic scheduler for time-based in-app notifications:
 * 1. 24-hour Camp Reminders for actively registered donors
 * 2. 90-day Donation Eligibility Reminders based on authoritative eligibilityEngine
 * 
 * Guarantees idempotency via deterministic eventKey deduplication.
 * Safe against crashes and multiple job iterations.
 */

const camp = require("../models/camp");
const campRegistration = require("../models/campRegistration");
const user = require("../models/user");
const notification = require("../models/notification");
const { evaluateEligibility } = require("./eligibilityService");
const { createNotification } = require("./notificationService");

let schedulerInterval = null;
let isJobRunning = false;

/**
 * Calculates exact camp start Date object based on startDate and optional startTime.
 */
function getCampStartDateTime(campDoc) {
    if (!campDoc || !campDoc.startDate) return null;
    const start = new Date(campDoc.startDate);
    if (isNaN(start.getTime())) return null;

    let [hours, minutes] = [9, 0];
    if (campDoc.startTime && typeof campDoc.startTime === "string") {
        const parts = campDoc.startTime.split(":").map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            hours = parts[0];
            minutes = parts[1];
        }
    }

    const dt = new Date(start);
    dt.setHours(hours, minutes, 0, 0);
    return dt;
}

/**
 * Checks for upcoming camps starting within 24 hours and creates reminders
 * for donors who have an active registration.
 * 
 * @returns {Promise<number>} Number of reminders created
 */
async function checkCampReminders() {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find published camps that have not yet ended or passed start
    const upcomingCamps = await camp.find({
        status: "published"
    }).lean();

    let reminderCount = 0;

    for (const c of upcomingCamps) {
        const campStart = getCampStartDateTime(c);
        if (!campStart) continue;

        // Camp must be upcoming (in the future) and within the 24-hour window
        const diffMs = campStart.getTime() - now.getTime();
        const isInReminderWindow = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;

        if (!isInReminderWindow) {
            continue;
        }

        // Find active registered donors for this camp (cancelled registrations are ignored)
        const activeRegistrations = await campRegistration.find({
            camp: c._id,
            status: "registered"
        }).lean();

        for (const reg of activeRegistrations) {
            try {
                const eventKey = `camp-reminder:${c._id}:${reg._id}:24h`;
                const existingNotif = await notification.findOne({
                    user: reg.user,
                    eventKey
                });
                if (existingNotif) {
                    continue;
                }

                const dateStr = campStart.toLocaleDateString();
                const venue = (c.location && (c.location.address || c.location.city)) || "Camp Venue";

                await createNotification({
                    userId: reg.user,
                    type: "camp_update",
                    title: "Camp Reminder",
                    message: `Reminder: The blood donation camp "${c.name}" starts on ${dateStr} at ${c.startTime || "09:00"}. Location: ${venue}.`,
                    metadata: {
                        campId: c._id.toString(),
                        campName: c.name,
                        startDate: c.startDate,
                        startTime: c.startTime,
                        address: c.location?.address,
                        city: c.location?.city,
                        registrationId: reg._id.toString(),
                        eventKey
                    },
                    eventKey
                });
                reminderCount++;
            } catch (err) {
                console.error(`Failed to create camp reminder for registration ${reg._id}:`, err);
            }
        }
    }

    return reminderCount;
}

/**
 * Checks for donors who have reached or are approaching eligibility again (90-day cycle).
 * Reuses evaluateEligibility as the single authority. Never modifies user data.
 * 
 * @returns {Promise<number>} Number of reminders created
 */
async function checkDonationEligibilityReminders() {
    const now = new Date();

    // Query donors who have donated previously
    const donors = await user.find({
        lastDonationDate: { $ne: null }
    }).select("-password");

    let reminderCount = 0;

    for (const donor of donors) {
        try {
            const eligibility = evaluateEligibility(donor);
            const cycleKey = new Date(donor.lastDonationDate).toISOString().slice(0, 10);

            if (eligibility.isMedicallyEligible) {
                // 90 days have elapsed: Donor is eligible again!
                const eventKey = `donation-eligibility:${donor._id}:${cycleKey}`;
                const existingNotif = await notification.findOne({
                    user: donor._id,
                    eventKey
                });
                if (existingNotif) {
                    continue;
                }

                await createNotification({
                    userId: donor._id,
                    type: "system",
                    title: "You're Eligible to Donate Again",
                    message: "It has been 90 days since your last donation. You are now medically eligible to donate blood again and help save lives.",
                    metadata: {
                        nextEligibleDate: null,
                        lastDonationDate: donor.lastDonationDate,
                        eventKey
                    },
                    eventKey
                });
                reminderCount++;
            } else if (eligibility.nextEligibleDate) {
                // Check if approaching eligibility (within 7 days)
                const nextDate = new Date(eligibility.nextEligibleDate);
                const diffMs = nextDate.getTime() - now.getTime();
                const daysUntil = diffMs / (24 * 60 * 60 * 1000);

                if (daysUntil > 0 && daysUntil <= 7) {
                    const earlyEventKey = `donation-eligibility-early:${donor._id}:${cycleKey}`;
                    const existingNotif = await notification.findOne({
                        user: donor._id,
                        eventKey: earlyEventKey
                    });
                    if (existingNotif) {
                        continue;
                    }

                    await createNotification({
                        userId: donor._id,
                        type: "system",
                        title: "Upcoming Donation Eligibility",
                        message: `You will be eligible to donate blood again in ${Math.ceil(daysUntil)} day(s) on ${nextDate.toLocaleDateString()}.`,
                        metadata: {
                            nextEligibleDate: eligibility.nextEligibleDate,
                            lastDonationDate: donor.lastDonationDate,
                            eventKey: earlyEventKey
                        },
                        eventKey: earlyEventKey
                    });
                    reminderCount++;
                }
            }
        } catch (donorErr) {
            console.error(`Failed to process donation reminder for donor ${donor._id}:`, donorErr);
        }
    }

    return reminderCount;
}

/**
 * Executes all periodic notification jobs safely.
 */
async function runAllJobs() {
    if (isJobRunning) {
        return { skipped: true };
    }
    isJobRunning = true;

    try {
        const [campReminders, donationReminders] = await Promise.all([
            checkCampReminders(),
            checkDonationEligibilityReminders()
        ]);

        return {
            campReminders,
            donationReminders
        };
    } catch (jobError) {
        console.error("Error executing notification scheduler jobs:", jobError);
        return { error: jobError.message };
    } finally {
        isJobRunning = false;
    }
}

/**
 * Starts periodic scheduler. Non-blocking.
 * 
 * @param {Object} options
 * @param {number} [options.intervalMs=60000] - Polling interval in ms (default: 60s)
 */
function startScheduler({ intervalMs = 60000 } = {}) {
    if (schedulerInterval) {
        return; // Already started
    }

    // Run initial cycle asynchronously
    runAllJobs().catch(() => {});

    // Set recurring timer
    schedulerInterval = setInterval(() => {
        runAllJobs().catch(() => {});
    }, intervalMs);

    if (schedulerInterval.unref) {
        schedulerInterval.unref();
    }
}

/**
 * Stops periodic scheduler.
 */
function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
    isJobRunning = false;
}

/**
 * Checks if scheduler is currently running.
 */
function isSchedulerRunning() {
    return schedulerInterval !== null;
}

module.exports = {
    startScheduler,
    stopScheduler,
    isSchedulerRunning,
    runAllJobs,
    checkCampReminders,
    checkDonationEligibilityReminders,
    getCampStartDateTime
};

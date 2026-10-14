/**
 * REDhope Notification Delivery Service
 * 
 * Bridges in-app notifications with external delivery channels (Brevo Email API).
 * Ensures email delivery failures NEVER break business operations or in-app notification creation.
 * Checks user email preferences (emailNotifications: true) before sending.
 */

const userModel = require("../models/user");
const { sendEmail } = require("./emailService");
const {
    getCampRegistrationTemplate,
    getCampRegistrationCancelledTemplate,
    getCampUpdateTemplate,
    getCampCancelledTemplate,
    getCampReminderTemplate,
    getBloodMatchTemplate,
    getDonationReminderTemplate,
    getDonationRecordedTemplate,
    getNearbyCampAlertTemplate
} = require("../templates/emailTemplates");

/**
 * Resolves recipient user document.
 * 
 * @param {Object|string} userRef - User document or ObjectId/string
 * @returns {Promise<Object|null>}
 */
async function resolveUser(userRef) {
    if (!userRef) return null;
    if (typeof userRef === "object" && userRef.email) {
        return userRef;
    }
    try {
        return await userModel.findById(userRef).select("name email emailNotifications").lean();
    } catch {
        return null;
    }
}

/**
 * Delivers an email notification corresponding to an in-app notification event.
 * Never throws errors.
 * 
 * @param {Object} params
 * @param {Object|string} params.user - User document or userId
 * @param {string} params.type - Notification type enum
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {Object} [params.metadata] - Event metadata (camp details, blood group, etc.)
 * @param {string} [params.notificationId] - Associated in-app notification ID for logging
 * @param {string} [params.eventKey] - Deduplication key
 * @returns {Promise<{ delivered: boolean, skipped?: boolean, reason?: string, error?: string }>}
 */
async function deliverNotificationEmail({
    user,
    type,
    title = "",
    message = "",
    metadata = {},
    notificationId = null,
    eventKey = null
}) {
    try {
        // 1. Resolve recipient user
        const recipient = await resolveUser(user);
        if (!recipient || !recipient.email) {
            return {
                delivered: false,
                skipped: true,
                reason: "no valid recipient email found"
            };
        }

        // 2. Check user's email preference
        if (recipient.emailNotifications === false) {
            return {
                delivered: false,
                skipped: true,
                reason: "user has disabled email notifications"
            };
        }

        // 3. Resolve template based on notification type and title/eventKey
        let emailContent = null;
        const donorName = recipient.name || "Donor";

        switch (type) {
            case "camp_registration":
                if (title.toLowerCase().includes("cancelled")) {
                    emailContent = getCampRegistrationCancelledTemplate({
                        donorName,
                        campName: metadata.campName || "Blood Donation Camp",
                        location: metadata.location
                    });
                } else {
                    emailContent = getCampRegistrationTemplate({
                        donorName,
                        campName: metadata.campName || "Blood Donation Camp",
                        startDate: metadata.startDate,
                        endDate: metadata.endDate,
                        location: metadata.location,
                        address: metadata.address
                    });
                }
                break;

            case "camp_update":
                if (metadata.isNearbyCampAlert || (eventKey && eventKey.includes("camp-nearby")) || title.toLowerCase().includes("near you")) {
                    emailContent = getNearbyCampAlertTemplate({
                        donorName,
                        campName: metadata.campName || "Blood Donation Camp",
                        startDate: metadata.startDate,
                        endDate: metadata.endDate,
                        startTime: metadata.startTime,
                        endTime: metadata.endTime,
                        address: metadata.address,
                        city: metadata.city,
                        distanceKm: metadata.distanceKm,
                        campId: metadata.campId
                    });
                } else if ((eventKey && eventKey.includes("camp-reminder")) || title.toLowerCase().includes("reminder")) {
                    emailContent = getCampReminderTemplate({
                        donorName,
                        campName: metadata.campName || "Blood Donation Camp",
                        startDate: metadata.startDate,
                        startTime: metadata.startTime,
                        address: metadata.address,
                        city: metadata.city
                    });
                } else {
                    emailContent = getCampUpdateTemplate({
                        donorName,
                        campName: metadata.campName || "Blood Donation Camp",
                        startDate: metadata.startDate,
                        startTime: metadata.startTime,
                        endTime: metadata.endTime,
                        address: metadata.address
                    });
                }
                break;

            case "camp_cancellation":
                emailContent = getCampCancelledTemplate({
                    donorName,
                    campName: metadata.campName || "Blood Donation Camp"
                });
                break;

            case "blood_match":
                emailContent = getBloodMatchTemplate({
                    donorName,
                    bloodGroup: metadata.bloodGroup || "Compatible Blood Group",
                    urgency: metadata.urgency,
                    unitsNeeded: metadata.unitsNeeded,
                    city: metadata.city
                });
                break;

            case "system":
                if (metadata.donationId || title.toLowerCase().includes("donation recorded")) {
                    emailContent = getDonationRecordedTemplate({
                        donorName,
                        campName: metadata.campName,
                        donationDate: metadata.donationDate,
                        units: metadata.units,
                        bloodGroup: metadata.bloodGroup
                    });
                } else if (title.toLowerCase().includes("eligible")) {
                    emailContent = getDonationReminderTemplate({
                        donorName,
                        nextEligibleDate: metadata.nextEligibleDate
                    });
                } else {
                    // Fallback system notification email
                    emailContent = {
                        subject: `REDhope - ${title}`,
                        html: `<p>Hello ${donorName},</p><p>${message}</p>`,
                        text: `Hello ${donorName},\n\n${message}\n\nREDhope Team`
                    };
                }
                break;

            default:
                emailContent = {
                    subject: `REDhope - ${title}`,
                    html: `<p>Hello ${donorName},</p><p>${message}</p>`,
                    text: `Hello ${donorName},\n\n${message}\n\nREDhope Team`
                };
        }

        if (!emailContent) {
            return {
                delivered: false,
                skipped: true,
                reason: "no template matched"
            };
        }

        // 4. Dispatch email via Brevo email service
        const sendResult = await sendEmail({
            to: {
                email: recipient.email,
                name: recipient.name
            },
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
        });

        if (!sendResult.success) {
            const safeError = sendResult.error || "delivery failed";
            if (!sendResult.skipped) {
                console.error(`Email delivery failed for notification ${notificationId || "N/A"}: ${safeError}`);
            }
            return {
                delivered: false,
                error: safeError,
                skipped: sendResult.skipped
            };
        }

        return {
            delivered: true,
            messageId: sendResult.messageId
        };

    } catch (deliveryError) {
        // Safe logging without exposing sensitive data
        console.error(`Email delivery error for notification ${notificationId || "N/A"}: ${deliveryError.message}`);
        return {
            delivered: false,
            error: deliveryError.message
        };
    }
}

module.exports = {
    deliverNotificationEmail
};


/**
 * REDhope Donation Service
 * 
 * Central business logic for recording blood donations, updating donation lifecycle,
 * synchronizing donor lastDonationDate, and integrating with the notification engine.
 */

const mongoose = require("mongoose");
const donation = require("../models/donation");
const user = require("../models/user");
const camp = require("../models/camp");
const campRegistration = require("../models/campRegistration");
const { createNotification } = require("./notificationService");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Calculates and updates donor.lastDonationDate to the latest completed donation date.
 * Guarantees that older historical donations do not overwrite newer lastDonationDate.
 * 
 * @param {string|mongoose.Types.ObjectId} donorId
 * @param {Date} [candidateDate] - The date of the newly completed donation
 * @returns {Promise<Date|null>} The resolved latest donation date
 */
async function syncDonorLastDonationDate(donorId, candidateDate = null) {
    const donorUser = await user.findById(donorId);
    if (!donorUser) {
        return null;
    }

    // Query all completed donations for this donor to find the newest donation date
    const completedDonations = await donation.find({
        donor: donorId,
        status: "completed"
    }).sort({ donationDate: -1 }).select("donationDate").lean();

    const dates = [];
    if (candidateDate) {
        const cDate = new Date(candidateDate);
        if (!isNaN(cDate.getTime())) dates.push(cDate.getTime());
    }
    if (donorUser.lastDonationDate) {
        const uDate = new Date(donorUser.lastDonationDate);
        if (!isNaN(uDate.getTime())) dates.push(uDate.getTime());
    }
    for (const d of completedDonations) {
        if (d.donationDate) {
            const dnDate = new Date(d.donationDate);
            if (!isNaN(dnDate.getTime())) dates.push(dnDate.getTime());
        }
    }

    if (dates.length === 0) {
        return null;
    }

    const maxTimestamp = Math.max(...dates);
    const resolvedLatestDate = new Date(maxTimestamp);

    // Only update if lastDonationDate is not set or the new date is later
    if (!donorUser.lastDonationDate || resolvedLatestDate.getTime() !== new Date(donorUser.lastDonationDate).getTime()) {
        await user.findByIdAndUpdate(donorId, {
            lastDonationDate: resolvedLatestDate
        });
    }

    return resolvedLatestDate;
}

/**
 * Records a new donation for an existing camp registration.
 * Accessible only to camp organizer owner or admin.
 * 
 * @param {Object} params
 * @param {string} params.registrationId - Camp registration ID
 * @param {Date|string} [params.donationDate] - Actual or scheduled donation date
 * @param {number} [params.units=1] - Number of units donated
 * @param {string} [params.notes=""] - Optional medical/administrative notes
 * @param {string} [params.status="scheduled"] - Initial status ('scheduled' or 'completed')
 * @param {string} params.recordedById - User ID recording the donation
 * @param {string} params.recordedByRole - Role of recorder ('organizer' or 'admin')
 * @returns {Promise<Object>} Created donation document
 */
async function recordDonation({
    registrationId,
    donationDate,
    units = 1,
    notes = "",
    status = "scheduled",
    recordedById,
    recordedByRole
}) {
    if (!registrationId || !mongoose.Types.ObjectId.isValid(registrationId)) {
        const err = new Error("valid registrationId is required");
        err.statusCode = 400;
        throw err;
    }

    // 1. Fetch registration with populated user and camp
    const reg = await campRegistration.findById(registrationId).populate("user camp");
    if (!reg) {
        const err = new Error("camp registration not found");
        err.statusCode = 404;
        throw err;
    }

    if (!reg.user) {
        const err = new Error("registered donor not found");
        err.statusCode = 404;
        throw err;
    }

    if (!reg.camp) {
        const err = new Error("associated camp not found");
        err.statusCode = 404;
        throw err;
    }

    if (reg.status === "cancelled") {
        const err = new Error("cannot record donation for a cancelled camp registration");
        err.statusCode = 400;
        throw err;
    }

    // 2. Authorization check: recorder must be the camp organizer or admin
    const campOrganizerId = reg.camp.organizer ? reg.camp.organizer.toString() : null;
    if (recordedByRole !== "admin" && campOrganizerId !== recordedById.toString()) {
        const err = new Error("access denied: only the camp organizer or admin can record donations");
        err.statusCode = 403;
        throw err;
    }

    // 3. Enforce single donation per registration
    const existingDonation = await donation.findOne({ registration: registrationId });
    if (existingDonation) {
        const err = new Error("a donation record already exists for this registration");
        err.statusCode = 409;
        throw err;
    }

    // 4. Validate initial status if provided
    const validInitialStatuses = ["scheduled", "completed"];
    if (status && !validInitialStatuses.includes(status)) {
        const err = new Error(`initial donation status must be 'scheduled' or 'completed'`);
        err.statusCode = 400;
        throw err;
    }

    // 5. Validate units
    const parsedUnits = Number(units);
    if (!Number.isInteger(parsedUnits) || parsedUnits < 1) {
        const err = new Error("units must be an integer >= 1");
        err.statusCode = 400;
        throw err;
    }

    // 6. Validate and resolve donationDate
    let resolvedDonationDate = new Date();
    if (donationDate) {
        const d = new Date(donationDate);
        if (isNaN(d.getTime())) {
            const err = new Error("invalid donationDate format");
            err.statusCode = 400;
            throw err;
        }
        const maxFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        if (d > maxFuture) {
            const err = new Error("donationDate cannot be more than 1 year in the future");
            err.statusCode = 400;
            throw err;
        }
        resolvedDonationDate = d;
    }

    // 7. Secure snapshot derivation: derive donor, camp, and bloodGroup from server documents
    const donorId = reg.user._id;
    const campId = reg.camp._id;
    const bloodGroupSnapshot = reg.user.bloodGroup;

    if (!bloodGroupSnapshot) {
        const err = new Error("donor user does not have a valid blood group recorded");
        err.statusCode = 400;
        throw err;
    }

    const isCompleted = status === "completed";
    const verifiedAt = isCompleted ? new Date() : null;

    const newDonation = await donation.create({
        donor: donorId,
        camp: campId,
        registration: reg._id,
        donationDate: resolvedDonationDate,
        units: parsedUnits,
        bloodGroup: bloodGroupSnapshot,
        status: status || "scheduled",
        notes: typeof notes === "string" ? notes.trim() : "",
        recordedBy: recordedById,
        verifiedAt
    });

    // 8. If recorded directly as completed, update lastDonationDate and notify donor
    if (isCompleted) {
        await syncDonorLastDonationDate(donorId, resolvedDonationDate);

        // Emit in-app notification
        try {
            await createNotification({
                userId: donorId,
                type: "system",
                title: "Donation Recorded",
                message: `Your blood donation at ${reg.camp.name} has been recorded.`,
                metadata: {
                    donationId: newDonation._id.toString(),
                    campId: campId.toString(),
                    campName: reg.camp.name,
                    donationDate: resolvedDonationDate,
                    units: parsedUnits,
                    bloodGroup: bloodGroupSnapshot
                },
                eventKey: `donation-completed:${newDonation._id}`
            });
        } catch (notifErr) {
            console.error("Donation recording notification error:", notifErr);
        }
    }

    return newDonation;
}

/**
 * Updates donation status through the defined lifecycle state machine:
 * scheduled -> completed
 * scheduled -> cancelled
 * scheduled -> no_show
 * 
 * @param {Object} params
 * @param {string} params.donationId
 * @param {string} params.newStatus - 'completed', 'cancelled', or 'no_show'
 * @param {string} [params.notes]
 * @param {string} params.updatedById
 * @param {string} params.updatedByRole
 * @returns {Promise<Object>} Updated donation document
 */
async function updateDonationStatus({
    donationId,
    newStatus,
    notes,
    updatedById,
    updatedByRole
}) {
    if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
        const err = new Error("valid donation ID is required");
        err.statusCode = 400;
        throw err;
    }

    const { VALID_DONATION_STATUSES } = donation;
    if (!newStatus || !VALID_DONATION_STATUSES.includes(newStatus)) {
        const err = new Error(`invalid status: must be one of ${VALID_DONATION_STATUSES.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }

    const existingDonation = await donation.findById(donationId).populate("camp donor");
    if (!existingDonation) {
        const err = new Error("donation record not found");
        err.statusCode = 404;
        throw err;
    }

    // Authorization check: organizer must own camp, or admin
    const campOrganizerId = existingDonation.camp && existingDonation.camp.organizer
        ? existingDonation.camp.organizer.toString()
        : null;

    if (updatedByRole !== "admin" && campOrganizerId !== updatedById.toString()) {
        const err = new Error("access denied: only the camp organizer or admin can update donation status");
        err.statusCode = 403;
        throw err;
    }

    const currentStatus = existingDonation.status;

    // Idempotency: if already in requested status, return safely without duplicate side effects
    if (currentStatus === newStatus) {
        return existingDonation;
    }

    // Terminal state protection: completed donations cannot be arbitrarily reverted
    if (currentStatus === "completed") {
        const err = new Error("cannot change status of an already completed donation");
        err.statusCode = 400;
        throw err;
    }

    // Terminal state protection: cancelled or no_show cannot be changed
    if (currentStatus === "cancelled" || currentStatus === "no_show") {
        const err = new Error(`cannot change status of a donation that is already marked as ${currentStatus}`);
        err.statusCode = 400;
        throw err;
    }

    // Allowed transitions from 'scheduled': completed, cancelled, no_show
    if (currentStatus !== "scheduled") {
        const err = new Error(`invalid transition from '${currentStatus}' to '${newStatus}'`);
        err.statusCode = 400;
        throw err;
    }

    // Apply status update
    existingDonation.status = newStatus;
    if (typeof notes === "string") {
        existingDonation.notes = notes.trim();
    }

    if (newStatus === "completed") {
        existingDonation.verifiedAt = new Date();
        await existingDonation.save();

        // Safely update donor's lastDonationDate (latest completed date rule)
        await syncDonorLastDonationDate(existingDonation.donor._id, existingDonation.donationDate);

        // Dispatch in-app notification to donor
        try {
            await createNotification({
                userId: existingDonation.donor._id,
                type: "system",
                title: "Donation Recorded",
                message: `Your blood donation at ${existingDonation.camp ? existingDonation.camp.name : "the camp"} has been recorded.`,
                metadata: {
                    donationId: existingDonation._id.toString(),
                    campId: existingDonation.camp ? existingDonation.camp._id.toString() : null,
                    campName: existingDonation.camp ? existingDonation.camp.name : "Camp",
                    donationDate: existingDonation.donationDate,
                    units: existingDonation.units,
                    bloodGroup: existingDonation.bloodGroup
                },
                eventKey: `donation-completed:${existingDonation._id}`
            });
        } catch (notifErr) {
            console.error("Donation completion notification error:", notifErr);
        }
    } else {
        // cancelled or no_show: DO NOT touch lastDonationDate, DO NOT set verifiedAt
        await existingDonation.save();
    }

    return existingDonation;
}

/**
 * Retrieves paginated donation history for the authenticated donor.
 * Excludes sensitive internal fields.
 * 
 * @param {string|mongoose.Types.ObjectId} donorId
 * @param {Object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<Object>} Paginated donation records
 */
async function getDonorDonationHistory(donorId, { page = 1, limit = DEFAULT_LIMIT } = {}) {
    if (!donorId || !mongoose.Types.ObjectId.isValid(donorId)) {
        const err = new Error("valid donor ID is required");
        err.statusCode = 400;
        throw err;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
    const skip = (pageNum - 1) * limitNum;

    const query = { donor: donorId };

    const [donations, total] = await Promise.all([
        donation.find(query)
            .populate("camp", "_id name location startDate endDate")
            .sort({ donationDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        donation.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    const formattedDonations = donations.map((d) => ({
        _id: d._id,
        camp: d.camp,
        donationDate: d.donationDate,
        units: d.units,
        bloodGroup: d.bloodGroup,
        status: d.status,
        notes: d.notes,
        verifiedAt: d.verifiedAt,
        createdAt: d.createdAt
    }));

    return {
        donations: formattedDonations,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages
        }
    };
}

/**
 * Retrieves donation records for a specific camp.
 * Restricted to camp organizer owner or admin.
 * 
 * @param {string} campId
 * @param {Object} options
 * @param {string} [options.status="all"]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} options.requesterId
 * @param {string} options.requesterRole
 * @returns {Promise<Object>} Paginated camp donations with summary metrics
 */
async function getCampDonations(campId, {
    status = "all",
    page = 1,
    limit = DEFAULT_LIMIT,
    requesterId,
    requesterRole
}) {
    if (!campId || !mongoose.Types.ObjectId.isValid(campId)) {
        const err = new Error("invalid camp ID");
        err.statusCode = 400;
        throw err;
    }

    if (requesterRole !== "organizer" && requesterRole !== "admin") {
        const err = new Error("access denied");
        err.statusCode = 403;
        throw err;
    }

    const targetCamp = await camp.findById(campId);
    if (!targetCamp) {
        const err = new Error("camp not found");
        err.statusCode = 404;
        throw err;
    }

    if (requesterRole === "organizer" && targetCamp.organizer.toString() !== requesterId.toString()) {
        const err = new Error("access denied: only the camp organizer or admin can view camp donations");
        err.statusCode = 403;
        throw err;
    }

    const allowedStatuses = ["scheduled", "completed", "cancelled", "no_show", "all"];
    if (status && !allowedStatuses.includes(status)) {
        const err = new Error(`invalid status filter: must be one of ${allowedStatuses.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }

    const query = { camp: campId };
    if (status && status !== "all") {
        query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
    const skip = (pageNum - 1) * limitNum;

    const [donations, total, countsByStatus] = await Promise.all([
        donation.find(query)
            .populate("donor", "_id name email phone bloodGroup gender location")
            .populate("registration", "_id status registeredAt")
            .sort({ donationDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        donation.countDocuments(query),
        donation.aggregate([
            { $match: { camp: new mongoose.Types.ObjectId(campId) } },
            { $group: { _id: "$status", count: { $sum: 1 }, units: { $sum: "$units" } } }
        ])
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    // Summary stats
    let scheduledCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;
    let totalCompletedUnits = 0;

    for (const s of countsByStatus) {
        if (s._id === "scheduled") scheduledCount = s.count;
        if (s._id === "completed") {
            completedCount = s.count;
            totalCompletedUnits = s.units || 0;
        }
        if (s._id === "cancelled") cancelledCount = s.count;
        if (s._id === "no_show") noShowCount = s.count;
    }

    return {
        donations,
        stats: {
            scheduled: scheduledCount,
            completed: completedCount,
            cancelled: cancelledCount,
            noShow: noShowCount,
            totalCompletedUnits
        },
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages
        }
    };
}

module.exports = {
    recordDonation,
    updateDonationStatus,
    getDonorDonationHistory,
    getCampDonations,
    syncDonorLastDonationDate
};


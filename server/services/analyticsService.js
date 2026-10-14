/**
 * REDhope Analytics Service
 * 
 * Provides unified, read-only analytics aggregation derived directly from
 * MongoDB collections (Camp, CampRegistration, Donation, User, BloodRequest).
 * 
 * Strictly enforces authorization boundaries:
 * - Organizer: Restricts camp-related datasets strictly to camps owned by that organizer.
 * - Admin: Aggregates system-wide data across all camps and includes system donor/request metrics.
 * 
 * Never returns donor PII (passwords, emails, phone numbers, exact coordinates).
 */

const mongoose = require("mongoose");
const camp = require("../models/camp");
const campRegistration = require("../models/campRegistration");
const donation = require("../models/donation");
const user = require("../models/user");
const bloodRequest = require("../models/bloodRequest");
const HealthScreening = require("../models/healthScreening");

const ALL_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ALL_CAMP_STATUSES = ["draft", "published", "completed", "cancelled"];

/**
 * Validates and parses optional 'from' and 'to' date parameters.
 * Throws 400 Error with descriptive message if invalid.
 */
function parseDateFilter({ from, to }) {
    let fromDate = null;
    let toDate = null;

    if (from !== undefined && from !== null && from !== "") {
        fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
            const err = new Error("invalid 'from' date format");
            err.statusCode = 400;
            throw err;
        }
    }

    if (to !== undefined && to !== null && to !== "") {
        toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
            const err = new Error("invalid 'to' date format");
            err.statusCode = 400;
            throw err;
        }
    }

    if (fromDate && toDate && fromDate > toDate) {
        const err = new Error("'from' date cannot be after 'to' date");
        err.statusCode = 400;
        throw err;
    }

    return { fromDate, toDate };
}

/**
 * Computes comprehensive analytics.
 * 
 * @param {Object} params
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.userRole - "organizer" or "admin"
 * @param {string} [params.from] - Optional start date
 * @param {string} [params.to] - Optional end date
 * @returns {Promise<Object>} Formatted analytics payload
 */
async function getAnalytics({ userId, userRole, from, to }) {
    if (userRole !== "organizer" && userRole !== "admin") {
        const err = new Error("access denied: only organizers and admins can access analytics");
        err.statusCode = 403;
        throw err;
    }

    const { fromDate, toDate } = parseDateFilter({ from, to });

    // 1. Build camp query scope
    const campMatch = {};
    if (userRole === "organizer") {
        campMatch.organizer = new mongoose.Types.ObjectId(userId);
    }

    if (fromDate || toDate) {
        campMatch.startDate = {};
        if (fromDate) campMatch.startDate.$gte = fromDate;
        if (toDate) campMatch.startDate.$lte = toDate;
    }

    // Retrieve scoped camps
    const scopedCamps = await camp.find(campMatch)
        .select("_id name capacity status startDate registrationCount")
        .lean();

    const scopedCampIds = scopedCamps.map((c) => c._id);

    // 2. Camp Summary & Status Distribution
    const totalCamps = scopedCamps.length;
    let draftCamps = 0;
    let publishedCamps = 0;
    let completedCamps = 0;
    let cancelledCamps = 0;
    let totalCapacity = 0;

    for (const c of scopedCamps) {
        totalCapacity += Number(c.capacity) || 0;
        if (c.status === "draft") draftCamps++;
        else if (c.status === "published") publishedCamps++;
        else if (c.status === "completed") completedCamps++;
        else if (c.status === "cancelled") cancelledCamps++;
    }

    const campStatusDistribution = ALL_CAMP_STATUSES.map((status) => {
        let count = 0;
        if (status === "draft") count = draftCamps;
        else if (status === "published") count = publishedCamps;
        else if (status === "completed") count = completedCamps;
        else if (status === "cancelled") count = cancelledCamps;
        return { status, count };
    });

    // 3. Registrations Analytics
    let totalRegistrations = 0;
    let activeRegistrations = 0;
    let cancelledRegistrations = 0;
    let registrationTrend = [];
    let registrationsByBloodGroup = [];

    // Map of blood group -> count initialized to 0 for all standard blood groups
    const registrationBloodGroupMap = {};
    ALL_BLOOD_GROUPS.forEach((bg) => { registrationBloodGroupMap[bg] = 0; });

    if (scopedCampIds.length > 0) {
        // Status counts for registrations
        const regStatusCounts = await campRegistration.aggregate([
            { $match: { camp: { $in: scopedCampIds } } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        for (const r of regStatusCounts) {
            totalRegistrations += r.count;
            if (r._id === "registered") activeRegistrations = r.count;
            else if (r._id === "cancelled") cancelledRegistrations = r.count;
        }

        // Monthly registration trend
        registrationTrend = await campRegistration.aggregate([
            { $match: { camp: { $in: scopedCampIds } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$registeredAt" } },
                    registrations: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    period: "$_id",
                    registrations: 1
                }
            }
        ]);

        // Blood group distribution across registered donors
        const regBloodGroups = await campRegistration.aggregate([
            { $match: { camp: { $in: scopedCampIds } } },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "donor"
                }
            },
            { $unwind: "$donor" },
            {
                $group: {
                    _id: "$donor.bloodGroup",
                    count: { $sum: 1 }
                }
            }
        ]);

        for (const r of regBloodGroups) {
            if (r._id && registrationBloodGroupMap[r._id] !== undefined) {
                registrationBloodGroupMap[r._id] = r.count;
            }
        }
    }

    registrationsByBloodGroup = ALL_BLOOD_GROUPS.map((bg) => ({
        bloodGroup: bg,
        count: registrationBloodGroupMap[bg] || 0
    }));

    // 4. Capacity Utilization
    const capacityUtilization = totalCapacity > 0
        ? Number(((activeRegistrations / totalCapacity) * 100).toFixed(1))
        : 0;

    // 5. Donation Analytics
    let totalDonations = 0;
    let completedDonations = 0;
    let scheduledDonations = 0;
    let cancelledDonations = 0;
    let noShowDonations = 0;
    let totalUnitsDonated = 0;
    let donationsByBloodGroup = [];
    let donationMonthlyTrend = [];

    const donationBloodGroupMap = {};
    ALL_BLOOD_GROUPS.forEach((bg) => { donationBloodGroupMap[bg] = { count: 0, units: 0 }; });

    // Camp-specific donation stats map for topCamps computation
    const campDonationStats = {}; // campId -> { completedDonations: 0, units: 0 }
    const campActiveRegStats = {}; // campId -> count

    if (scopedCampIds.length > 0) {
        // Aggregate active registrations by camp
        const regPerCamp = await campRegistration.aggregate([
            { $match: { camp: { $in: scopedCampIds }, status: "registered" } },
            { $group: { _id: "$camp", count: { $sum: 1 } } }
        ]);
        for (const r of regPerCamp) {
            campActiveRegStats[r._id.toString()] = r.count;
        }

        // Aggregate donations per camp
        const donationsPerCamp = await donation.aggregate([
            { $match: { camp: { $in: scopedCampIds }, status: "completed" } },
            { $group: { _id: "$camp", count: { $sum: 1 }, units: { $sum: "$units" } } }
        ]);
        for (const d of donationsPerCamp) {
            campDonationStats[d._id.toString()] = { count: d.count, units: d.units || 0 };
        }

        // Summary donation statuses
        const donationStatusCounts = await donation.aggregate([
            { $match: { camp: { $in: scopedCampIds } } },
            { $group: { _id: "$status", count: { $sum: 1 }, units: { $sum: "$units" } } }
        ]);

        for (const d of donationStatusCounts) {
            totalDonations += d.count;
            if (d._id === "completed") {
                completedDonations = d.count;
                totalUnitsDonated = d.units || 0;
            } else if (d._id === "scheduled") {
                scheduledDonations = d.count;
            } else if (d._id === "cancelled") {
                cancelledDonations = d.count;
            } else if (d._id === "no_show") {
                noShowDonations = d.count;
            }
        }

        // Completed donations by blood group
        const donBloodGroups = await donation.aggregate([
            { $match: { camp: { $in: scopedCampIds }, status: "completed" } },
            { $group: { _id: "$bloodGroup", count: { $sum: 1 }, units: { $sum: "$units" } } }
        ]);

        for (const d of donBloodGroups) {
            if (d._id && donationBloodGroupMap[d._id]) {
                donationBloodGroupMap[d._id] = { count: d.count, units: d.units || 0 };
            }
        }

        // Monthly donation trend (completed donations)
        donationMonthlyTrend = await donation.aggregate([
            { $match: { camp: { $in: scopedCampIds }, status: "completed" } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$donationDate" } },
                    donations: { $sum: 1 },
                    units: { $sum: "$units" }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    period: "$_id",
                    donations: 1,
                    units: 1
                }
            }
        ]);
    }

    donationsByBloodGroup = ALL_BLOOD_GROUPS.map((bg) => ({
        bloodGroup: bg,
        count: donationBloodGroupMap[bg]?.count || 0,
        units: donationBloodGroupMap[bg]?.units || 0
    }));

    // 6. Top Performing Camps
    const topCamps = scopedCamps.map((c) => {
        const cIdStr = c._id.toString();
        const activeRegs = campActiveRegStats[cIdStr] || 0;
        const cap = Number(c.capacity) || 0;
        const donStats = campDonationStats[cIdStr] || { count: 0, units: 0 };
        const util = cap > 0 ? Number(((activeRegs / cap) * 100).toFixed(1)) : 0;

        return {
            campId: c._id.toString(),
            name: c.name,
            capacity: cap,
            registrations: activeRegs,
            utilization: util,
            completedDonations: donStats.count,
            donatedUnits: donStats.units
        };
    })
    .sort((a, b) => (b.completedDonations - a.completedDonations) || (b.registrations - a.registrations))
    .slice(0, 10);

    // 7. Admin-Only Aggregations (Global user & blood request stats)
    let userMetrics = null;
    let bloodRequestMetrics = null;

    if (userRole === "admin") {
        // Aggregate real platform user & health stats without returning any PII
        const [
            totalUsersCount,
            totalDonorsCount,
            totalOrganizersCount,
            totalAdminsCount,
            availableDonorsCount,
            eligibleDonorsCount,
            deferredDonorsCount,
            pendingReviewsCount,
            usersByGroupAgg,
            userRegTrendAgg,
            screeningStatusAgg
        ] = await Promise.all([
            user.countDocuments({}),
            user.countDocuments({ role: "user" }),
            user.countDocuments({ role: "organizer" }),
            user.countDocuments({ role: "admin" }),
            user.countDocuments({ isDonorAvailable: true }),
            user.countDocuments({ role: "user", isEligible: true }),
            user.countDocuments({ role: "user", isEligible: false }),
            HealthScreening.countDocuments({ status: { $in: ["submitted", "under_review", "pending_review"] } }),
            user.aggregate([
                { $group: { _id: "$bloodGroup", count: { $sum: 1 } } }
            ]),
            user.aggregate([
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, period: "$_id", registrations: "$count" } }
            ]),
            HealthScreening.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ])
        ]);

        const userGroupMap = {};
        ALL_BLOOD_GROUPS.forEach((bg) => { userGroupMap[bg] = 0; });
        for (const g of usersByGroupAgg) {
            if (g._id && userGroupMap[g._id] !== undefined) {
                userGroupMap[g._id] = g.count;
            }
        }

        const screeningMap = {};
        for (const s of screeningStatusAgg) {
            if (s._id) screeningMap[s._id] = s.count;
        }

        userMetrics = {
            totalUsers: totalUsersCount,
            totalRegisteredUsers: totalUsersCount,
            totalDonors: totalDonorsCount,
            totalOrganizers: totalOrganizersCount,
            totalAdmins: totalAdminsCount,
            availableDonors: availableDonorsCount,
            eligibleDonors: eligibleDonorsCount,
            deferredDonors: deferredDonorsCount,
            pendingMedicalReviews: pendingReviewsCount,
            usersByBloodGroup: ALL_BLOOD_GROUPS.map((bg) => ({
                bloodGroup: bg,
                count: userGroupMap[bg] || 0
            })),
            registrationTrend: userRegTrendAgg,
            screeningDistribution: [
                { name: "Approved / Eligible", value: screeningMap["approved"] || 0, color: "#10b981" },
                { name: "Pending Review", value: (screeningMap["submitted"] || 0) + (screeningMap["under_review"] || 0), color: "#3b82f6" },
                { name: "Needs Info", value: screeningMap["needs_information"] || 0, color: "#f59e0b" },
                { name: "Temp Deferred", value: screeningMap["temporarily_deferred"] || 0, color: "#ef4444" },
                { name: "Perm Deferred", value: screeningMap["permanently_deferred"] || 0, color: "#991b1b" },
                { name: "Incomplete / Draft", value: screeningMap["draft"] || 0, color: "#64748b" }
            ]
        };

        // Aggregate Blood Requests
        const [totalReqs, statusCounts, reqsByGroupAgg, reqTrend] = await Promise.all([
            bloodRequest.countDocuments({}),
            bloodRequest.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
            bloodRequest.aggregate([
                { $group: { _id: "$bloodGroup", count: { $sum: 1 } } }
            ]),
            bloodRequest.aggregate([
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, period: "$_id", count: 1 } }
            ])
        ]);

        let activeReqs = 0;
        let fulfilledReqs = 0;
        let cancelledReqs = 0;
        for (const s of statusCounts) {
            if (s._id === "active") activeReqs = s.count;
            else if (s._id === "fulfilled") fulfilledReqs = s.count;
            else if (s._id === "cancelled") cancelledReqs = s.count;
        }

        const reqGroupMap = {};
        ALL_BLOOD_GROUPS.forEach((bg) => { reqGroupMap[bg] = 0; });
        for (const g of reqsByGroupAgg) {
            if (g._id && reqGroupMap[g._id] !== undefined) {
                reqGroupMap[g._id] = g.count;
            }
        }

        bloodRequestMetrics = {
            totalRequests: totalReqs,
            activeRequests: activeReqs,
            fulfilledRequests: fulfilledReqs,
            cancelledRequests: cancelledReqs,
            requestsByBloodGroup: ALL_BLOOD_GROUPS.map((bg) => ({
                bloodGroup: bg,
                count: reqGroupMap[bg] || 0
            })),
            monthlyTrend: reqTrend
        };
    }

    return {
        summary: {
            totalCamps,
            draftCamps,
            publishedCamps,
            completedCamps,
            cancelledCamps,
            totalCapacity,
            totalRegistrations,
            activeRegistrations,
            cancelledRegistrations,
            capacityUtilization,
            totalDonations,
            completedDonations,
            scheduledDonations,
            cancelledDonations,
            noShowDonations,
            totalUnitsDonated
        },
        capacity: {
            totalCapacity,
            activeRegistrations,
            totalRegistrations,
            utilizationPercentage: capacityUtilization
        },
        registrations: {
            total: totalRegistrations,
            active: activeRegistrations,
            cancelled: cancelledRegistrations,
            trend: registrationTrend,
            byBloodGroup: registrationsByBloodGroup
        },
        donations: {
            totalDonations,
            completedDonations,
            scheduledDonations,
            cancelledDonations,
            noShowDonations,
            totalUnitsDonated,
            monthlyTrend: donationMonthlyTrend,
            bloodGroupDistribution: donationsByBloodGroup
        },
        bloodGroups: registrationsByBloodGroup,
        monthlyTrend: registrationTrend,
        topCamps,
        campStatus: campStatusDistribution,
        // Backward compatibility mirrors
        registrationTrend,
        bloodGroupDistribution: registrationsByBloodGroup,
        campStatusDistribution,
        // Role-gated metadata
        scope: userRole,
        ...(userRole === "admin" ? { userMetrics, bloodRequestMetrics } : {})
    };
}

module.exports = {
    getAnalytics,
    parseDateFilter
};


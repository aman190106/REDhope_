const mongoose = require("mongoose");
const camp = require("../models/camp");
const campRegistration = require("../models/campRegistration");
const user = require("../models/user");
const HealthScreening = require("../models/healthScreening");
const { evaluateEligibility } = require("../services/eligibilityService");
const { createNotification } = require("../services/notificationService");

/**
 * Checks whether a camp has already started based on its startDate and startTime.
 * Date format is assumed to be India / standard local date comparison.
 */
function isCampStarted(campDoc) {
    const start = new Date(campDoc.startDate);
    if (isNaN(start.getTime())) return false;

    let [hours, minutes] = [0, 0];
    if (campDoc.startTime && typeof campDoc.startTime === "string") {
        const parts = campDoc.startTime.split(":").map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            hours = parts[0];
            minutes = parts[1];
        }
    }

    // Set camp exact start timestamp
    const campStartTime = new Date(start);
    campStartTime.setHours(hours, minutes, 0, 0);

    return new Date() >= campStartTime;
}

// ─────────────────────────────────────────────
// POST /camps/:campId/register
// ─────────────────────────────────────────────
const registerForCamp = async (req, res) => {
    try {
        const { campId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 1. Role requirement: Only normal users/donors can register
        if (userRole !== "user") {
            return res.status(403).json({
                success: false,
                message: "only donors with 'user' role can register for camps"
            });
        }

        // 2. Validate campId ObjectId format
        if (!mongoose.Types.ObjectId.isValid(campId)) {
            return res.status(400).json({
                success: false,
                message: "invalid camp ID"
            });
        }

        // 3. Find target camp
        const targetCamp = await camp.findById(campId);
        if (!targetCamp) {
            return res.status(404).json({
                success: false,
                message: "camp not found"
            });
        }

        // 4. Validate camp status
        if (targetCamp.status !== "published") {
            return res.status(400).json({
                success: false,
                message: `cannot register for camp with status '${targetCamp.status}'`
            });
        }

        // 5. Validate camp has not already started
        if (isCampStarted(targetCamp)) {
            return res.status(400).json({
                success: false,
                message: "registration closed: camp has already started"
            });
        }

        // 6. Check eligibility using the authoritative Eligibility Service
        const donorUser = await user.findById(userId).select("-password");
        if (!donorUser) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        const latestScreening = await HealthScreening.findOne({ user: userId }).sort({ createdAt: -1 });
        const eligibility = evaluateEligibility(donorUser, {
            screening: latestScreening,
            requireScreening: targetCamp.requireHealthScreening === true
        });
        if (!eligibility.isMedicallyEligible) {
            return res.status(400).json({
                success: false,
                message: "donor is not medically eligible to register",
                reasons: eligibility.reasons,
                nextEligibleDate: eligibility.nextEligibleDate
            });
        }

        if (!eligibility.isDonorAvailable) {
            return res.status(400).json({
                success: false,
                message: "donor is currently marked as unavailable in profile settings",
                reasons: ["Donor availability is set to false"]
            });
        }

        // 7. Check for existing active registration
        const existingReg = await campRegistration.findOne({ user: userId, camp: campId });
        if (existingReg && existingReg.status === "registered") {
            return res.status(409).json({
                success: false,
                message: "user is already registered for this camp"
            });
        }

        // 8. Atomic capacity increment & registration creation/reactivation
        // Atomically increment registrationCount IF registrationCount < capacity
        const updatedCamp = await camp.findOneAndUpdate(
            {
                _id: campId,
                status: "published",
                $expr: { $lt: ["$registrationCount", "$capacity"] }
            },
            {
                $inc: { registrationCount: 1 }
            },
            {
                returnDocument: "after"
            }
        );

        if (!updatedCamp) {
            return res.status(400).json({
                success: false,
                message: "camp is at full capacity"
            });
        }

        // Safely create or reactivate registration
        let registrationDoc;
        try {
            if (existingReg) {
                // Reactivate cancelled registration
                existingReg.status = "registered";
                existingReg.registeredAt = new Date();
                existingReg.cancelledAt = null;
                registrationDoc = await existingReg.save();
            } else {
                // Create new registration
                registrationDoc = await campRegistration.create({
                    user: userId,
                    camp: campId,
                    status: "registered",
                    registeredAt: new Date()
                });
            }
        } catch (regError) {
            // Roll back the atomic increment if registration creation failed (e.g. duplicate key race)
            await camp.findByIdAndUpdate(campId, { $inc: { registrationCount: -1 } });

            if (regError.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "user is already registered for this camp"
                });
            }
            throw regError;
        }

        // Trigger in-app notification for the donor (non-blocking for registration result)
        try {
            const campDateStr = updatedCamp.startDate ? new Date(updatedCamp.startDate).toLocaleDateString() : "upcoming date";
            const venue = (updatedCamp.location && (updatedCamp.location.address || updatedCamp.location.city)) || "Camp Venue";
            const regTimestamp = registrationDoc.registeredAt ? new Date(registrationDoc.registeredAt).getTime() : Date.now();
            await createNotification({
                userId,
                type: "camp_registration",
                title: "Camp Registration Confirmed",
                message: `You have successfully registered for ${updatedCamp.name} on ${campDateStr}. Location: ${venue}.`,
                metadata: {
                    campId: updatedCamp._id.toString(),
                    registrationId: registrationDoc._id.toString(),
                    campName: updatedCamp.name,
                    startDate: updatedCamp.startDate,
                    endDate: updatedCamp.endDate,
                    location: updatedCamp.location,
                    address: venue
                },
                eventKey: `camp-registration:${campId}:${registrationDoc._id}:${regTimestamp}`
            });
        } catch (notifError) {
            console.error("Camp registration notification error:", notifError);
        }

        return res.status(201).json({
            success: true,
            message: "registered for camp successfully",
            data: {
                registration: {
                    _id: registrationDoc._id,
                    camp: registrationDoc.camp,
                    status: registrationDoc.status,
                    registeredAt: registrationDoc.registeredAt
                },
                camp: {
                    _id: updatedCamp._id,
                    name: updatedCamp.name,
                    registrationCount: updatedCamp.registrationCount,
                    capacity: updatedCamp.capacity
                }
            }
        });

    } catch (error) {
        console.error("registerForCamp error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// GET /camps/:campId/registrations/me
// ─────────────────────────────────────────────
const getMyRegistration = async (req, res) => {
    try {
        const { campId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(campId)) {
            return res.status(400).json({
                success: false,
                message: "invalid camp ID"
            });
        }

        const registration = await campRegistration.findOne({ user: userId, camp: campId });
        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "no registration found for this camp"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                registration: {
                    _id: registration._id,
                    camp: registration.camp,
                    status: registration.status,
                    registeredAt: registration.registeredAt,
                    cancelledAt: registration.cancelledAt
                }
            }
        });

    } catch (error) {
        console.error("getMyRegistration error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// DELETE /camps/:campId/register (Cancel registration)
// ─────────────────────────────────────────────
const cancelRegistration = async (req, res) => {
    try {
        const { campId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(campId)) {
            return res.status(400).json({
                success: false,
                message: "invalid camp ID"
            });
        }

        const registration = await campRegistration.findOne({ user: userId, camp: campId });
        if (!registration || registration.status !== "registered") {
            return res.status(404).json({
                success: false,
                message: "no active registration found to cancel"
            });
        }

        // Atomically update registration status to 'cancelled' to prevent double cancellations
        const updatedReg = await campRegistration.findOneAndUpdate(
            {
                _id: registration._id,
                status: "registered"
            },
            {
                status: "cancelled",
                cancelledAt: new Date()
            },
            {
                returnDocument: "after"
            }
        );

        if (!updatedReg) {
            return res.status(400).json({
                success: false,
                message: "registration is already cancelled"
            });
        }

        // Atomically decrement camp.registrationCount without dropping below 0
        const updatedCamp = await camp.findOneAndUpdate(
            {
                _id: campId,
                registrationCount: { $gt: 0 }
            },
            {
                $inc: { registrationCount: -1 }
            },
            {
                returnDocument: "after"
            }
        );

        // Trigger in-app cancellation notification for the donor
        try {
            const cancelTimestamp = updatedReg.cancelledAt ? new Date(updatedReg.cancelledAt).getTime() : Date.now();
            await createNotification({
                userId,
                type: "camp_registration",
                title: "Camp Registration Cancelled",
                message: `Your registration for ${updatedCamp ? updatedCamp.name : "the blood donation camp"} has been cancelled.`,
                metadata: {
                    campId: campId.toString(),
                    registrationId: updatedReg._id.toString(),
                    campName: updatedCamp ? updatedCamp.name : "Blood Donation Camp",
                    location: updatedCamp ? updatedCamp.location : undefined
                },
                eventKey: `camp-cancellation:${campId}:${updatedReg._id}:${cancelTimestamp}`
            });
        } catch (notifError) {
            console.error("Camp cancellation notification error:", notifError);
        }

        return res.status(200).json({
            success: true,
            message: "registration cancelled successfully",
            data: {
                registration: {
                    _id: updatedReg._id,
                    camp: updatedReg.camp,
                    status: updatedReg.status,
                    cancelledAt: updatedReg.cancelledAt
                },
                camp: updatedCamp ? {
                    _id: updatedCamp._id,
                    name: updatedCamp.name,
                    registrationCount: updatedCamp.registrationCount,
                    capacity: updatedCamp.capacity
                } : null
            }
        });

    } catch (error) {
        console.error("cancelRegistration error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// GET /camps/:campId/registrations (Organizer/Admin View)
// ─────────────────────────────────────────────
const getCampRegistrations = async (req, res) => {
    try {
        const { campId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 1. Role requirement: Normal users must NOT access this list
        if (userRole !== "organizer" && userRole !== "admin") {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        // 2. Validate campId ObjectId format
        if (!mongoose.Types.ObjectId.isValid(campId)) {
            return res.status(400).json({
                success: false,
                message: "invalid camp ID"
            });
        }

        // 3. Find target camp
        const targetCamp = await camp.findById(campId);
        if (!targetCamp) {
            return res.status(404).json({
                success: false,
                message: "camp not found"
            });
        }

        // 4. Authorization check: Organizer must own the camp; admin can view any camp
        if (userRole === "organizer" && targetCamp.organizer.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        // 5. Query status filter:
        // status query can be 'registered' (default), 'cancelled', or 'all'
        const statusParam = req.query.status || "registered";
        const allowedStatuses = ["registered", "cancelled", "all"];
        if (!allowedStatuses.includes(statusParam)) {
            return res.status(400).json({
                success: false,
                message: "invalid status parameter: must be 'registered', 'cancelled', or 'all'"
            });
        }

        const filter = { camp: campId };
        if (statusParam !== "all") {
            filter.status = statusParam;
        }

        // 6. Pagination handling
        const rawPage = parseInt(req.query.page, 10);
        const rawLimit = parseInt(req.query.limit, 10);

        const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
        let limit = !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : 20;
        if (limit > 100) {
            limit = 100;
        }

        const skip = (page - 1) * limit;

        // Count total matching registrations
        const total = await campRegistration.countDocuments(filter);
        const totalPages = Math.ceil(total / limit) || 1;

        // 7. Query registrations:
        // Sorted by registeredAt ascending
        // Populate safe donor fields only (explicitly excluding passwords, JWT, internal fields)
        const registrations = await campRegistration.find(filter)
            .sort({ registeredAt: 1 })
            .skip(skip)
            .limit(limit)
            .populate(
                "user",
                "_id name bloodGroup gender phone location.city location.state location.pincode"
            )
            .select("_id user camp status registeredAt cancelledAt");

        return res.status(200).json({
            success: true,
            data: {
                camp: {
                    _id: targetCamp._id,
                    name: targetCamp.name,
                    capacity: targetCamp.capacity,
                    registrationCount: targetCamp.registrationCount,
                    status: targetCamp.status
                },
                registrations,
                count: registrations.length,
                page,
                limit,
                total,
                totalPages
            }
        });

    } catch (error) {
        console.error("getCampRegistrations error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    registerForCamp,
    getMyRegistration,
    cancelRegistration,
    getCampRegistrations
};


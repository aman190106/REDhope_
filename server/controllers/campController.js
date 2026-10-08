const mongoose = require("mongoose");
const camp = require("../models/camp");

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Valid status transitions:
 * draft -> published, cancelled
 * published -> completed, cancelled
 * completed -> none (immutable)
 * cancelled -> none (immutable)
 */
const ALLOWED_TRANSITIONS = {
    draft: ["published", "cancelled"],
    published: ["completed", "cancelled"],
    completed: [],
    cancelled: []
};

/**
 * Helper to check date/time logic:
 * 1. endDate >= startDate
 * 2. If same day, endTime must be strictly after startTime
 * 3. If publishing, startDate must not be in the past
 */
function validateDateTimeRules(startDateVal, endDateVal, startTimeVal, endTimeVal, isPublishing = false) {
    const start = new Date(startDateVal);
    const end = new Date(endDateVal);

    if (isNaN(start.getTime())) {
        return "invalid startDate format";
    }
    if (isNaN(end.getTime())) {
        return "invalid endDate format";
    }

    if (!TIME_REGEX.test(startTimeVal)) {
        return "startTime must be in HH:mm format (e.g. 09:00)";
    }
    if (!TIME_REGEX.test(endTimeVal)) {
        return "endTime must be in HH:mm format (e.g. 17:00)";
    }

    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);

    if (endDay < startDay) {
        return "endDate cannot be before startDate";
    }

    // Same-day check
    if (endDay.getTime() === startDay.getTime()) {
        const [startH, startM] = startTimeVal.split(":").map(Number);
        const [endH, endM] = endTimeVal.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (endMinutes <= startMinutes) {
            return "endTime must be after startTime for same-day camps";
        }
    }

    if (isPublishing) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startDay < today) {
            return "published camps must not have a start date in the past";
        }
    }

    return null;
}

/**
 * Helper to validate location fields
 */
function validateLocation(loc) {
    if (!loc || typeof loc !== "object") {
        return "location must be an object";
    }
    if (!loc.address || typeof loc.address !== "string" || !loc.address.trim()) {
        return "location.address is required";
    }
    if (!loc.city || typeof loc.city !== "string" || !loc.city.trim()) {
        return "location.city is required";
    }
    if (!loc.state || typeof loc.state !== "string" || !loc.state.trim()) {
        return "location.state is required";
    }
    if (!loc.pincode || !PINCODE_REGEX.test(loc.pincode)) {
        return "location.pincode must be a valid 6-digit Indian pincode";
    }

    if (loc.coordinates !== undefined) {
        if (!Array.isArray(loc.coordinates) || loc.coordinates.length !== 2) {
            return "location.coordinates must be [longitude, latitude]";
        }
        const [lng, lat] = loc.coordinates;
        if (
            typeof lng !== "number" || typeof lat !== "number" ||
            lng < -180 || lng > 180 ||
            lat < -90 || lat > 90
        ) {
            return "location.coordinates must be valid [longitude, latitude] numbers";
        }
    }

    return null;
}

// ─────────────────────────────────────────────
// POST /camps
// ─────────────────────────────────────────────
const createCamp = async (req, res) => {
    try {
        const userRole = req.user.role;
        if (userRole !== "organizer" && userRole !== "admin") {
            return res.status(403).json({
                success: false,
                message: "only organizers and admins can create camps"
            });
        }

        const {
            name,
            description,
            location,
            startDate,
            endDate,
            startTime,
            endTime,
            capacity,
            status
        } = req.body;

        if (!name || typeof name !== "string" || name.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: "camp name must be at least 3 characters"
            });
        }

        const locErr = validateLocation(location);
        if (locErr) {
            return res.status(400).json({
                success: false,
                message: locErr
            });
        }

        if (!startDate || !endDate || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "startDate, endDate, startTime, and endTime are required"
            });
        }

        const initialStatus = status === "published" ? "published" : "draft";
        const dtErr = validateDateTimeRules(
            startDate,
            endDate,
            startTime,
            endTime,
            initialStatus === "published"
        );
        if (dtErr) {
            return res.status(400).json({
                success: false,
                message: dtErr
            });
        }

        if (capacity === undefined || capacity === null || Number(capacity) < 1) {
            return res.status(400).json({
                success: false,
                message: "capacity must be at least 1"
            });
        }

        const locData = {
            address: location.address.trim(),
            city: location.city.trim(),
            state: location.state.trim(),
            pincode: location.pincode.trim()
        };

        if (location.coordinates && location.coordinates.length === 2) {
            locData.type = "Point";
            locData.coordinates = location.coordinates;
        }

        // Organizer is ALWAYS taken strictly from authenticated req.user.id
        const newCamp = await camp.create({
            name: name.trim(),
            description: description ? description.trim() : undefined,
            organizer: req.user.id,
            location: locData,
            startDate,
            endDate,
            startTime,
            endTime,
            capacity: Number(capacity),
            registrationCount: 0,
            status: initialStatus
        });

        // Populate safe organizer fields
        const populatedCamp = await camp.findById(newCamp._id)
            .populate("organizer", "_id name");

        return res.status(201).json({
            success: true,
            message: "camp created successfully",
            camp: populatedCamp
        });

    } catch (error) {
        console.error("createCamp error:", error);
        if (error.name === "ValidationError") {
            const firstMsg = Object.values(error.errors)[0]?.message || "validation failed";
            return res.status(400).json({
                success: false,
                message: firstMsg
            });
        }
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// GET /camps (Public with optional filters)
// ─────────────────────────────────────────────
const getCamps = async (req, res) => {
    try {
        const { city, state, from, to, status } = req.query;

        const query = {};

        // By default, public endpoint only returns published camps
        if (status) {
            // Only admins or organizers looking at their own drafts can see drafts
            if (status === "draft") {
                if (!req.user || (req.user.role !== "admin" && req.user.role !== "organizer")) {
                    return res.status(403).json({
                        success: false,
                        message: "unauthorized to view draft camps"
                    });
                }
                query.status = "draft";
                if (req.user.role === "organizer") {
                    query.organizer = req.user.id;
                }
            } else {
                query.status = status;
            }
        } else {
            query.status = "published";
        }

        if (city) {
            query["location.city"] = new RegExp(`^${city.trim()}$`, "i");
        }

        if (state) {
            query["location.state"] = new RegExp(`^${state.trim()}$`, "i");
        }

        if (from || to) {
            query.startDate = {};
            if (from) {
                const fromDate = new Date(from);
                if (!isNaN(fromDate.getTime())) {
                    query.startDate.$gte = fromDate;
                }
            }
            if (to) {
                const toDate = new Date(to);
                if (!isNaN(toDate.getTime())) {
                    query.startDate.$lte = toDate;
                }
            }
        }

        const campsList = await camp.find(query)
            .populate("organizer", "_id name")
            .sort({ startDate: 1 });

        return res.status(200).json({
            success: true,
            count: campsList.length,
            camps: campsList
        });

    } catch (error) {
        console.error("getCamps error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// GET /camps/:id
// ─────────────────────────────────────────────
const getCampById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid camp ID"
            });
        }

        const foundCamp = await camp.findById(id)
            .populate("organizer", "_id name");

        if (!foundCamp) {
            return res.status(404).json({
                success: false,
                message: "camp not found"
            });
        }

        // Privacy & status check:
        // If camp is draft, only owning organizer or admin can view it
        if (foundCamp.status === "draft") {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            const isOwner = userId && foundCamp.organizer._id.toString() === userId;
            const isAdmin = userRole === "admin";

            if (!isOwner && !isAdmin) {
                return res.status(404).json({
                    success: false,
                    message: "camp not found"
                });
            }
        }

        return res.status(200).json({
            success: true,
            camp: foundCamp
        });

    } catch (error) {
        console.error("getCampById error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// PUT /camps/:id
// ─────────────────────────────────────────────
const updateCamp = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid camp ID"
            });
        }

        const existingCamp = await camp.findById(id);
        if (!existingCamp) {
            return res.status(404).json({
                success: false,
                message: "camp not found"
            });
        }

        // Ownership / Authorization
        const userRole = req.user.role;
        const userId = req.user.id;
        const isOwner = existingCamp.organizer.toString() === userId;
        const isAdmin = userRole === "admin";

        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        // Once completed or cancelled, a camp cannot be edited
        if (existingCamp.status === "completed" || existingCamp.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: `cannot edit a ${existingCamp.status} camp`
            });
        }

        const {
            name,
            description,
            location,
            startDate,
            endDate,
            startTime,
            endTime,
            capacity,
            status,
            organizer,
            registrationCount,
            createdAt
        } = req.body;

        // Disallow direct tampering with protected system fields
        if (organizer !== undefined && organizer.toString() !== existingCamp.organizer.toString()) {
            return res.status(403).json({
                success: false,
                message: "cannot change camp organizer"
            });
        }

        if (registrationCount !== undefined && Number(registrationCount) !== existingCamp.registrationCount) {
            return res.status(403).json({
                success: false,
                message: "cannot directly modify registrationCount"
            });
        }

        // Check status transition
        if (status !== undefined && status !== existingCamp.status) {
            const allowedNextStatuses = ALLOWED_TRANSITIONS[existingCamp.status] || [];
            if (!allowedNextStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `invalid status transition from ${existingCamp.status} to ${status}`
                });
            }
        }

        const targetStatus = status !== undefined ? status : existingCamp.status;

        // Date and Time Validation
        const targetStartDate = startDate !== undefined ? startDate : existingCamp.startDate;
        const targetEndDate = endDate !== undefined ? endDate : existingCamp.endDate;
        const targetStartTime = startTime !== undefined ? startTime : existingCamp.startTime;
        const targetEndTime = endTime !== undefined ? endTime : existingCamp.endTime;

        const dtErr = validateDateTimeRules(
            targetStartDate,
            targetEndDate,
            targetStartTime,
            targetEndTime,
            targetStatus === "published"
        );
        if (dtErr) {
            return res.status(400).json({
                success: false,
                message: dtErr
            });
        }

        // Build update object
        const updateData = {};
        if (name !== undefined) {
            if (name.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    message: "camp name must be at least 3 characters"
                });
            }
            updateData.name = name.trim();
        }

        if (description !== undefined) {
            updateData.description = description.trim();
        }

        if (location !== undefined) {
            const locErr = validateLocation(location);
            if (locErr) {
                return res.status(400).json({
                    success: false,
                    message: locErr
                });
            }
            const locData = {
                address: location.address.trim(),
                city: location.city.trim(),
                state: location.state.trim(),
                pincode: location.pincode.trim()
            };
            if (location.coordinates && location.coordinates.length === 2) {
                locData.type = "Point";
                locData.coordinates = location.coordinates;
            }
            updateData.location = locData;
        }

        if (startDate !== undefined) updateData.startDate = startDate;
        if (endDate !== undefined) updateData.endDate = endDate;
        if (startTime !== undefined) updateData.startTime = startTime;
        if (endTime !== undefined) updateData.endTime = endTime;

        if (capacity !== undefined) {
            if (Number(capacity) < 1) {
                return res.status(400).json({
                    success: false,
                    message: "capacity must be at least 1"
                });
            }
            if (Number(capacity) < existingCamp.registrationCount) {
                return res.status(400).json({
                    success: false,
                    message: "capacity cannot be less than existing registrationCount"
                });
            }
            updateData.capacity = Number(capacity);
        }

        if (status !== undefined) {
            updateData.status = status;
        }

        const updatedCamp = await camp.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate("organizer", "_id name");

        return res.status(200).json({
            success: true,
            message: "camp updated successfully",
            camp: updatedCamp
        });

    } catch (error) {
        console.error("updateCamp error:", error);
        if (error.name === "ValidationError") {
            const firstMsg = Object.values(error.errors)[0]?.message || "validation failed";
            return res.status(400).json({
                success: false,
                message: firstMsg
            });
        }
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// DELETE /camps/:id
// ─────────────────────────────────────────────
const deleteCamp = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid camp ID"
            });
        }

        const existingCamp = await camp.findById(id);
        if (!existingCamp) {
            return res.status(404).json({
                success: false,
                message: "camp not found"
            });
        }

        // Ownership / Authorization
        const userRole = req.user.role;
        const userId = req.user.id;
        const isOwner = existingCamp.organizer.toString() === userId;
        const isAdmin = userRole === "admin";

        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        // If registrations exist, block hard-delete
        if (existingCamp.registrationCount > 0) {
            return res.status(400).json({
                success: false,
                message: "cannot delete camp with registered donors; cancel the camp instead"
            });
        }

        await camp.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "camp deleted successfully"
        });

    } catch (error) {
        console.error("deleteCamp error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    createCamp,
    getCamps,
    getCampById,
    updateCamp,
    deleteCamp
};


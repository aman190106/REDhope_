/**
 * REDhope Donation Controller
 * Handles HTTP requests for blood donation tracking.
 */

const mongoose = require("mongoose");
const donationService = require("../services/donationService");
const donationModel = require("../models/donation");

/**
 * POST /donations
 * Records a donation for a registered donor at a camp.
 * Organizer/Admin only.
 */
const recordDonation = async (req, res) => {
    try {
        const { role, id: userId } = req.user;

        if (role !== "organizer" && role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "access denied: only organizers and admins can record donations"
            });
        }

        const { registrationId, donationDate, units, notes, status } = req.body;

        if (!registrationId) {
            return res.status(400).json({
                success: false,
                message: "registrationId is required"
            });
        }

        const newDonation = await donationService.recordDonation({
            registrationId,
            donationDate,
            units,
            notes,
            status,
            recordedById: userId,
            recordedByRole: role
        });

        return res.status(201).json({
            success: true,
            message: "donation recorded successfully",
            data: {
                donation: newDonation
            }
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        console.error("recordDonation error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * PATCH /donations/:id/status
 * Updates status of a donation (completed, cancelled, no_show).
 * Organizer/Admin only.
 */
const updateDonationStatus = async (req, res) => {
    try {
        const { role, id: userId } = req.user;

        if (role !== "organizer" && role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "access denied: only organizers and admins can update donation status"
            });
        }

        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "status is required"
            });
        }

        const updatedDonation = await donationService.updateDonationStatus({
            donationId: id,
            newStatus: status,
            notes,
            updatedById: userId,
            updatedByRole: role
        });

        return res.status(200).json({
            success: true,
            message: "donation status updated successfully",
            data: {
                donation: updatedDonation
            }
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        console.error("updateDonationStatus error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /donations/me
 * Retrieves current user's personal donation history.
 * Authenticated users only.
 */
const getMyDonations = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page, limit } = req.query;

        const result = await donationService.getDonorDonationHistory(userId, { page, limit });

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        console.error("getMyDonations error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /camps/:campId/donations or GET /donations/camp/:campId
 * Retrieves donation records for a specific camp.
 * Organizer owner or admin only.
 */
const getCampDonations = async (req, res) => {
    try {
        const { campId } = req.params;
        const { role, id: userId } = req.user;
        const { status, page, limit } = req.query;

        const result = await donationService.getCampDonations(campId, {
            status,
            page,
            limit,
            requesterId: userId,
            requesterRole: role
        });

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        console.error("getCampDonations error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

/**
 * GET /donations/:id
 * Retrieves a single donation record.
 * Allowed for the donor, camp organizer owner, or admin.
 */
const getDonationById = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, id: userId } = req.user;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid donation ID"
            });
        }

        const foundDonation = await donationModel.findById(id)
            .populate("camp", "_id name location startDate endDate organizer")
            .populate("donor", "_id name email phone bloodGroup gender")
            .populate("registration", "_id status registeredAt");

        if (!foundDonation) {
            return res.status(404).json({
                success: false,
                message: "donation not found"
            });
        }

        // Authorization check
        const isDonor = foundDonation.donor && foundDonation.donor._id.toString() === userId;
        const isOrganizer = foundDonation.camp && foundDonation.camp.organizer && foundDonation.camp.organizer.toString() === userId;
        const isAdmin = role === "admin";

        if (!isDonor && !isOrganizer && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                donation: foundDonation
            }
        });

    } catch (error) {
        console.error("getDonationById error:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    recordDonation,
    updateDonationStatus,
    getMyDonations,
    getCampDonations,
    getDonationById
};


const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    recordDonation,
    updateDonationStatus,
    getMyDonations,
    getCampDonations,
    getDonationById
} = require("../controllers/donationController");

// Current authenticated user's donation history (MUST come before /:id)
router.get("/me", authMiddleware, getMyDonations);

// Camp-scoped donations lookup
router.get("/camp/:campId", authMiddleware, getCampDonations);

// Create new donation record (organizer / admin)
router.post("/", authMiddleware, recordDonation);

// Get single donation by ID
router.get("/:id", authMiddleware, getDonationById);

// Update donation status (completed, cancelled, no_show)
router.patch("/:id/status", authMiddleware, updateDonationStatus);

module.exports = router;


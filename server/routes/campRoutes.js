const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");
const {
    createCamp,
    getCamps,
    getNearbyCamps,
    getCampAnalytics,
    getCampById,
    updateCamp,
    deleteCamp
} = require("../controllers/campController");
const { getCampDonations } = require("../controllers/donationController");
const {
    getCampScreenings,
    getCampScreeningWorkspace,
    saveCampScreening,
    streamCampMedicalDocument
} = require("../controllers/campScreeningController");

// Public list of camps (uses optional auth to let organizers/admins filter drafts)
router.get("/", optionalAuthMiddleware, getCamps);

// Public nearby camps discovery (geospatial query with longitude, latitude, radius)
router.get("/nearby", getNearbyCamps);

// Protected organizer/admin analytics endpoint (MUST come before /:id)
router.get("/analytics", authMiddleware, getCampAnalytics);

// Protected organizer/admin camp donations endpoint
router.get("/:campId/donations", authMiddleware, getCampDonations);

// Protected organizer/admin camp screening endpoints
router.get("/:campId/screenings", authMiddleware, getCampScreenings);
router.get("/:campId/screenings/:registrationId", authMiddleware, getCampScreeningWorkspace);
router.put("/:campId/screenings/:registrationId", authMiddleware, saveCampScreening);
router.post("/:campId/screenings/:registrationId", authMiddleware, saveCampScreening);
router.get("/:campId/screenings/:registrationId/documents/:documentId", authMiddleware, streamCampMedicalDocument);

// Public camp details (uses optional auth to enforce draft visibility to owner/admin)
router.get("/:id", optionalAuthMiddleware, getCampById);

// Protected routes (require authMiddleware)
router.post("/", authMiddleware, createCamp);
router.put("/:id", authMiddleware, updateCamp);
router.delete("/:id", authMiddleware, deleteCamp);

module.exports = router;


const express = require("express");
const router = express.Router({ mergeParams: true });
const authMiddleware = require("../middleware/authMiddleware");
const {
    registerForCamp,
    getMyRegistration,
    cancelRegistration,
    getCampRegistrations
} = require("../controllers/campRegistrationController");

// POST /camps/:campId/register - Register authenticated donor for a camp
router.post("/:campId/register", authMiddleware, registerForCamp);

// GET /camps/:campId/registrations/me - Get current user's registration for this camp
router.get("/:campId/registrations/me", authMiddleware, getMyRegistration);

// DELETE /camps/:campId/register - Cancel current user's registration for this camp
router.delete("/:campId/register", authMiddleware, cancelRegistration);

// GET /camps/:campId/registrations - Organizer/Admin view of registered donors
router.get("/:campId/registrations", authMiddleware, getCampRegistrations);

module.exports = router;


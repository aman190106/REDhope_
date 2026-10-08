const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getMyEligibility } = require("../controllers/eligibilityController");

// GET /eligibility/me - Get eligibility evaluation for authenticated user
router.get("/me", authMiddleware, getMyEligibility);

module.exports = router;


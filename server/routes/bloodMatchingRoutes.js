const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    matchDonors,
    createRequirement,
    getRequirements
} = require("../controllers/bloodMatchingController");

// POST /matching/donors - Find compatible, eligible, and available blood donors
router.post("/donors", authMiddleware, matchDonors);

// Blood requirement endpoints
router.post("/requests", authMiddleware, createRequirement);
router.get("/requests", authMiddleware, getRequirements);

module.exports = router;


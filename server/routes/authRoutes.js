const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getMe, updateMe } = require("../controllers/authcontroller");
const authMiddleware = require("../middleware/authMiddleware");

// Public Authentication Routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Authenticated Current User Profile Routes
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);

module.exports = router;

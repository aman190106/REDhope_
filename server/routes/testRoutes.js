const express = require("express");
const router = express.Router();

const { registerUser, getAllUsers, getUserById } = require("../controllers/authcontroller");

// Register User
router.post("/test", registerUser);
router.post("/users", registerUser);

// Get all users
router.get("/users", getAllUsers);

// Get User by ID
router.get("/users/:id", getUserById);

// Search User
router.get("/search", (req, res) => {
    console.log(req.query);

    res.json({
        success: true,
        filter: req.query
    });
});

module.exports = router;

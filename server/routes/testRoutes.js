const express = require("express");
const router = express.Router();

const { registerUser, getAllUsers } = require("../controllers/authcontroller");

// Register User
router.post("/test", registerUser);

// Get all users
router.get("/users", getAllUsers);

// Get User by ID
router.get("/user/:id", (req,res) => {
    console.log(req.params);

    res.json({
        success: true,
        userID: req.params.id
    });
});

// Search User
router.get("/search", (req, res) => {
    console.log(req.query);

    res.json({
        success: true,
        filter: req.query
    });
});

module.exports = router;

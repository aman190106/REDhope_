const express = require("express");
const router = express.Router();

const { registerUser } = require("../controllers/authController");

// Register User
router.post("/test", registerUser);
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
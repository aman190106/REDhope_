const express = require("express");
const router = express.Router();

const { registerUser, getAllUsers, getUserById, updateUser, deleteUser } = require("../controllers/authcontroller");
const authMiddleware = require("../middleware/authMiddleware");

// Register User (Public)
router.post("/test", registerUser);
router.post("/users", registerUser);

// Protected User CRUD Routes
router.get("/users", authMiddleware, getAllUsers);
router.get("/users/:id", authMiddleware, getUserById);
router.put("/users/:id", authMiddleware, updateUser);
router.delete("/users/:id", authMiddleware, deleteUser);

// Search User
router.get("/search", (req, res) => {
    console.log(req.query);

    res.json({
        success: true,
        filter: req.query
    });
});

module.exports = router;

const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const healthScreeningController = require("../controllers/healthScreeningController");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const router = express.Router();

// All health screening endpoints require authenticated session
router.use(authMiddleware);

// User screening lifecycle
router.get("/me", healthScreeningController.getMyScreening);
router.put("/me", healthScreeningController.updateMyScreening);
router.post("/me/submit", healthScreeningController.submitMyScreening);
router.post("/", healthScreeningController.updateMyScreening);

// Medical document management
router.post("/me/documents", upload.single("file"), healthScreeningController.uploadDocument);
router.get("/me/documents", healthScreeningController.getMyDocuments);
router.delete("/me/documents/:documentId", healthScreeningController.deleteMyDocument);

// Secure private document download
router.get("/documents/:documentId", healthScreeningController.downloadMyDocument);

module.exports = router;


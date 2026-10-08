const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminHealthScreeningController = require("../controllers/adminHealthScreeningController");

const router = express.Router();

// Administrative and clinical reviewer endpoints
router.use(authMiddleware);

router.get("/", adminHealthScreeningController.listHealthScreenings);
router.get("/:id", adminHealthScreeningController.getHealthScreeningDetails);
router.get("/:id/documents/:documentId", adminHealthScreeningController.downloadDocumentAdmin);
router.patch("/:id/review", adminHealthScreeningController.reviewHealthScreening);

module.exports = router;


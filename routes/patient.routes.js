const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const patientController = require("../controllers/patient.controller");
const authController = require("../controllers/auth.controller");


// Local signup & login
router.post("/signup", authController.signup);
router.post("/login", authController.login);

// Patient dashboard (protected)
router.get("/dashboard", protect, patientController.getDashboard);

module.exports = router;

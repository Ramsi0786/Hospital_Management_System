const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const patientController = require("../controllers/patient.controller");
const authController = require("../controllers/auth.controller");


// Local signup & login
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/verify-otp", authController.verifyOtp);

// Patient dashboard (protected)
router.get("/dashboard", protect, patientController.getDashboard);

router.get("/forgot-password", (req, res) =>
  res.render("patient/forgot-password", { 
    title: "Forgot Password - Healora", 
    email: "",
    token: "",
    error: null, 
    success: null })
);
router.post("/forgot-password", authController.forgotPassword);

router.get("/reset-password", authController.renderResetPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;

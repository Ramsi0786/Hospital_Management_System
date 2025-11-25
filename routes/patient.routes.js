const express = require("express");
const router = express.Router();
const {protect, checkAuth} = require("../middleware/auth.middleware");
const patientController = require("../controllers/patient.controller");
const authController = require("../controllers/auth.controller");



router.use(checkAuth);


// ==================== AUTHENTICATION ROUTES ====================

router.get("/signup", (req, res) => res.render("patient/patient-signup"));
router.post("/signup", authController.signup);

router.get("/login", (req, res) => res.render("patient/patient-login"));
router.post("/login", authController.login);

router.get("/logout", authController.logout);
router.post("/logout", authController.logout)

router.get("/verify-otp", (req, res) => {
  res.render("patient/verify-otp");
});

router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);

router.get("/forgot-password", authController.renderForgotPassword);
router.post("/forgot-password", authController.forgotPassword);


router.get("/reset-password", authController.renderResetPassword);
router.post("/reset-password", authController.resetPassword);


// ==================== PROTECTED ROUTES ====================


router.get("/dashboard", protect, patientController.getDashboard);

module.exports = router;
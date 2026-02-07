import express from "express";
const router = express.Router();
import { protect, checkAuth } from "../middleware/auth.middleware.js";
import * as patientController from "../controllers/patient.controller.js";
import * as authController from "../controllers/auth/patient.auth.controller.js";

// ==================== PUBLIC ROUTES (with checkAuth) ====================

router.get("/signup", checkAuth, (req, res) => res.render("patient/patient-signup"));
router.post("/signup", authController.signup);

router.get("/login", checkAuth, (req, res) => res.render("patient/patient-login"));
router.post("/login", authController.login);

router.get("/verify-otp", authController.requireOtpSession,(req, res) => {
    res.render("patient/verify-otp");
  }
);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);

router.get("/forgot-password", checkAuth, authController.renderForgotPassword);
router.post("/forgot-password", authController.forgotPassword);

router.get("/reset-password", authController.renderResetPassword);
router.post("/reset-password", authController.resetPassword);

// ==================== PROTECTED ROUTES ====================

router.get("/setup-password", protect, (req, res) => {
  res.render("patient/setup-password", { title: "Setup Password - Healora" });
});
router.post("/setup-password", protect, authController.setupPassword);

router.get("/dashboard", protect, patientController.getDashboard);

// ==================== LOGOUT ====================

router.get("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.redirect('/patient/login');
});

router.post("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  res.json({ success: true });
});

export default router;

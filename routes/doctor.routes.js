import express from "express";
const router = express.Router();
import { protectDoctor, checkAuth } from "../middleware/auth.middleware.js";
import * as doctorController from "../controllers/doctor.controller.js";
import * as authController from "../controllers/auth/doctor.auth.controller.js";

// ==================== PUBLIC ROUTES ====================

router.get("/login", checkAuth, (req, res) => res.render("doctor/login"));
router.post("/login", authController.login);

router.get("/forgot-password", checkAuth, authController.renderForgotPassword);
router.post("/forgot-password", authController.forgotPassword);

router.get("/reset-password", authController.renderResetPassword);
router.post("/reset-password", authController.resetPassword);

// ==================== PROTECTED ROUTES ====================

router.get("/dashboard", protectDoctor, doctorController.getDashboard);

// ==================== LOGOUT ====================

router.get("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.redirect('/doctor/login');
});

router.post("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  res.json({ success: true });
});

export default router;
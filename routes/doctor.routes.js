import express from "express";
const router = express.Router();
import { protectDoctor, checkAuth } from "../middleware/auth.middleware.js";
import * as doctorController from "../controllers/doctor.controller.js";
import * as authController from "../controllers/auth/doctor.auth.controller.js";

// ==================== PUBLIC ROUTES ====================
router.route('/login')
  .get(checkAuth, (req, res) => res.render("doctor/login"))
  .post(authController.login);

router.route('/forgot-password')
  .get(checkAuth, authController.renderForgotPassword)
  .post(authController.forgotPassword);

router.route('/reset-password')
  .get(authController.renderResetPassword)
  .post(authController.resetPassword);

// ==================== PROTECTED ROUTES ====================

router.use(protectDoctor); 

router.route('/dashboard')
  .get(doctorController.getDashboard);

router.route('/logout')
  .get((req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'strict'
    });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.redirect('/doctor/login');
  })
  .post((req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'strict'
    });
    res.json({ success: true });
  });

export default router;
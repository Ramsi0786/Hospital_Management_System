import express from "express";
const router = express.Router();
import { protect, checkAuth } from "../middleware/auth.middleware.js";
import * as patientController from "../controllers/patient.controller.js";
import * as authController from "../controllers/auth/patient.auth.controller.js";
import * as doctorsController from "../controllers/patient.controller.js";

// ==================== PUBLIC ROUTES ====================

router.route('/signup')
  .get(checkAuth, (req, res) => res.render("patient/patient-signup"))
  .post(authController.signup);

router.route('/login')
  .get(checkAuth, (req, res) => res.render("patient/patient-login"))
  .post(authController.login);

router.route('/verify-otp')
  .get(authController.requireOtpSession, (req, res) => {
    res.render("patient/verify-otp");
  })
  .post(authController.verifyOtp);

router.route('/resend-otp')
  .post(authController.resendOtp);

router.route('/forgot-password')
  .get(checkAuth, authController.renderForgotPassword)
  .post(authController.forgotPassword);

router.route('/reset-password')
  .get(authController.renderResetPassword)
  .post(authController.resetPassword);


// ==================== PROTECTED ROUTES ====================

router.use(protect); 

router.route('/dashboard')
  .get(patientController.getDashboard);

router.route('/doctors') 
  .get(doctorsController.getAllDoctors);

router.route('/doctors/:id')
  .get(doctorsController.getDoctorDetails);

router.route('/setup-password')
  .get((req, res) => {
    res.render("patient/setup-password", { title: "Setup Password - Healora" });
  })
  .post(authController.setupPassword);

router.route('/logout')
  .get(authController.logout)
  .post(authController.logout);

export default router;
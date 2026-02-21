import express from "express";
const router = express.Router();
import { protect, checkAuth } from "../middleware/auth.middleware.js";
import * as patientController from "../controllers/patient.controller.js";
import * as authController from "../controllers/auth/patient.auth.controller.js";
import { uploadProfileImage, deleteProfileImage } from '../controllers/upload.controller.js';

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

router.post('/resend-otp', authController.resendOtp);

router.route('/forgot-password')
  .get(checkAuth, authController.renderForgotPassword)
  .post(authController.forgotPassword);

router.route('/reset-password')
  .get(authController.renderResetPassword)
  .post(authController.resetPassword);

// ==================== PROTECTED ROUTES ====================
router.use(protect); 

router.get('/dashboard', patientController.getDashboard);

router.get('/doctors', patientController.getAllDoctors);
router.get('/doctors/:id', patientController.getDoctorDetails);

router.route('/setup-password')
  .get((req, res) => {
    res.render("patient/setup-password", { title: "Setup Password - Healora" });
  })
  .post(authController.setupPassword);

router.get('/profile', (req, res) => {
  res.render('patient/profile-settings', { 
    patient: req.user, 
    user:req.user,
    title: 'My Profile - Healora',
    currentPage: 'profile'
  });
});

router.get('/profile-settings', (req, res) => {
  res.render('patient/profile-settings', { 
    patient: req.user, 
    user:req.user,
    title: 'Profile Settings',
    currentPage: 'profile'
  });
});

router.post('/upload-profile-image', uploadProfileImage);
router.delete('/delete-profile-image', deleteProfileImage);
router.put('/update-profile', patientController.updatePatientProfile);


router.route('/logout')
  .get(authController.logout)
  .post(authController.logout);

export default router;
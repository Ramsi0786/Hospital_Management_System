import express from "express";
const router = express.Router();
import { protect, checkAuth } from "../middleware/auth.middleware.js";
import * as patientController from "../controllers/patient.controller.js";
import * as authController from "../controllers/auth/patient.auth.controller.js";
import * as bookingController from "../controllers/booking.controller.js";
import { uploadProfileImage, deleteProfileImage } from '../controllers/upload.controller.js';


router.route('/signup')
  .get(checkAuth, (req, res) => res.render("patient/patient-signup"))
  .post(authController.signup);

router.route('/login')
  .get(checkAuth, (req, res) => res.render("patient/patient-login"))
  .post(authController.login);

router.route('/verify-otp')
  .get(authController.requireOtpSession, (req, res) => res.render("patient/verify-otp"))
  .post(authController.verifyOtp);

router.post('/resend-otp', authController.resendOtp);

router.route('/forgot-password')
  .get(checkAuth, authController.renderForgotPassword)
  .post(authController.forgotPassword);

router.route('/reset-password')
  .get(authController.renderResetPassword)
  .post(authController.resetPassword);

// ── Protected routes ─────────────────────────────────────────────────────────

router.use(protect);

router.get('/dashboard', patientController.getDashboard);

router.get('/doctors',            patientController.getAllDoctors);
router.get('/doctors/:id/slots',  patientController.getDoctorSlots);
router.get('/doctors/:id',        patientController.getDoctorDetails);

router.get('/appointments',                       patientController.getAppointments);
router.get('/appointments/book',                  bookingController.renderBookingPage);
router.post('/appointments/book',                 bookingController.createBooking);
router.post('/appointments/razorpay/create-order', bookingController.createRazorpayOrder);
router.post('/appointments/razorpay/verify',       bookingController.verifyRazorpayPayment);
router.get('/appointments/:id/success',            bookingController.bookingSuccess);
router.post('/appointments/:id/cancel',            bookingController.cancelAppointment);
router.get('/appointments/:id',                    patientController.getAppointmentDetail);

router.route('/setup-password')
  .get((req, res) => res.render("patient/setup-password", { title: "Setup Password - Healora" }))
  .post(authController.setupPassword);

router.get('/profile', (req, res) => res.render('patient/profile-settings', {
  patient:     req.user,
  user:        req.user,
  title:       'My Profile - Healora',
  currentPage: 'profile'
}));

router.post('/upload-profile-image',   uploadProfileImage);
router.delete('/delete-profile-image', deleteProfileImage);
router.put('/update-profile',          patientController.updatePatientProfile);

router.get('/wallet',                        bookingController.getWallet);
router.post('/wallet/topup/create-order',    bookingController.createTopupOrder);
router.post('/wallet/topup/verify',          bookingController.verifyTopup);

router.route('/logout')
  .get(authController.logout)
  .post(authController.logout);

export default router;
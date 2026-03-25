import express from 'express';
const router = express.Router();
import { protectDoctor, checkAuth } from '../middleware/auth.middleware.js';
import * as doctorController from '../controllers/doctor.controller.js';
import * as authController from '../controllers/auth/doctor.auth.controller.js';
import { uploadProfileImage, deleteProfileImage } from '../controllers/upload.controller.js';
import * as leaveController from '../controllers/leaveRequest.controller.js';

// ── Public ──
router.route('/login')
  .get(checkAuth, (req, res) => res.render('doctor/login'))
  .post(authController.login);

router.route('/forgot-password')
  .get(checkAuth, authController.renderForgotPassword)
  .post(authController.forgotPassword);

router.route('/reset-password')
  .get(authController.renderResetPassword)
  .post(authController.resetPassword);

// ── Protected ──
router.use(protectDoctor);

router.get('/dashboard', doctorController.getDashboard);

router.get('/profile', (req, res) => res.render('doctor/profile-settings', {
  title: 'My Profile - Healora', user: req.user,doctor: req.user, currentPage: 'profile'
}));
router.get('/profile-settings', (req, res) => res.render('doctor/profile-settings', {
  title: 'Profile Settings', user: req.user, doctor:req.user, currentPage: 'profile'
}));
router.post('/upload-profile-image', uploadProfileImage);
router.delete('/delete-profile-image', deleteProfileImage);
router.put('/update-profile', doctorController.updateDoctorProfile);

router.get('/appointments', doctorController.getAppointments);
router.patch('/appointments/:id/status', doctorController.updateAppointmentStatus);

router.get('/appointments/:appointmentId/prescription',  doctorController.getPrescription);
router.post('/appointments/:appointmentId/prescription', doctorController.savePrescription);

router.get('/patients', doctorController.getPatients);

router.get('/availability',   leaveController.getAvailabilityPage);
router.get('/leave/impact',   leaveController.getLeaveImpact);
router.post('/leave/request', leaveController.requestLeave);
router.get('/leave/requests', leaveController.getMyLeaveRequests);

router.get('/settings', (req, res) => res.render('doctor/settings', {
  title: 'Settings - Healora', user: req.user, currentPage: 'settings'
}));
router.post('/settings/change-password', doctorController.changeDoctorPassword);

router.get('/notifications',             doctorController.getDoctorNotifications);
router.patch('/notifications/read',      doctorController.markAllDoctorNotifsRead);
router.patch('/notifications/:id/read',  doctorController.markDoctorNotifRead);

// Logout
router.route('/logout')
  .get(authController.logout)
  .post(authController.logout);

export default router;
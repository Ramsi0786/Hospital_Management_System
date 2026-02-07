import express from "express";
const router = express.Router();
import * as adminAuthController from "../controllers/auth/admin.auth.controller.js";
import * as adminController from '../controllers/admin.controller.js';
import { adminProtect } from '../middleware/authAdmin.js';

// ==================== AUTH ROUTES ====================
router.get('/login', (req, res) => {
  res.render("admin/login", { title: "Admin Login - Healora" });
});
router.post('/login', adminAuthController.login);

router.get('/logout', (req, res) => {
  res.clearCookie('adminToken', {
    httpOnly: true,
    sameSite: 'strict'
  });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.redirect('/admin/login');
});

router.post('/logout', (req, res) => {
  res.clearCookie('adminToken', {
    httpOnly: true,
    sameSite: 'strict'
  });
  res.json({ success: true });
});

router.get("/dashboard", adminProtect, adminController.getDashboard);

// ==================== PATIENT MANAGEMENT ====================

router.get('/patients', adminProtect, (req, res) => {
  res.render('admin/patients', {
    title: 'Manage Patients - Healora Admin',
    admin: req.admin
  });
});

router.get('/patient/:id', adminProtect, adminController.getPatientById);

router.get('/api/patients', adminProtect, adminController.getAllPatients);
router.post('/api/patients', adminProtect, adminController.addPatient);
router.put('/api/patients/:id', adminProtect, adminController.updatePatient);
router.delete('/api/patients/:id', adminProtect, adminController.deletePatient);
router.put('/api/patients/:id/block', adminProtect, adminController.blockPatient);
router.patch('/api/patients/:id/unblock', adminProtect, adminController.unblockPatient);
router.patch('/api/patients/:id/reactivate', adminProtect, adminController.reactivatePatient);

// ==================== DOCTOR MANAGEMENT ====================

router.get('/doctors-management', adminProtect, (req, res) => {
  res.render('admin/doctors', {
    title: 'Manage Doctors - Healora Admin',
    admin: req.admin
  });
});

router.get('/doctor/:id', adminProtect, adminController.getDoctorById);
router.post('/add-doctor', adminProtect, adminController.addDoctor);
router.get('/doctors', adminProtect, adminController.getAllDoctors);
router.put('/doctor/:id', adminProtect, adminController.updateDoctor);
router.delete('/doctor/:id', adminProtect, adminController.deleteDoctor);


router.patch('/api/doctors/:id/block', adminProtect, adminController.blockDoctor);

// ==================== APPOINTMENTS ====================

router.get('/appointments', adminProtect, (req, res) => {
  res.render('admin/appointments', {
    title: 'Manage Appointments - Healora Admin',
    admin: req.admin
  });
});

// ==================== SETTINGS ====================

router.get('/settings', adminProtect, (req, res) => {
  res.render('admin/settings', {
    title: 'Manage Settings - Healora Admin',
    admin: req.admin
  });
});

export default router;
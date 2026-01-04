import express from "express";
const router = express.Router();
import * as adminAuthController from "../controllers/auth/admin.auth.controller.js";
import * as adminController from '../controllers/admin.controller.js';
import { adminProtect } from '../middleware/authAdmin.js';
import Patient from '../models/patient.model.js';

// ==================== AUTH ROUTES ====================
router.get('/login', (req, res) => {
  res.render("admin/login", { title: "Admin Login - Healora" });
});
router.post('/login', adminAuthController.login);

router.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.redirect('/admin/login');
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
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

router.get('/patient/:id', adminProtect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select('-password -googleId');
    
    if (!patient) {
      return res.redirect('/admin/patients');
    }
    
    res.render('admin/patient-profile', {
      title: `${patient.name} - Patient Profile`,
      admin: req.admin,
      patient: patient
    });
  } catch (error) {
    console.error('Error loading patient profile:', error);
    res.redirect('/admin/patients');
  }
});

router.get('/api/patients', adminProtect, adminController.getAllPatients);
router.post('/api/patients', adminProtect, adminController.addPatient);
router.put('/api/patients/:id', adminProtect, adminController.updatePatient);
router.delete('/api/patients/:id', adminProtect, adminController.deletePatient);
router.patch('/api/patients/:id/block', adminProtect, adminController.blockPatient);
router.patch('/api/patients/:id/unblock', adminProtect, adminController.unblockPatient);
router.patch('/api/patients/:id/reactivate', adminProtect, adminController.reactivatePatient);


// ==================== DOCTOR MANAGEMENT ====================

router.get('/doctors-management', adminProtect, (req, res) => {
  res.render('admin/doctors', {
    title: 'Manage Doctors - Healora Admin',
    admin: req.admin
  });
});

router.post('/add-doctor', adminProtect, adminController.addDoctor);
router.get('/doctors', adminProtect, adminController.getAllDoctors);
router.put('/doctor/:id', adminProtect, adminController.updateDoctor);
router.delete('/doctor/:id', adminProtect, adminController.deleteDoctor);

router.get('/patient/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).send('Patient not found');
    }

    res.render('admin/patient-profile', { 
      patient, 
      admin: req.session.admin,
      title: 'Patient Profile'
    });
  } catch (error) {
    console.error('Error loading patient profile:', error);
    res.status(500).send('Error loading patient profile');
  }
});

router.put('/api/patients/:id/block', async (req, res) => {
  try {
    const { block } = req.body;
    
    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { isBlocked: block },
      { new: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ 
      success: true,
      message: `Patient ${block ? 'blocked' : 'unblocked'} successfully`, 
      patient: updatedPatient 
    });
  } catch (error) {
    console.error('Error blocking/unblocking patient:', error);
    res.status(500).json({ error: 'Failed to update patient status' });
  }
});



router.get('/appointments', adminProtect, (req, res) => {
  res.render('admin/appointments', {
    title: 'Manage Appointments - Healora Admin',
    admin: req.admin
  });
});

router.get("/departments", async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });

    res.render("admin/departments", {
      admin: req.admin,
      departments 
    });
  } catch (error) {
    console.error("Error loading departments:", error);
    res.render("admin/departments", {
      admin: req.admin,
      departments: [] 
    });
  }
});


router.get('/settings', adminProtect, (req, res) => {
  res.render('admin/settings', {
    title: 'Manage Settings - Healora Admin',
    admin: req.admin
  });
});


export default router;

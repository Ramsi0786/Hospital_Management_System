import express from "express";
const router = express.Router();
import { adminProtect } from '../../middleware/authAdmin.js';
import * as adminController from '../../controllers/admin.controller.js';

import authRoutes from './auth.routes.js';
import patientRoutes from './patients.routes.js';
import doctorRoutes from './doctors.routes.js';
import departmentRoutes from './departments.routes.js';

router.use('/', authRoutes);
router.use(adminProtect);

router.get('/dashboard', adminController.getDashboard);
router.get('/patients', (req, res) => {
  res.render('admin/patients', {
    title: 'Manage Patients - Healora Admin',
    admin: req.admin
  });
});
router.get('/patient/:id', adminController.getPatientById);
router.get('/doctors-management', (req, res) => {
  res.render('admin/doctors', {
    title: 'Manage Doctors - Healora Admin',
    admin: req.admin
  });
});
router.get('/doctor/:id', adminController.getDoctorById);
router.get('/departments', (req, res) => {
  res.render('admin/departments', {
    title: 'Manage Departments - Healora Admin',
    admin: req.admin
  });
});

router.get('/department/:id', async (req, res) => {
  res.render('admin/department-detail', {
    title: 'Department Details - Healora Admin',
    admin: req.admin
  });
});

router.get('/appointments', (req, res) => {
  res.render('admin/appointments', {
    title: 'Manage Appointments - Healora Admin',
    admin: req.admin
  });
});

router.get('/settings', (req, res) => {
  res.render('admin/settings', {
    title: 'Settings - Healora Admin',
    admin: req.admin
  });
});

router.use('/api/patients', patientRoutes);
router.use('/api/doctors', doctorRoutes);
router.use('/api/departments', departmentRoutes);

export default router;

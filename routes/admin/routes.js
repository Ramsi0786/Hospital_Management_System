import express from "express";
const router = express.Router();
import { adminProtect } from '../../middleware/authAdmin.js';
import * as adminController from '../../controllers/admin.controller.js';
import * as bookingController from '../../controllers/booking.controller.js';
import * as leaveController from '../../controllers/leaveRequest.controller.js';

import authRoutes from './auth.routes.js';
import patientRoutes from './patients.routes.js';
import doctorRoutes from './doctors.routes.js';
import departmentRoutes from './departments.routes.js';

router.use('/', authRoutes);
router.use(adminProtect);

// ==================== PAGE ROUTES ====================
router.get('/dashboard', adminController.getDashboard);

router.get('/patients', (req, res) => {
  res.render('admin/patients', { title: 'Manage Patients - Healora Admin', admin: req.admin });
});
router.get('/patient/:id', adminController.getPatientById);

router.get('/doctors-management', (req, res) => {
  res.render('admin/doctors', { title: 'Manage Doctors - Healora Admin', admin: req.admin });
});
router.get('/doctor/:id', adminController.getDoctorById);

router.get('/departments', (req, res) => {
  res.render('admin/departments', { title: 'Manage Departments - Healora Admin', admin: req.admin });
});
router.get('/department/:id', (req, res) => {
  res.render('admin/department-detail', { title: 'Department Details - Healora Admin', admin: req.admin });
});

router.get('/settings',                   adminController.getSettings);
router.post('/settings',                  adminController.updateSettings);
router.post('/settings/change-password',  adminController.changeAdminPassword);

router.get('/invoice', adminController.getAdminInvoices);

router.get('/invoice/:appointmentId/download', bookingController.downloadInvoice);

// ==================== API ROUTES ====================
router.use('/api/patients',    patientRoutes);
router.use('/api/doctors',     doctorRoutes);     
router.use('/api/departments', departmentRoutes);

// ==================== APPOINTMENTS ====================
router.get('/appointments', adminController.getAdminAppointments);
router.get('/api/appointments/:id', adminController.getAppointmentById);
router.patch('/api/appointments/:id/status', adminController.updateAppointmentStatus);

router.get('/leave-requests',                   leaveController.getAdminLeaveRequests);
router.patch('/api/leave-requests/:id/approve', leaveController.approveLeave);
router.patch('/api/leave-requests/:id/reject',  leaveController.rejectLeave);

router.get('/api/salary-deductions',            leaveController.getSalaryDeductions);
router.patch('/api/salary-deductions/:id',      leaveController.processDeduction);
router.get('/api/doctor-salary/:doctorId',      leaveController.getDoctorSalary);
router.post('/api/doctor-salary/:doctorId',     leaveController.setDoctorSalary);

router.get('/api/notifications',             adminController.getAdminNotifications);
router.patch('/api/notifications/read',      adminController.markAllAdminNotifsRead);
router.patch('/api/notifications/:id/read',  adminController.markAdminNotifRead);

export default router;
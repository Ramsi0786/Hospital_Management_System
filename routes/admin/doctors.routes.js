import express from "express";
const router = express.Router();
import * as adminController from '../../controllers/admin.controller.js';
import * as availabilityController from '../../controllers/availability.controller.js';
import Doctor from '../../models/doctor.model.js';

router.get('/', adminController.getAllDoctors);
router.post('/', adminController.addDoctor);

// ==================== AVAILABILITY ====================

router.get('/:doctorId/availability/weekly', availabilityController.getWeeklyAvailability);
router.post('/:doctorId/availability/weekly', availabilityController.setWeeklyAvailability);

router.get('/:doctorId/availability/monthly', availabilityController.getMonthlyAvailability);
router.post('/:doctorId/availability/monthly', availabilityController.setMonthlyAvailability);

router.get('/:doctorId/availability/exceptions', availabilityController.getDailyExceptions);
router.post('/:doctorId/availability/exceptions', availabilityController.setDailyException);
router.delete('/:doctorId/availability/exceptions/:date', availabilityController.deleteDailyException);

// ==================== DOCTOR CRUD ====================

router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }
    res.json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.put('/:id',         adminController.updateDoctor);
router.delete('/:id',      adminController.deleteDoctor);
router.patch('/:id/block', adminController.blockDoctor);

export default router;
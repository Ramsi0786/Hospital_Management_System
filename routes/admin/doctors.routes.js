import express from "express";
const router = express.Router();
import * as adminController from '../../controllers/admin.controller.js';
import Doctor from '../../models/doctor.model.js'; 


router.get('/', adminController.getAllDoctors);
router.post('/', adminController.addDoctor);
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

router.put('/:id', adminController.updateDoctor);
router.delete('/:id', adminController.deleteDoctor);
router.patch('/:id/block', adminController.blockDoctor);

export default router;

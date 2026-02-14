import express from "express";
const router = express.Router();
import * as adminController from '../../controllers/admin.controller.js';
import Patient from '../../models/patient.model.js';


router.get('/', adminController.getAllPatients);
router.post('/', adminController.addPatient);
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    res.json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
router.put('/:id', adminController.updatePatient);
router.delete('/:id', adminController.deletePatient);
router.put('/:id/block', adminController.blockPatient);
router.patch('/:id/unblock', adminController.unblockPatient);
router.patch('/:id/reactivate', adminController.reactivatePatient);

export default router;

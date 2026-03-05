import express from "express";
const router = express.Router();
import * as adminController from '../../controllers/admin.controller.js';

router.get('/',  adminController.getAllPatients);
router.post('/', adminController.addPatient);

router.patch('/:id/block',      adminController.blockPatient);
router.patch('/:id/unblock',    adminController.unblockPatient);
router.patch('/:id/reactivate', adminController.reactivatePatient);
router.get('/:id/profile',      adminController.getPatientById);

router.get('/:id',    adminController.getPatientById);
router.patch('/:id',  adminController.updatePatient);
router.delete('/:id', adminController.deletePatient);

export default router;
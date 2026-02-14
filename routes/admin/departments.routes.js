import express from "express";
const router = express.Router();
import * as deptController from '../../controllers/department.controller.js';

router.route('/')
  .get(deptController.getAllDepartments)
  .post(deptController.createDepartment);

router.route('/:id')
  .get(deptController.getDepartmentById)
  .put(deptController.updateDepartment)
  .delete(deptController.deleteDepartment); 

router.patch('/:id/restore', deptController.restoreDepartment);

router.delete('/:id/permanent', deptController.permanentlyDeleteDepartment);
router.patch('/:id/toggle-status', deptController.toggleDepartmentStatus);

export default router;
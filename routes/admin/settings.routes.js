import express from "express";
import { updateHospitalStats, getHospitalStats } from "../controllers/admin.controller.js";

const router = express.Router();

router.get('/api/settings/stats', getHospitalStats);
router.put('/api/settings/stats', updateHospitalStats);

export default router;
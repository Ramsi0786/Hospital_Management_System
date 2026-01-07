import express from "express";
const router = express.Router();
import * as staticController from "../controllers/static.controller.js";
import { checkAuth } from '../middleware/auth.middleware.js';

router.get("/", staticController.landingPage);
router.get("/login", staticController.loginPage);
router.get("/about-us", staticController.aboutUsPage);
router.get("/services", staticController.servicesPage);
router.get("/contact", staticController.contactPage);

router.get("/patient/login", staticController.patientLoginPage);
router.get("/patient/signup", staticController.patientSignupPage);
router.get("/patient/verify-otp", staticController.patientOtpPage);

router.get("/doctors", staticController.doctorsPage);

router.get("/doctors/:id", staticController.doctorDetailPage);

router.get("/departments/:name", staticController.departmentPage);

export default router;

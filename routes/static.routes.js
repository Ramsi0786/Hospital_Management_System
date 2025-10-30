const express = require("express");
const router = express.Router();
const staticController = require("../controllers/static.controller");

router.get("/", staticController.landingPage);
router.get("/login", staticController.loginPage);
router.get("/about-us", staticController.aboutUsPage);
router.get("/doctors", staticController.doctorsPage);
router.get("/services", staticController.servicesPage);
router.get("/contact", staticController.contactPage);
router.get("/departments/:name", staticController.departmentPage);
router.get("/patient/login", staticController.patientLoginPage);
router.get("/patient/signup", staticController.patientSignupPage);



module.exports = router;

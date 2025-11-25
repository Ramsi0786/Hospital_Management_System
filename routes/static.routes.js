const express = require("express");
const router = express.Router();
const staticController = require("../controllers/static.controller");
const {checkAuth} = require('../middleware/auth.middleware');

router.use(checkAuth);

// Public routes
router.get("/", (req, res) => {
  res.render("landing_page", { title: "Healora - Healthcare Made Easy" });
});

router.get("/about-us", (req, res) => {
  res.render("about-us", { title: "About Us - Healora" });
});

router.get("/", staticController.landingPage);
router.get("/login", staticController.loginPage);
router.get("/about-us", staticController.aboutUsPage);
router.get("/doctors", staticController.doctorsPage);
router.get("/services", staticController.servicesPage);
router.get("/contact", staticController.contactPage);
router.get("/departments/:name", staticController.departmentPage);
router.get("/patient/login", staticController.patientLoginPage);
router.get("/patient/signup", staticController.patientSignupPage);
router.get("/patient/signup", staticController.patientOtpPage);




module.exports = router;

const express = require("express");
const router = express.Router();
const { signupPatient, loginPatient, getDashboard } = require("../controllers/patientController");
const { protectPatient } = require("../middleware/patient");

router.get("/login", (req, res) => res.render("patient/patient-login"));
router.post("/login", loginPatient);

router.get("/signup", (req, res) => res.render("patient/patient-signup"));
router.post("/signup", signupPatient);

router.get("/dashboard", protectPatient, getDashboard);

module.exports = router;

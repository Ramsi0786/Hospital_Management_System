const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const authMiddleware = require("../middleware/auth");

// Show login form
router.get("/patient-login", patientController.showLogin);

// Handle login
router.post("/login", patientController.login);

// Dashboard (protected route)
router.get("/dashboard", authMiddleware, patientController.dashboard);

// 👉 Show patient signup page
router.get("/signup", (req, res) => {
  res.render("patient/patient-signup");
});

// 👉 Handle signup form (POST)
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    let patient = await Patient.findOne({ email });
    if (patient) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    patient = new Patient({ name, email, password: hashedPassword });
    await patient.save();

    res.status(201).json({ message: "Signup successful! Please login." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

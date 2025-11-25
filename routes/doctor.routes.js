const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Doctor = require("../models/doctor.model");
const doctorController = require("../controllers/doctor.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// Doctor Registration
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) return res.status(400).json({ msg: "Doctor already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newDoctor = new Doctor({ name, email, password: hashedPassword });
    await newDoctor.save();

    res.status(201).json({ msg: "Doctor registered successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Doctor Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const doctor = await Doctor.findOne({ email });
    if (!doctor) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    // Create JWT
    const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, doctor: { id: doctor._id, email: doctor.email } });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});



module.exports = router;

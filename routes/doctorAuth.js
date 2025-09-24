const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Doctor = require("../models/doctor.js");

const router = express.Router();

// Doctor Registration
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) return res.status(400).json({ msg: "Doctor already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newDoctor = new Doctor({ email, password: hashedPassword });
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
    const token = jwt.sign({ id: doctor._id }, "SECRET_KEY", { expiresIn: "1h" });

    res.json({ token, doctor: { id: doctor._id, email: doctor.email } });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});


//======================== validation=====================


// Login Route
router.post("/doctor-login", async (req, res) => {
  const { email, password } = req.body;

  // Check empty fields
  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Check email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT
    const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;

const passport = require("passport");
const Patient = require("../models/patient.model");
const { generateToken } = require("../config/jwt");
const bcrypt = require("bcryptjs");

exports.signup = async (req, res) => {
  console.log("=== SIGNUP REQUEST RECEIVED ===");
  console.log("req.body:", req.body);
  
  const { name, email, phone, password, confirmPassword } = req.body;
  let errors = {};

  console.log("Extracted values:", { name, email, phone, password: password ? "***" : undefined, confirmPassword: confirmPassword ? "***" : undefined });

  // Validation
  if (!name || name.trim().length < 3) errors.name = "Name must be at least 3 characters long";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) errors.email = "Invalid email address";
  const phoneRegex = /^[0-9]{10}$/;
  if (!phone || !phoneRegex.test(phone)) errors.phone = "Phone number must be 10 digits";
  if (!password || password.length < 6) errors.password = "Password must be at least 6 characters";
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";

  console.log("Validation errors:", errors);

  if (Object.keys(errors).length > 0) {
    console.log("Returning validation errors");
    return res.status(400).json({ errors });
  }

  try {
    console.log("Checking for existing user...");
    const existing = await Patient.findOne({ email });
    console.log("Existing user found:", existing ? "YES" : "NO");
    
    if (existing) return res.status(400).json({ errors: { email: "User already exists!" } });

    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    console.log("Password hashed successfully");

    console.log("Creating new patient object...");
    const newPatient = new Patient({
      name,
      email,
      phone,
      password: hashedPassword,
    });

    console.log("Saving patient to database...");
    await newPatient.save();
    console.log("Patient saved successfully!");
    
    return res.status(201).json({ message: "Signup successful! Please log in." });
  } catch (err) {
    console.error("=== SIGNUP ERROR ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Full error:", err);
    console.error("Stack trace:", err.stack);
    return res.status(500).json({ errors: { general: "Server error. Please try again." } });
  }
};

// --------------------- LOGIN ---------------------
exports.login = async (req, res) => {
  const { email, password } = req.body;
  let errors = {};

  if (!email) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format";
  if (!password) errors.password = "Password is required";

  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  try {
    const patient = await Patient.findOne({ email });
    if (!patient) return res.status(404).json({ errors: { email: "No account found with this email" } });

    const isMatch = await bcrypt.compare(password.trim(), patient.password);
    if (!isMatch) return res.status(400).json({ errors: { password: "Incorrect password" } });

    const token = generateToken({ id: patient._id });

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "strict",
    });

    return res.status(200).json({ redirect: "/patient/dashboard" });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ errors: { general: "Server error. Please try again later." } });
  }
};

// ------------------- Google OAuth -------------------

exports.googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

exports.googleCallback = (req, res) => {
  try {
    const token = generateToken({ id: req.user._id }); // ← Changed to 'id' to match middleware
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/patient/dashboard");
  } catch (err) {
    console.error("Google callback error:", err);
    res.redirect("/patient/login"); // ← Changed to /patient/login for consistency
  }
};




const Patient = require("../models/patient.model");
const bcrypt = require("bcryptjs");
const redisClient = require("../config/redis");
const generateOtp = require("../utils/generateOtp");
const { sendOtpEmail, sendConfirmationEmail } = require("../utils/sendEmail");
const passport = require("passport");

// SIGNUP
exports.signup = async (req, res) => {
  const { name, email, phone, password, confirmPassword } = req.body;
  let errors = {};

  // Validation
  if (!name || name.trim().length < 3) errors.name = "Name must be at least 3 characters long";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) errors.email = "Invalid email address";
  const phoneRegex = /^[0-9]{10}$/;
  if (!phone || !phoneRegex.test(phone)) errors.phone = "Phone number must be 10 digits";
  if (!password || password.length < 6) errors.password = "Password must be at least 6 characters";
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const existing = await Patient.findOne({ email });
    if (existing) {
      return res.status(400).json({ errors: { email: "User already exists!" } });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const newPatient = new Patient({
      name,
      email,
      phone,
      password: hashedPassword,
      isVerified: false
    });

    await newPatient.save();

    // Generate OTP and store in Redis for 5 min
    const otp = generateOtp();
    await redisClient.setEx(`otp:email:${email}`, 300, otp);
    await sendOtpEmail(email, otp);

    return res.status(201).json({ 
      message: "OTP sent to your email",
      requiresOtp: true,
      email: email 
    });
  } catch (err) {
    console.error("Signup Error:", err);
    return res.status(500).json({ errors: { general: "Signup error — please try again." } });
  }
};

// OTP VERIFICATION
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body.email.toLowerCase().trim();
    const storedOtp = await redisClient.get(`otp:email:${email}`);
    
    if (!storedOtp) {
      return res.status(400).json({ errors: { otp: "OTP expired or not sent." } });
    }
    
    if (storedOtp !== otp) {
      return res.status(400).json({ errors: { otp: "Invalid OTP. Try again." } });
    }

    await Patient.findOneAndUpdate({ email }, { isVerified: true });
    await redisClient.del(`otp:email:${email}`);
    await sendConfirmationEmail(email);

    return res.status(200).json({ message: "Email verified successfully! Please log in." });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ errors: { general: "Server error." } });
  }
};

// LOGIN
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

    const { generateToken } = require("../config/jwt");
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

// GOOGLE AUTH
exports.googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

exports.googleCallback = (req, res) => {
  try {
    const { generateToken } = require("../config/jwt");
    const token = generateToken({ id: req.user._id });
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/patient/dashboard");
  } catch (err) {
    console.error("Google callback error:", err);
    res.redirect("/patient/login");
  }
};
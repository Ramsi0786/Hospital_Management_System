const Patient = require("../models/patient.model");
const bcrypt = require("bcryptjs");
const redisClient = require("../config/redis");
const generateOtp = require("../utils/generateOtp");
const { sendOtpEmail, sendConfirmationEmail, sendPasswordResetEmail } = require("../utils/sendEmail");
const generateToken = require("../utils/generateToken");
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
    await redisClient.setEx(`otp:email:${email}`, 60, otp);
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

// OTP VERIFICATION - AUTO LOGIN AFTER VERIFICATION
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    const storedOtp = await redisClient.get(`otp:email:${cleanEmail}`);

    if (!storedOtp) {
      return res.status(400).json({ errors: { otp: "OTP expired or not sent." } });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ errors: { otp: "Invalid OTP. Try again." } });
    }

    // Update user as verified
    const patient = await Patient.findOneAndUpdate(
      { email: cleanEmail }, 
      { isVerified: true },
      { new: true }
    );
    
    // Delete OTP from Redis
    await redisClient.del(`otp:email:${cleanEmail}`);
    
    // Send confirmation email
    await sendConfirmationEmail(cleanEmail);

    // Generate JWT token and set cookie (AUTO LOGIN)
    const { generateToken } = require("../config/jwt");
    const token = generateToken({ id: patient._id });

    const cookieOptions = {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    };

    res.cookie("token", token, cookieOptions);

    // Redirect to dashboard instead of login page
    return res.status(200).json({ 
      message: "Email verified successfully! Redirecting to dashboard...",
      redirect: "/patient/dashboard"
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ errors: { general: "Server error." } });
  }
};

// RESEND OTP
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Check if user exists
    const patient = await Patient.findOne({ email: cleanEmail });
    if (!patient) {
      return res.status(404).json({ errors: { general: "User not found." } });
    }

    // Check if already verified
    if (patient.isVerified) {
      return res.status(400).json({ errors: { general: "Email already verified." } });
    }

    // Generate new OTP and store in Redis for 5 minutes
    const otp = generateOtp();
    await redisClient.setEx(`otp:email:${cleanEmail}`, 60, otp);
    
    // Send OTP email
    await sendOtpEmail(cleanEmail, otp);

    return res.status(200).json({ 
      message: "New OTP sent to your email!",
      success: true 
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ errors: { general: "Failed to resend OTP. Please try again." } });
  }
};

// =========================LOGIN========================================

exports.logout = (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
};

exports.login = async (req, res) => {
  const { email, password, remember } = req.body;
  let errors = {};

  if (!email) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format";
  if (!password) errors.password = "Password is required";

  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  try {
    const patient = await Patient.findOne({ email });
    if (!patient) return res.status(404).json({ errors: { email: "No account found with this email" } });

    // Check if verified
    if (!patient.googleId && !patient.isVerified) {
      return res.status(403).json({
        errors: { general: "Please verify your email before logging in." }
      });
    }

    const isMatch = await bcrypt.compare(password.trim(), patient.password);
    if (!isMatch) return res.status(400).json({ errors: { password: "Incorrect password" } });

    const { generateToken } = require("../config/jwt");
    const token = generateToken({ id: patient._id });

    const cookieOptions = {
      httpOnly: true,
      sameSite: "strict",
      maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 1 day
    };

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({ redirect: "/patient/dashboard" });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ errors: { general: "Server error. Please try again later." } });
  }
};

// ============ FORGOT PASSWORD - RENDER PAGE (GET) ============
exports.renderForgotPassword = (req, res) => {
  res.render("patient/forgot-password", { 
    error: null, 
    success: null 
  });
};

// ============ FORGOT PASSWORD - PROCESS EMAIL (POST) ============
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.render("patient/forgot-password", { 
        error: "Please enter your email address.", 
        success: null 
      });
    }

    const user = await Patient.findOne({ email });
    if (!user) {
      return res.render("patient/forgot-password", { 
        error: "No account found with that email.", 
        success: null 
      });
    }

    // Generate token and store in Redis
    const token = generateToken();
    await redisClient.setEx(`reset:${email}`, 600, token); // 10 minutes

    // Send reset email
    const link = `${process.env.BASE_URL}/patient/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    await sendPasswordResetEmail(email, link);

    return res.render("patient/forgot-password", { 
      success: "Check your email for the reset link.", 
      error: null 
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.render("patient/forgot-password", { 
      error: "Server error. Please try again.", 
      success: null 
    });
  }
};

// ============ RESET PASSWORD - RENDER PAGE (GET) ============
exports.renderResetPassword = (req, res) => {
  const { email, token } = req.query;
  
  if (!email || !token) {
    return res.redirect("/patient/forgot-password");
  }

  res.render("patient/reset-password", {
    email: email,
    token: token,
    error: null,
    success: null
  });
};

// ============ RESET PASSWORD - PROCESS NEW PASSWORD (POST) ============
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, password, confirmPassword } = req.body;

    // Validation
    if (!password || password.length < 6) {
      return res.render("patient/reset-password", { 
        email, 
        token, 
        error: "Password must be at least 6 characters.", 
        success: null 
      });
    }

    if (password !== confirmPassword) {
      return res.render("patient/reset-password", { 
        email, 
        token, 
        error: "Passwords do not match.", 
        success: null 
      });
    }

    // Verify token from Redis
    const storedToken = await redisClient.get(`reset:${email}`);
    if (!storedToken || storedToken !== token) {
      return res.render("patient/reset-password", { 
        email, 
        token, 
        error: "Invalid or expired reset link.", 
        success: null 
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await Patient.findOneAndUpdate({ email }, { password: hashedPassword, isVerified: true });
    
    // Delete token from Redis
    await redisClient.del(`reset:${email}`);

    return res.render("patient/reset-password", { 
      email, 
      token: null, 
      error: null, 
      success: "Password reset successfully! You can now login." 
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.render("patient/reset-password", { 
      email: req.body.email, 
      token: req.body.token, 
      error: "Server error. Please try again.", 
      success: null 
    });
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
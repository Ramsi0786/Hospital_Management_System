import Patient from "../../models/patient.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import passport from "passport";
import redisClient from "../../config/redis.js";
import generateOtp from "../../utils/generateOtp.js";
import { sendOtpEmail, sendConfirmationEmail, sendPasswordResetEmail } from "../../utils/sendEmail.js";
import { generateAccessToken, generateRefreshToken } from '../../config/jwt.js';
import RefreshToken from '../../models/refreshToken.model.js';

// ──────────────── issue a brand-new token pair ────────────────

const issueTokens = async (userId, family = null) => {
  const tokenFamily = family || crypto.randomUUID();

  const accessToken  = generateAccessToken({ id: userId, role: 'patient' });
  const refreshToken = generateRefreshToken({ id: userId, role: 'patient' });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    token: refreshToken,
    userId,
    userModel: 'Patient',
    family: tokenFamily,
    expiresAt
  });

  return { accessToken, refreshToken };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000  
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 
  });
};

// ====================== SIGNUP =====================================
export const signup = async (req, res) => {
  const { name, email, phone, password, confirmPassword } = req.body;
  let errors = {};

  if (!name || name.trim().length < 3) {
    errors.name = "Name must be at least 3 characters long";
  } else if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
    errors.name = "Name can only contain letters and spaces";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) errors.email = "Invalid email address";

  const phoneRegex = /^[0-9]{10}$/;
  if (!phone || !phoneRegex.test(phone)) errors.phone = "Phone number must be 10 digits";

  if (!password || password.length < 6) errors.password = "Password must be at least 6 characters";
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";

  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  try {
    const existing = await Patient.findOne({ email });

    if (existing && existing.isBlocked) {
      return res.status(403).json({
        errors: { general: "Your account is blocked. You cannot sign up again." }
      });
    }

    if (existing && !existing.isActive && !existing.isBlocked) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      existing.name = name.trim();
      existing.phone = phone;
      existing.password = hashedPassword;
      existing.isActive = true;
      existing.deactivatedAt = null;
      existing.isVerified = false;
      await existing.save();

      const otp = generateOtp();
      req.session.otpEmail    = email.toLowerCase().trim();
      req.session.otpExpiry   = Date.now() + 300000;
      req.session.otpAttempts = 0;
      req.session.otpPending  = true;
      req.session.otpVerified = false;

      await redisClient.setEx(`otp:email:${email}`, 300, otp);
      await sendOtpEmail(email, otp);

      return res.status(200).json({
        message: "Account reactivated! Please verify your email with the OTP sent.",
        requiresOtp: true,
      });
    }

    if (existing && existing.isActive) {
      return res.status(400).json({
        errors: { email: "User already exists! Please login." }
      });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const newPatient = new Patient({
      name: name.trim(),
      email,
      phone,
      password: hashedPassword,
      isVerified: false,
      isActive: true
    });
    await newPatient.save();

    const otp = generateOtp();
    req.session.otpEmail    = email.toLowerCase().trim();
    req.session.otpExpiry   = Date.now() + 300000;
    req.session.otpAttempts = 0;
    req.session.otpPending  = true;
    req.session.otpVerified = false;

    await redisClient.setEx(`otp:email:${email}`, 300, otp);
    await sendOtpEmail(email, otp);

    return res.status(201).json({
      message: "OTP sent to your email",
      requiresOtp: true,
    });
  } catch (err) {
    console.error("Signup Error:", err);
    return res.status(500).json({
      errors: { general: "Signup error — please try again." }
    });
  }
};

export const requireOtpSession = (req, res, next) => {
  if (req.session.otpVerified === true) {
    return res.redirect("/patient/setup-password");
  }
  if (!req.session || !req.session.otpPending || !req.session.otpEmail) {
    return res.redirect("/patient/signup");
  }
  if (Date.now() > req.session.otpExpiry) {
    req.session.otpPending = false;
    delete req.session.otpEmail;
    delete req.session.otpExpiry;
    delete req.session.otpAttempts;
    return res.redirect("/patient/signup?error=otp_expired");
  }
  if (req.session.otpAttempts >= 5) {
    req.session.otpPending = false;
    delete req.session.otpEmail;
    delete req.session.otpExpiry;
    delete req.session.otpAttempts;
    return res.redirect("/patient/signup?error=too_many_attempts");
  }
  next();
};

export const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email   = req.session.otpEmail;

    if (!email) {
      return res.status(400).json({
        errors: { general: "Session expired. Please signup again." }
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const storedOtp  = await redisClient.get(`otp:email:${cleanEmail}`);

    if (!storedOtp) {
      return res.status(400).json({ errors: { otp: "OTP expired or not sent." } });
    }

    const patient = await Patient.findOne({ email: cleanEmail });
    if (!patient) {
      return res.status(404).json({ errors: { general: "User not found." } });
    }
    if (patient.isBlocked) {
      return res.status(403).json({ errors: { general: "Your account is blocked." } });
    }

    if (storedOtp !== otp) {
      req.session.otpAttempts = (req.session.otpAttempts || 0) + 1;
      const remaining = 5 - req.session.otpAttempts;
      if (remaining <= 0) {
        delete req.session.otpEmail;
        delete req.session.otpExpiry;
        delete req.session.otpAttempts;
        return res.status(400).json({
          errors: { otp: "Too many failed attempts. Please signup again." }
        });
      }
      return res.status(400).json({
        errors: { otp: `Invalid OTP. ${remaining} attempts remaining.` }
      });
    }

    patient.isVerified    = true;
    patient.isActive      = true;
    patient.deactivatedAt = null;
    await patient.save();

    await redisClient.del(`otp:email:${cleanEmail}`);
    delete req.session.otpEmail;
    delete req.session.otpExpiry;
    delete req.session.otpAttempts;

    await sendConfirmationEmail(cleanEmail);

    // ── Fresh login, new family ──
    const { accessToken, refreshToken } = await issueTokens(patient._id);
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      message: "Email verified successfully! Redirecting to dashboard...",
      redirect: "/patient/dashboard"
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ errors: { general: "Server error." } });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = req.session.otpEmail;
    if (!email) {
      return res.status(400).json({
        errors: { general: "Session expired. Please signup again." }
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const patient    = await Patient.findOne({ email: cleanEmail });

    if (!patient) {
      return res.status(404).json({ errors: { general: "User not found." } });
    }
    if (patient.isVerified) {
      return res.status(400).json({ errors: { general: "Email already verified." } });
    }

    req.session.resendCount = (req.session.resendCount || 0) + 1;
    if (req.session.resendCount > 3) {
      return res.status(429).json({
        errors: { general: "Too many resend requests. Please try again later." }
      });
    }

    const otp = generateOtp();
    req.session.otpExpiry   = Date.now() + 300000;
    req.session.otpAttempts = 0;

    await redisClient.setEx(`otp:email:${cleanEmail}`, 300, otp);
    await sendOtpEmail(cleanEmail, otp);

    return res.status(200).json({ message: "New OTP sent to your email!", success: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      errors: { general: "Failed to resend OTP. Please try again." }
    });
  }
};

// ==================== LOGIN ====================
export const login = async (req, res) => {
  const { email, password, remember } = req.body;
  let errors = {};

  if (!email) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format";
  if (!password) errors.password = "Password is required";
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  try {
    const patient = await Patient.findOne({ email });

    if (!patient) {
      return res.status(404).json({ errors: { email: "No account found with this email" } });
    }
    if (patient.isBlocked) {
      return res.status(403).json({
        errors: { general: "Your account is blocked. Please contact support." }
      });
    }
    if (!patient.isActive) {
      return res.status(403).json({
        errors: { general: "Your account is inactive. Please sign up again or use Google Sign-In." }
      });
    }
    if (!patient.password) {
      return res.status(400).json({
        errors: { general: "This account only uses Google Sign-In. Please click 'Sign in with Google' button." }
      });
    }
    if (!patient.googleId && !patient.isVerified) {
      return res.status(403).json({
        errors: { general: "Please verify your email before logging in." }
      });
    }

    const isMatch = await bcrypt.compare(password.trim(), patient.password);
    if (!isMatch) {
      return res.status(400).json({ errors: { password: "Incorrect password" } });
    }

    // ── Fresh login, new family ──
    const { accessToken, refreshToken } = await issueTokens(patient._id);
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({ redirect: "/patient/dashboard" });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      errors: { general: "Server error. Please try again later." }
    });
  }
};

// ==================== REFRESH TOKEN ROTATION ====================
export const refreshAccessToken = async (req, res) => {
  const incomingToken = req.cookies.refreshToken;

  if (!incomingToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  try {
    const storedToken = await RefreshToken.findOne({ token: incomingToken });

    if (!storedToken) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (storedToken.isUsed) {
      await RefreshToken.deleteMany({ family: storedToken.family });
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: "Token reuse detected. Please login again." });
    }

    if (storedToken.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: "Refresh token expired" });
    }

    storedToken.isUsed = true;
    await storedToken.save();

    const { accessToken, refreshToken } = await issueTokens(storedToken.userId, storedToken.family);
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.status(500).json({ error: "Server error" });
  }
};

// ==================== GOOGLE AUTH ====================
export const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"]
});

export const googleCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/patient/login?error=no_user");
    }

    if (req.user.isBlocked) {
      return res.redirect("/patient/login?error=blocked");
    }

    if (!req.user.password) {
      const autoPassword = crypto.randomBytes(16).toString('hex'); 
      req.user.password = await bcrypt.hash(autoPassword, 10);    
      req.user.needsPasswordSetup = true;
      await req.user.save();
    }

    if (!req.user.isActive) {
      await Patient.findByIdAndUpdate(req.user._id, {
        isActive: true,
        deactivatedAt: null,
        isVerified: true
      });
    }

    const { accessToken, refreshToken } = await issueTokens(req.user._id);
    setAuthCookies(res, accessToken, refreshToken);

    if (req.user.needsPasswordSetup) {
      req.session.showPasswordSetupBanner = true;
      return res.redirect("/patient/setup-password");
    }

    return res.redirect("/patient/dashboard");
  } catch (err) {
    console.error("Google callback error:", err);
    return res.redirect("/patient/login?error=server_error");
  }
};

// ==================== FORGOT PASSWORD ====================
export const renderForgotPassword = (req, res) => {
  res.render("patient/forgot-password", { error: null, success: null });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ errors: { email: "Please enter your email address." } });
    }

    const user = await Patient.findOne({ email });
    if (!user) {
      return res.status(404).json({ errors: { email: "No account found with that email." } });
    }
    if (user.isBlocked) {
      return res.status(403).json({ errors: { general: "Blocked users cannot reset password." } });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await redisClient.setEx(`reset:${email}`, 600, token);

    const link = `${process.env.BASE_URL}/patient/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    await sendPasswordResetEmail(email, link);

    return res.status(200).json({ message: "Check your email for the reset link." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ errors: { general: "Server error. Please try again." } });
  }
};

// ==================== RESET PASSWORD ====================
export const renderResetPassword = (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) return res.redirect("/patient/forgot-password");
  res.render("patient/reset-password", { email, token, error: null, success: null });
};

export const resetPassword = async (req, res) => {
  try {
    const { email, token, password, confirmPassword } = req.body;

    const user = await Patient.findOne({ email });
    if (!user) {
      return res.render("patient/reset-password", {
        email, token, error: "Account not found.", success: null
      });
    }
    if (user.isBlocked) {
      return res.status(403).json({ errors: { general: "Blocked users cannot reset password." } });
    }
    if (!password || password.length < 6) {
      return res.render("patient/reset-password", {
        email, token, error: "Password must be at least 6 characters.", success: null
      });
    }
    if (password !== confirmPassword) {
      return res.render("patient/reset-password", {
        email, token, error: "Passwords do not match.", success: null
      });
    }

    const storedToken = await redisClient.get(`reset:${email}`);
    if (!storedToken || storedToken !== token) {
      return res.render("patient/reset-password", {
        email, token, error: "Invalid or expired reset link.", success: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await Patient.findOneAndUpdate({ email }, { password: hashedPassword, isVerified: true });
    await redisClient.del(`reset:${email}`);

    await RefreshToken.deleteMany({ userId: user._id, userModel: 'Patient' });

    return res.render("patient/reset-password", {
      email, token: null, error: null,
      success: "Password reset successfully! You can now login."
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.render("patient/reset-password", {
      email: req.body.email, token: req.body.token,
      error: "Server error. Please try again.", success: null
    });
  }
};

// ==================== SETUP PASSWORD ====================
export const setupPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ errors: { password: "Password must be at least 6 characters" } });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ errors: { confirmPassword: "Passwords do not match" } });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    await Patient.findByIdAndUpdate(req.user._id, {
      password: hashedPassword,
      needsPasswordSetup: false
    });

    return res.status(200).json({ message: "Password set successfully!", redirect: "/patient/dashboard" });
  } catch (error) {
    console.error("Setup Password error:", error);
    return res.status(500).json({ errors: { general: "Server error." } });
  }
};

// ==================== LOGOUT ====================
export const logout = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const stored = await RefreshToken.findOne({ token: refreshToken });
      if (stored) {
        await RefreshToken.deleteMany({ family: stored.family });
      }
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.redirect('/patient/login');
  } catch (error) {
    console.error('Logout error:', error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.redirect('/patient/login');
  }
};
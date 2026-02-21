import Doctor from "../../models/doctor.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import redisClient from "../../config/redis.js";
import { sendPasswordResetEmail } from "../../utils/sendEmail.js";
import { generateAccessToken, generateRefreshToken } from "../../config/jwt.js";
import RefreshToken from '../../models/refreshToken.model.js';

// ───────── issue a brand-new token pair ─────────
const issueTokens = async (doctorId, family = null) => {
  const tokenFamily = family || crypto.randomUUID();

  const accessToken  = generateAccessToken({ id: doctorId, role: 'doctor' });
  const refreshToken = generateRefreshToken({ id: doctorId, role: 'doctor' });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    token: refreshToken,
    userId: doctorId,
    userModel: 'Doctor',
    family: tokenFamily,
    expiresAt
  });

  return { accessToken, refreshToken };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000    // 15 min
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  });
};

// ==================== LOGIN ====================
export const login = async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        errors: { general: "Email and password required" }
      });
    }

    const doctor = await Doctor.findOne({ email });

    if (!doctor) {
      return res.status(404).json({
        errors: { email: "No doctor account found" }
      });
    }
    if (doctor.status === 'blocked') {
      return res.status(403).json({
        errors: { general: "Your account has been blocked. Please contact the administrator." }
      });
    }
    if (doctor.status === 'inactive') {
      return res.status(403).json({
        errors: { general: "Your account is inactive. Please contact the administrator." }
      });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.status(400).json({
        errors: { password: "Incorrect password" }
      });
    }

    const { accessToken, refreshToken } = await issueTokens(doctor._id);
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({ redirect: "/doctor/dashboard" });
  } catch (err) {
    console.error("Doctor login error:", err);
    return res.status(500).json({ errors: { general: "Server error" } });
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
    console.error("Doctor refresh token error:", err);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.status(500).json({ error: "Server error" });
  }
};

// ==================== FORGOT PASSWORD ====================
export const renderForgotPassword = (req, res) => {
  res.render("doctor/forgot-password", { error: null, success: null });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ errors: { email: "Please enter your email address." } });
    }

    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(404).json({ errors: { email: "No doctor account found with that email." } });
    }
    if (doctor.status === 'blocked') {
      return res.status(403).json({ errors: { general: "Blocked doctors cannot reset password." } });
    }
    if (doctor.status === 'inactive') {
      return res.status(403).json({
        errors: { general: "Inactive doctors cannot reset password. Please contact administrator." }
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await redisClient.setEx(`doctor:reset:${email}`, 600, token);

    const link = `${process.env.BASE_URL}/doctor/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    await sendPasswordResetEmail(email, link);

    return res.status(200).json({ message: "Check your email for the reset link." });
  } catch (error) {
    console.error("Doctor Forgot Password Error:", error);
    return res.status(500).json({ errors: { general: "Server error. Please try again." } });
  }
};

// ==================== RESET PASSWORD ====================
export const renderResetPassword = async (req, res) => {
  const { email, token } = req.query;

  if (!email || !token) return res.redirect("/doctor/forgot-password");

  try {
    const storedToken = await redisClient.get(`doctor:reset:${email}`);
    if (!storedToken) {
      return res.render("doctor/reset-password", {
        email: null, token: null,
        error: "Reset link has expired. Please request a new one.",
        success: null
      });
    }
    res.render("doctor/reset-password", { email, token, error: null, success: null });
  } catch (error) {
    console.error("Render Reset Password Error:", error);
    res.redirect("/doctor/forgot-password");
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, token, password, confirmPassword } = req.body;

    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(404).json({ errors: { general: "Doctor account not found." } });
    }
    if (doctor.status === 'blocked') {
      return res.status(403).json({ errors: { general: "Blocked doctors cannot reset password." } });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ errors: { password: "Password must be at least 6 characters." } });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ errors: { confirmPassword: "Passwords do not match." } });
    }

    const storedToken = await redisClient.get(`doctor:reset:${email}`);
    if (!storedToken || storedToken !== token) {
      return res.status(400).json({ errors: { general: "Invalid or expired reset link." } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await Doctor.findOneAndUpdate({ email }, { password: hashedPassword });
    await redisClient.del(`doctor:reset:${email}`);

    await RefreshToken.deleteMany({ userId: doctor._id, userModel: 'Doctor' });

    return res.status(200).json({ message: "Password reset successfully!", success: true });
  } catch (error) {
    console.error("Doctor Reset Password Error:", error);
    return res.status(500).json({ errors: { general: "Server error. Please try again." } });
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
    return res.redirect('/doctor/login');
  } catch (error) {
    console.error('Doctor logout error:', error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.redirect('/doctor/login');
  }
};
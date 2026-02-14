import express from "express";
const router = express.Router();
import passport from "../config/passport.js";
import Patient from "../models/patient.model.js";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";
import RefreshToken from "../models/refreshToken.model.js";

router.get("/google", (req, res, next) => {
  passport.authenticate("google", { 
    scope: ["profile", "email"] 
  })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    next();
  },
  passport.authenticate("google", { 
    failureRedirect: "/patient/login?error=auth_failed",
    failureMessage: true
  }),
  async (req, res) => {
    try {
      
      if (!req.user) {
        return res.redirect("/patient/login?error=no_user");
      }
      if (req.user.isBlocked) {
        return res.redirect("/patient/login?error=blocked");
      }

      if (!req.user.password) {
        const crypto = await import('crypto');
        const bcrypt = await import('bcryptjs');
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

      const accessToken = generateAccessToken({ 
        id: req.user._id,
        role: 'patient'
      });

      const refreshToken = generateRefreshToken({ 
        id: req.user._id,
        role: 'patient'
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await RefreshToken.create({
        token: refreshToken,
        userId: req.user._id,
        userModel: 'Patient',
        expiresAt
      });

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      const redirectUrl = req.user.needsPasswordSetup 
        ? "/patient/setup-password" 
        : "/patient/dashboard";
     
      if (req.user.needsPasswordSetup) {
        req.session.showPasswordSetupBanner = true;
      }
      
      return res.redirect(redirectUrl);
      
    } catch (err) {
      console.error("========================================");
      console.error("OAUTH CALLBACK ERROR:");
      console.error(err);
      console.error("========================================");
      return res.redirect("/patient/login?error=server_error");
    }
  }
);

export default router;
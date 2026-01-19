import express from "express";
const router = express.Router();
import passport from "../config/passport.js";
import Patient from "../models/patient.model.js";
import { generateToken as jwtGenerateToken } from "../config/jwt.js";

router.get("/google", passport.authenticate("google", { 
  scope: ["profile", "email"] 
}));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/patient/login" }),
  async (req, res) => {
    try {

      if (req.user.isBlocked) {
        return res.redirect("/patient/login?error=blocked");
      }

      if (!req.user.isActive) {
        
        await Patient.findByIdAndUpdate(req.user._id, {
          isActive: true,
          deactivatedAt: null,
          isVerified: true
        });
      }
      const token = jwtGenerateToken({ 
        id: req.user._id,
        role: 'patient'
      });

      res.cookie("token", token, { 
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.redirect("/patient/dashboard");
      
    } catch (err) {
      console.error("❌ OAuth callback error:", err);
      return res.redirect("/patient/login?error=auth_failed");
    }
  }
);

export default router;
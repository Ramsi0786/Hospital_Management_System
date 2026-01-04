import express from "express";
const router = express.Router();
import * as doctorAuthController from "../controllers/auth/doctor.auth.controller.js";
import * as doctorController from "../controllers/doctor.controller.js";
import { protectDoctor } from "../middleware/auth.middleware.js"; // ← Fix this import

router.get('/login', (req, res) => {
  res.render('doctor/login', {
    title: "Doctor Login - Healora"
  });
});

router.post("/login", doctorAuthController.login);

router.get("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.redirect('/doctor/login');
});

router.post("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  res.json({ success: true });
});

router.get("/dashboard", protectDoctor, doctorController.getDashboard);

export default router;

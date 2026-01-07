import express from "express";
const router = express.Router();
import passport from "../config/passport.js";
import * as authController from "../controllers/auth/patient.auth.controller.js";

router.get("/google", authController.googleAuth);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  authController.googleCallback
);

export default router;

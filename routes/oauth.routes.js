import express from "express";
const router = express.Router();
import passport from "../config/passport.js";
import { googleCallback } from "../controllers/auth/patient.auth.controller.js";

router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false
}));

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/patient/login?error=auth_failed",
    failureMessage: true,
    session: false
  }),
  googleCallback
);

export default router;
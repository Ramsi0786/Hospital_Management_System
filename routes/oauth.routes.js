const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const authController = require("../controllers/auth.controller");

// Google OAuth
router.get("/google", authController.googleAuth);

// FIXED: Ensure passport is available for callback route!
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  authController.googleCallback
);

module.exports = router;

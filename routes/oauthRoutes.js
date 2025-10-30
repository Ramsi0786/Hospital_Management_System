const express = require("express");
const router = express.Router();
const { googleAuth, googleCallback } = require("../controllers/authController");
const passport = require("passport");

router.get("/google", googleAuth);
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), googleCallback);

module.exports = router;

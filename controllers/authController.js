const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const Patient = require("../models/patient");
const { generateToken } = require("../config/jwt");

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const existing = await Patient.findOne({ email: profile.emails[0].value });
      if (existing) return done(null, existing);

      const newPatient = await Patient.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        phone: "0000000000", // Placeholder if Google doesn't give phone
        password: "GoogleAuth" // Random placeholder
      });

      done(null, newPatient);
    } catch (err) {
      done(err, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await Patient.findById(id);
  done(null, user);
});

// Routes
exports.googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

exports.googleCallback = (req, res) => {
  const token = generateToken({ _id: req.user._id, role: "patient" });
  res.cookie("token", token, { httpOnly: true });
  res.redirect("/patient/dashboard");
};

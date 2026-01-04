import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Patient from "../models/patient.model.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await Patient.findOne({ googleId: profile.id });

        if (!user) {
          user = await Patient.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            isVerified: true,
            needsPasswordSetup: true,
          });
        }
        return done(null, user);
      } catch (err) {
        done(err, false);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  Patient.findById(id).then((user) => done(null, user));
});

export default passport;

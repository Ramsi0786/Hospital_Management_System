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
        
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = profile.id;
        const profileImage = profile.photos[0]?.value || '';
        
        let patient = await Patient.findOne({
          $or: [{ email }, { googleId }]
        });

        if (patient) {
          
          if (patient.isBlocked) {
            return done(null, false, { message: 'Account is blocked' });
          }

          if (!patient.googleId) {
            patient.googleId = googleId;
          }

          if (profileImage && !patient.profileImage) {
            patient.profileImage = profileImage;
          }

          if (!patient.isActive) {
            patient.isActive = true;
            patient.deactivatedAt = null;
          }

          patient.isVerified = true;
          await patient.save();
          
          return done(null, patient);
        }
        
        patient = new Patient({
          name,
          email,
          googleId,
          profileImage,
          isVerified: true,
          isActive: true,
          role: 'patient',
          needsPasswordSetup: false,
          authProvider: 'google'
        });

        await patient.save();

        return done(null, patient);
      } catch (err) {
        console.error("========================================");
        console.error("GOOGLE STRATEGY ERROR:");
        console.error(err);
        console.error("========================================");
        return done(err, false);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {

    const patient = await Patient.findById(id).select('-password');
    if (!patient) {
      return done(null, false);
    }
    done(null, patient);
  } catch (error) {
    console.error("Deserialize Error:", error);
    done(error, null);
  }
});

export default passport;
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

// Serialization required for passport session management
passport.serializeUser((user, done) => {
  console.log("🔍🔍🔍 PASSPORT: Serializing user:", {
    id: user._id,
    email: user.email,
  });
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  console.log("🔍🔍🔍 PASSPORT: Deserializing user with ID:", id);
  try {
    const user = await User.findById(id);
    console.log(
      "🔍🔍🔍 PASSPORT: Deserialized user:",
      user ? { id: user._id, email: user.email } : "NO USER"
    );
    done(null, user);
  } catch (err) {
    console.error("🔍🔍🔍 PASSPORT: Deserialization error:", err);
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          user = await User.create({
            firstName: profile.name.givenName || "Google",
            lastName: profile.name.familyName || "User",
            email: profile.emails[0].value,
            password: "google", // will never be used, can be random
            isVerified: true,
          });
        }

        // Ensure user object is properly formatted
        if (!user.createJWT) {
          throw new Error("User model missing JWT creation method");
        }

        return done(null, user);
      } catch (err) {
        console.error("Google strategy error:", err);
        return done(err, null);
      }
    }
  )
);

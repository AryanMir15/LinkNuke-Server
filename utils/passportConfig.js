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
      user ? { id: user._id, email: user.email } : "NO USER",
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
      console.log("🔍🔍🔍 [PASSPORT_STRATEGY] Google strategy callback hit");
      console.log("🔍🔍🔍 [PASSPORT_STRATEGY] Profile received:", {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
      });

      try {
        console.log(
          "🔍🔍🔍 [PASSPORT_STRATEGY] Looking for user in database...",
        );
        let user = await User.findOne({ email: profile.emails[0].value });

        console.log("🔍🔍🔍 [PASSPORT_STRATEGY] User found:", !!user);

        if (!user) {
          console.log("🔍🔍🔍 [PASSPORT_STRATEGY] Creating new user...");
          user = await User.create({
            firstName: profile.name.givenName || "Google",
            lastName: profile.name.familyName || "User",
            email: profile.emails[0].value,
            password: "google", // will never be used, can be random
            isVerified: true,
          });
          console.log("✅ [PASSPORT_STRATEGY] New user created:", user._id);
        }

        // Ensure user object is properly formatted
        if (!user.createJWT) {
          console.log(
            "❌ [PASSPORT_STRATEGY] User model missing JWT creation method",
          );
          throw new Error("User model missing JWT creation method");
        }

        console.log("✅ [PASSPORT_STRATEGY] Calling done() with user");
        return done(null, user);
      } catch (err) {
        console.error("❌ [PASSPORT_STRATEGY] Google strategy error:", err);
        return done(err, null);
      }
    },
  ),
);

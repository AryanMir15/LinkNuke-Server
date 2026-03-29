const express = require("express");
const passport = require("passport");
const router = express.Router();
const { googleAuthCallback, verifyToken } = require("../controllers/auth");
const authMiddleware = require("../middleware/auth");

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: Buffer.from(
      JSON.stringify({ redirectTo: process.env.CLIENT_URL || "" }),
    ).toString("base64"),
  }),
);

// Add middleware to log all requests to OAuth callback
router.use("/auth/google/callback", (req, res, next) => {
  console.log("🔍🔍🔍 [MIDDLEWARE] OAuth callback request received");
  console.log("🔍🔍🔍 [MIDDLEWARE] Query params:", req.query);
  console.log("🔍🔍🔍 [MIDDLEWARE] Headers:", req.headers);
  next();
});

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    console.log("🔍🔍🔍 [ROUTE] OAuth callback route hit");
    next();
  },
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google_auth_failed`,
    session: false,
  }),
  (req, res) => {
    console.log("🔍🔍🔍 [CALLBACK] Inside OAuth callback handler");
    try {
      const state = req.query.state
        ? JSON.parse(Buffer.from(req.query.state, "base64").toString())
        : {};

      console.log("🔍🔍🔍 [CALLBACK] Parsed state:", state);
      console.log("🔍🔍🔍 [CALLBACK] req.user exists:", !!req.user);

      if (!req.user) {
        console.log(
          "❌ [CALLBACK] No req.user, calling googleAuthCallback anyway",
        );
      }

      const token = req.user.createJWT();
      const redirectUrl = `${process.env.CLIENT_URL}/oauth-success?token=${token}&redirectTo=${
        state.redirectTo || ""
      }`;

      console.log("🔄 [CALLBACK] Redirecting to:", redirectUrl);
      res.redirect(redirectUrl);
    } catch (err) {
      console.error("❌ [CALLBACK] Google callback error:", err);
      res.redirect(
        `${process.env.CLIENT_URL}/login?error=authentication_failed`,
      );
    }
  },
);

// Get current user details
router.get("/auth/me", authMiddleware, (req, res) => {
  try {
    const user = req.user;
    res.json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      subscription: user.subscription,
    });
  } catch (error) {
    console.error("Error getting user details:", error);
    res.status(500).json({ error: "Failed to get user details" });
  }
});

// Token verification endpoint
router.get("/auth/verify-token", authMiddleware, verifyToken);

module.exports = router;

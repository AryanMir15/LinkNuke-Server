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

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google_auth_failed`,
    session: false,
  }),
  (req, res) => {
    try {
      const state = req.query.state
        ? JSON.parse(Buffer.from(req.query.state, "base64").toString())
        : {};

      const token = req.user.createJWT();
      res.redirect(
        `${process.env.CLIENT_URL}/oauth-success?token=${token}&redirectTo=${
          state.redirectTo || ""
        }`,
      );
    } catch (err) {
      console.error("Google callback error:", err);
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

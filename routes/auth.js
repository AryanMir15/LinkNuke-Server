const express = require("express");
const router = express.Router();
const passport = require("passport");
const authMiddleware = require("../middleware/auth");
const {
  login,
  register,
  logout,
  forgotPassword,
  resetPassword,
  verifyPin,
  resendPin,
  verifyToken,
} = require("../controllers/auth");

// OAuth routes
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
      const redirectUrl = `${process.env.CLIENT_URL}/oauth-success?token=${token}&redirectTo=${
        state.redirectTo || ""
      }`;

      res.redirect(redirectUrl);
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(
        `${process.env.CLIENT_URL}/login?error=authentication_failed`,
      );
    }
  },
);

router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/logout", logout);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password/:token", resetPassword);
router.post("/auth/verify-pin", verifyPin);
router.post("/auth/resend-pin", resendPin);
router.get("/auth/verify", authMiddleware, verifyToken);
router.get("/auth/verify-token", authMiddleware, verifyToken);

module.exports = router;

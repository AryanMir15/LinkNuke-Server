const express = require("express");
const passport = require("passport");
const router = express.Router();
const { googleAuthCallback } = require("../controllers/auth");

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login`,
    session: false,
  }),
  googleAuthCallback
);

module.exports = router;

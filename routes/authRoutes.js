const express = require("express");
const passport = require("passport");
const router = express.Router();

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect:
      "https://link-bolt-git-main-aryan-mirs-projects.vercel.app/login",
    session: false,
  }),
  (req, res) => {
    const token = req.user.createJWT();
    res.redirect(
      `https://link-bolt-git-main-aryan-mirs-projects.vercel.app/oauth-success?token=${token}`
    );
  }
);

module.exports = router;

const express = require("express");
const router = express.Router();

const {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyPin,
  resendPin,
} = require("../controllers/auth");

router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password/:token", resetPassword);
router.post("/auth/verify-pin", verifyPin);
router.post("/auth/resend-pin", resendPin);

module.exports = router;

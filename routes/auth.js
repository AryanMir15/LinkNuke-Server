const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const {
  login,
  register,
  forgotPassword,
  resetPassword,
  verifyPin,
  resendPin,
  verifyToken,
} = require("../controllers/auth");

router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password/:token", resetPassword);
router.post("/auth/verify-pin", verifyPin);
router.post("/auth/resend-pin", resendPin);
router.get("/auth/verify", authMiddleware, verifyToken);

module.exports = router;

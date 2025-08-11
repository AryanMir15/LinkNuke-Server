const express = require("express");
const router = express.Router();
const {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  updateSubscription,
} = require("../controllers/paddleController");
const authMiddleware = require("../middleware/auth");

// Public webhook endpoint (no auth required)
router.post("/webhook", handleWebhook);

// Protected routes (require authentication)
router.post("/create-checkout", authMiddleware, createCheckoutSession);
router.get("/subscription-status", authMiddleware, getSubscriptionStatus);
router.post("/cancel-subscription", authMiddleware, cancelSubscription);
router.put("/update-subscription", authMiddleware, updateSubscription);

module.exports = router;

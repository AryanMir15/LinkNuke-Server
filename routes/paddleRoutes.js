const express = require("express");
const router = express.Router();
const {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  updateSubscription,
  startTrial,
  getClientToken,
} = require("../controllers/paddleController");
const authMiddleware = require("../middleware/auth");

// Public webhook endpoint (no auth required)
router.post("/webhook", handleWebhook);

// Test endpoint to verify webhook URL is reachable
router.get("/webhook-test", (req, res) => {
  console.log("🔍 WEBHOOK TEST: Webhook endpoint is reachable");
  res.json({
    message: "Webhook endpoint is working",
    timestamp: new Date().toISOString(),
    url: req.originalUrl,
  });
});

// Protected routes (require authentication)
router.post("/create-checkout", authMiddleware, createCheckoutSession);
router.get("/client-token", authMiddleware, getClientToken);
router.post("/start-trial", authMiddleware, startTrial);
router.get("/subscription-status", authMiddleware, getSubscriptionStatus);
router.post("/cancel-subscription", authMiddleware, cancelSubscription);
router.put("/update-subscription", authMiddleware, updateSubscription);

module.exports = router;

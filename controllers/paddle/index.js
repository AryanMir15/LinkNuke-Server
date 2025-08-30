// Main index file for Paddle controllers
// This provides a clean interface to all Paddle-related functionality

const webhookController = require("./webhookController");
const subscriptionController = require("./subscriptionController");
const refundController = require("./refundController");
const checkoutController = require("./checkoutController");
const { paddle, PRODUCTS } = require("./config");

// Export all controllers and utilities
module.exports = {
  // Webhook handling
  handleWebhook: webhookController.handleWebhook,

  // Subscription management
  getSubscriptionStatus: subscriptionController.getSubscriptionStatus,
  cancelSubscription: subscriptionController.cancelSubscription,
  updateSubscription: subscriptionController.updateSubscription,

  // Refund management
  requestRefund: refundController.requestRefund,
  getRefundPolicyInfo: refundController.getRefundPolicyInfo,

  // Checkout and trials
  createCheckoutSession: checkoutController.createCheckoutSession,
  getClientToken: checkoutController.getClientToken,
  startTrial: checkoutController.startTrial,

  // Configuration exports (for backward compatibility)
  paddle,
  PRODUCTS,
};

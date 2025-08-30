/**
 * Refund utility functions for LinkNuke
 * Handles refund calculations, validations, and business logic
 */

/**
 * Calculate days since first payment for refund eligibility
 * @param {Date|string} firstPaymentDate - The date of first payment
 * @returns {number} Days since payment
 */
const calculateDaysSincePayment = (firstPaymentDate) => {
  if (!firstPaymentDate) return null;

  const paymentDate = new Date(firstPaymentDate);
  const now = new Date();

  // Calculate difference in milliseconds and convert to days
  const diffInMs = now - paymentDate;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return diffInDays;
};

/**
 * Check if user is eligible for refund (within 15-day window)
 * @param {Object} subscription - User's subscription object
 * @returns {Object} Eligibility result with details
 */
const checkRefundEligibility = (subscription) => {
  if (!subscription) {
    return {
      eligible: false,
      reason: "No subscription found",
      daysSincePayment: null,
      daysRemaining: 0,
    };
  }

  // Check if already refunded
  if (subscription.status === "refunded") {
    return {
      eligible: false,
      reason: "Already refunded",
      daysSincePayment: null,
      daysRemaining: 0,
    };
  }

  // Check if refund already requested
  if (subscription.refundStatus && subscription.refundStatus !== "none") {
    return {
      eligible: false,
      reason: `Refund already ${subscription.refundStatus}`,
      daysSincePayment: null,
      daysRemaining: 0,
    };
  }

  // Get first payment date
  const firstPaymentDate =
    subscription.firstPaymentDate || subscription.startDate;
  if (!firstPaymentDate) {
    return {
      eligible: false,
      reason: "No payment date found",
      daysSincePayment: null,
      daysRemaining: 0,
    };
  }

  const daysSincePayment = calculateDaysSincePayment(firstPaymentDate);
  const daysRemaining = Math.max(0, 15 - daysSincePayment);

  if (daysSincePayment > 15) {
    return {
      eligible: false,
      reason: "Refund window expired",
      daysSincePayment,
      daysRemaining: 0,
    };
  }

  return {
    eligible: true,
    reason: "Eligible for refund",
    daysSincePayment,
    daysRemaining,
  };
};

/**
 * Validate refund request before processing
 * @param {Object} user - User object
 * @param {string} reason - Refund reason (optional)
 * @returns {Object} Validation result
 */
const validateRefundRequest = (user, reason = "") => {
  const errors = [];
  const warnings = [];

  // Check if user exists
  if (!user) {
    errors.push("User not found");
    return { valid: false, errors, warnings };
  }

  // Check subscription
  if (!user.subscription) {
    errors.push("No subscription found");
    return { valid: false, errors, warnings };
  }

  // Check refund eligibility
  const eligibility = checkRefundEligibility(user.subscription);
  if (!eligibility.eligible) {
    errors.push(eligibility.reason);
    return { valid: false, errors, warnings };
  }

  // Check if reason is too long (optional validation)
  if (reason && reason.length > 500) {
    warnings.push("Refund reason is quite long, consider shortening it");
  }

  // Check if user has any active links that might be affected
  if (user.usage && user.usage.linksCreated > 0) {
    warnings.push("User has created links that will be affected by refund");
  }

  return {
    valid: true,
    errors,
    warnings,
    eligibility,
  };
};

/**
 * Format refund amount for display
 * @param {number} amount - Refund amount in cents
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted amount
 */
const formatRefundAmount = (amount, currency = "USD") => {
  if (!amount) return "N/A";

  // Convert cents to dollars if amount is in cents
  const dollars = amount / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(dollars);
};

/**
 * Get refund policy information
 * @returns {Object} Refund policy details
 */
const getRefundPolicy = () => {
  return {
    windowDays: 15,
    description: "Full refunds are available within 15 days of first payment",
    conditions: [
      "Refund must be requested within 15 days of first payment",
      "Access to premium features will be removed immediately",
      "Refund will be processed to the original payment method",
      "No partial refunds available",
    ],
    processingTime: "Refunds are processed immediately",
    contactInfo: "Contact support for any refund-related questions",
  };
};

/**
 * Log refund activity for audit trail
 * @param {string} action - Action performed (requested, completed, failed)
 * @param {Object} user - User object
 * @param {Object} details - Additional details
 */
const logRefundActivity = (action, user, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId: user._id,
    userEmail: user.email,
    subscriptionId: user.subscription?.subscriptionId,
    transactionId: user.subscription?.transactionId,
    ...details,
  };

  console.log(`📋 Refund Activity [${action.toUpperCase()}]:`, logEntry);

  // In a production environment, you might want to store this in a database
  // or send it to a logging service like Winston, LogRocket, etc.
};

module.exports = {
  calculateDaysSincePayment,
  checkRefundEligibility,
  validateRefundRequest,
  formatRefundAmount,
  getRefundPolicy,
  logRefundActivity,
};


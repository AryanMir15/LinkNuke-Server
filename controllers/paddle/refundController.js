const { paddle } = require("./config");
const {
  checkRefundEligibility,
  validateRefundRequest,
  formatRefundAmount,
  logRefundActivity,
  getRefundPolicy,
} = require("../../utils/refundUtils");

// Request refund
const requestRefund = async (req, res) => {
  try {
    if (!paddle) {
      console.error("Paddle client not initialized for refund request");
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const { reason } = req.body;
    const user = req.user;

    console.log(`🔄 Processing refund request for user: ${user.email}`);

    // Validate refund request using utility function
    const validation = validateRefundRequest(user, reason);
    if (!validation.valid) {
      console.error("Refund validation failed:", validation.errors);
      return res.status(400).json({
        error: validation.errors[0],
        details: validation.errors,
        warnings: validation.warnings,
      });
    }

    const { eligibility } = validation;
    console.log(`📅 Refund eligibility check:`, eligibility);

    // Get transaction details from Paddle
    let transactionId = user.subscription.transactionId;
    if (!transactionId) {
      // Try to get transaction ID from subscription
      try {
        const subscription = await paddle.subscriptions.get(
          user.subscription.subscriptionId
        );
        transactionId = subscription.transactions?.[0]?.id;
        if (transactionId) {
          // Update user with transaction ID
          user.subscription.transactionId = transactionId;
          await user.save();
        }
      } catch (error) {
        console.error("Error fetching subscription details:", error.message);
      }
    }

    if (!transactionId) {
      return res
        .status(400)
        .json({ error: "Unable to find transaction for refund" });
    }

    console.log(`💰 Processing refund for transaction: ${transactionId}`);

    // Update user refund status to requested
    user.subscription.refundStatus = "requested";
    user.subscription.refundReason = reason || "User requested refund";

    // Log refund request for tracking
    logRefundActivity("requested", user, {
      transactionId: transactionId,
      reason: reason || "User requested refund",
      eligibility: eligibility,
    });

    await user.save();

    try {
      // Call Paddle API to process refund using adjustments endpoint
      const refundResult = await paddle.adjustments.create({
        action: "refund",
        type: "full",
        transaction_id: transactionId,
        reason: reason || "User requested refund",
      });

      console.log(`✅ Refund processed successfully:`, refundResult);

      // Update user with refund details
      user.subscription.refundStatus = "completed";
      user.subscription.refundedAt = new Date();
      user.subscription.refundAmount = refundResult.data?.totals?.total
        ? refundResult.data.totals.total / 100
        : 0;

      // Immediately downgrade user to free plan
      user.subscription.status = "refunded";
      user.subscription.plan = "free";
      user.subscription.usageLimits = { links: 5, customDomains: 1 };
      user.subscription.endDate = new Date(); // Immediate access removal

      await user.save();

      // Log successful refund completion
      logRefundActivity("completed", user, {
        transactionId: transactionId,
        refundId: refundResult.data?.id,
        refundAmount: refundResult.data?.totals?.total
          ? (refundResult.data.totals.total / 100).toFixed(2)
          : 0,
        refundedAt: user.subscription.refundedAt,
        accessRemoved: true,
        downgradedTo: "free",
      });

      res.json({
        message: "Refund processed successfully",
        refundId: refundResult.data?.id,
        refundAmount: refundResult.data?.totals?.total
          ? (refundResult.data.totals.total / 100).toFixed(2)
          : 0,
        refundedAt: user.subscription.refundedAt,
        accessRemoved: true,
      });
    } catch (paddleError) {
      console.error("❌ Paddle refund API error:", paddleError.message);

      // Update user refund status to failed
      user.subscription.refundStatus = "failed";
      await user.save();

      // Provide specific error messages
      let errorMessage = "Failed to process refund";
      if (paddleError.message?.includes("already refunded")) {
        errorMessage = "Transaction has already been refunded";
      } else if (paddleError.message?.includes("not found")) {
        errorMessage = "Transaction not found";
      } else if (paddleError.message?.includes("refund window")) {
        errorMessage = "Refund window has expired";
      }

      res.status(500).json({
        error: errorMessage,
        details: paddleError.message,
      });
    }
  } catch (error) {
    console.error("❌ Error processing refund request:", error);
    res.status(500).json({ error: "Failed to process refund request" });
  }
};

// Get refund policy information
const getRefundPolicyInfo = async (req, res) => {
  try {
    const user = req.user;
    const policy = getRefundPolicy();

    // Add user-specific eligibility information
    const eligibility = user.subscription
      ? checkRefundEligibility(user.subscription)
      : null;

    res.json({
      policy,
      userEligibility: eligibility,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting refund policy:", error);
    res.status(500).json({ error: "Failed to get refund policy" });
  }
};

module.exports = {
  requestRefund,
  getRefundPolicyInfo,
};

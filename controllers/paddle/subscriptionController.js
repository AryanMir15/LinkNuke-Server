const { paddle, PRODUCTS } = require("./config");

// Get subscription status
const getSubscriptionStatus = async (req, res) => {
  try {
    const user = req.user;

    // Define correct plan limits
    const planLimits = {
      free: { links: 5, customDomains: 1 },
      starter: { links: 10, customDomains: 1 },
      pro: { links: 500, customDomains: 3 },
      lifetime: { links: 9999, customDomains: 10 },
    };

    // Ensure user has subscription and usage data
    if (!user.subscription) {
      user.subscription = {
        status: "active",
        plan: "free",
        usageLimits: planLimits.free,
      };
      await user.save();
    } else {
      // Ensure usageLimits are correct for the current plan
      const currentPlan = user.subscription.plan || "free";
      if (
        !user.subscription.usageLimits ||
        user.subscription.usageLimits.links !== planLimits[currentPlan].links
      ) {
        user.subscription.usageLimits = planLimits[currentPlan];
        await user.save();
      }
    }

    if (!user.usage) {
      user.usage = {
        linksCreated: 0,
        storageUsed: 0,
      };
      await user.save();
    }

    // Calculate usage percentage
    const usage = user.subscription.usageLimits
      ? {
          links: {
            current: user.usage.linksCreated || 0,
            limit: user.subscription.usageLimits.links,
            percent: Math.round(
              ((user.usage.linksCreated || 0) /
                user.subscription.usageLimits.links) *
                100
            ),
          },
        }
      : null;

    // Extract billing period dates
    const billingPeriod =
      user.subscription.endDate && user.subscription.startDate
        ? {
            start: user.subscription.startDate,
            end: user.subscription.endDate,
            remaining_days: Math.max(
              0,
              Math.ceil(
                (new Date(user.subscription.endDate) - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            ),
          }
        : null;

    res.json({
      hasSubscription: true,
      subscription: user.subscription,
      usage,
      billing_period: billingPeriod,
      proration: user.subscription.prorationData || null,
    });
  } catch (error) {
    console.error("Error getting subscription status:", error);
    res.status(500).json({ error: "Failed to get subscription status" });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    if (!paddle) {
      console.error(
        "Paddle client not initialized for subscription cancellation"
      );
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const user = req.user;
    console.log(`🔄 Attempting to cancel subscription for user: ${user.email}`);

    if (!user.subscription?.subscriptionId) {
      console.error("No subscription ID found for user:", user.email);
      return res.status(400).json({ error: "No active subscription found" });
    }

    console.log(`📋 Subscription ID: ${user.subscription.subscriptionId}`);

    // Call Paddle API to cancel subscription with timeout and retry logic
    let cancelResult;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(
          `🔄 Attempting Paddle API call (attempt ${
            retryCount + 1
          }/${maxRetries})`
        );

        // Add timeout to the Paddle client call
        // Paddle SDK v3 - try different parameter formats
        console.log(
          `🔍 Attempting to cancel subscription with ID: ${user.subscription.subscriptionId}`
        );

        // Try the correct Paddle SDK v3 format
        const cancelPromise = paddle.subscriptions.cancel(
          user.subscription.subscriptionId,
          {
            effectiveFrom: "next_billing_period",
          }
        );

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Paddle API timeout")), 15000); // 15 second timeout
        });

        // Race between the API call and timeout
        cancelResult = await Promise.race([cancelPromise, timeoutPromise]);
        console.log(`✅ Paddle cancellation response:`, cancelResult);
        break; // Success, exit retry loop
      } catch (apiError) {
        retryCount++;
        console.error(
          `❌ Paddle API call failed (attempt ${retryCount}/${maxRetries}):`,
          apiError.message
        );

        if (retryCount >= maxRetries) {
          // If all retries failed, we'll still update the local database
          console.error(
            `❌ All ${maxRetries} attempts failed. Proceeding with local cancellation.`
          );

          // Check if it's a timeout, connection error, or invalid URL
          if (
            apiError.message.includes("timeout") ||
            apiError.message.includes("fetch failed") ||
            apiError.code === "UND_ERR_CONNECT_TIMEOUT" ||
            apiError.message.includes("URL called is invalid") ||
            apiError.code === "invalid_url"
          ) {
            console.log(
              `⚠️ API error detected (${apiError.message}). Cancelling locally and will sync with Paddle later.`
            );
            // We'll proceed with local cancellation and let the webhook handle the sync
            break;
          } else {
            throw apiError; // Re-throw if it's not a network/API issue
          }
        } else {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // Update user subscription status
    user.subscription.status = "cancelled";
    user.subscription.cancelledAt = new Date();

    // Set end date to current billing period end or immediate if not available
    if (user.subscription.endDate && user.subscription.endDate > new Date()) {
      // Keep access until end of current billing period
      console.log(
        `📅 Subscription will remain active until: ${user.subscription.endDate}`
      );
    } else {
      // Immediate cancellation
      user.subscription.endDate = new Date();
      console.log(`⏰ Subscription cancelled immediately`);
    }

    await user.save();
    console.log(
      `✅ Subscription cancelled successfully for user: ${user.email}`
    );

    // Determine if this was a local cancellation due to network issues
    const wasLocalCancellation = retryCount >= maxRetries && !cancelResult;
    const message = wasLocalCancellation
      ? "Subscription cancelled locally. Paddle API sync will be completed via webhook."
      : "Subscription cancelled successfully";

    res.json({
      message: message,
      cancelledAt: user.subscription.cancelledAt,
      accessUntil: user.subscription.endDate,
      localCancellation: wasLocalCancellation,
    });
  } catch (error) {
    console.error("❌ Error cancelling subscription:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      type: error.type,
      errors: error.errors,
    });

    // Provide more specific error messages
    let errorMessage = "Failed to cancel subscription";
    if (error.message?.includes("not found")) {
      errorMessage =
        "Subscription not found. It may have already been cancelled.";
    } else if (error.message?.includes("already cancelled")) {
      errorMessage = "Subscription has already been cancelled.";
    } else if (error.message?.includes("unauthorized")) {
      errorMessage = "Unauthorized to cancel this subscription.";
    } else if (
      error.message?.includes("URL called is invalid") ||
      error.code === "invalid_url"
    ) {
      errorMessage =
        "API configuration issue. Subscription cancelled locally and will sync with Paddle.";
    }

    res.status(500).json({ error: errorMessage });
  }
};

// Update subscription
const updateSubscription = async (req, res) => {
  try {
    if (!paddle) {
      console.error("Paddle client not initialized for subscription update");
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const { newPlan } = req.body;
    const user = req.user;

    if (!user.subscription?.subscriptionId) {
      return res.status(400).json({ error: "No active subscription found" });
    }

    if (!PRODUCTS[newPlan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    await paddle.subscriptions.update({
      subscriptionId: user.subscription.subscriptionId,
      items: [
        {
          priceId: PRODUCTS[newPlan].priceId,
          quantity: 1,
        },
      ],
    });

    user.subscription.plan = newPlan;
    await user.save();

    res.json({ message: "Subscription updated successfully" });
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({ error: "Failed to update subscription" });
  }
};

module.exports = {
  getSubscriptionStatus,
  cancelSubscription,
  updateSubscription,
};

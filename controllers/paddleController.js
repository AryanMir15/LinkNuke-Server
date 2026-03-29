const { Paddle, Environment } = require("@paddle/paddle-node-sdk");
const User = require("../models/User");
const {
  checkRefundEligibility,
  validateRefundRequest,
  formatRefundAmount,
  logRefundActivity,
  getRefundPolicy,
} = require("../utils/refundUtils");

// Validate required environment variables (but don't crash the app)
const requiredEnvVars = [
  "PADDLE_API_KEY",
  "PADDLE_PRO_PRICE_ID",
  "PADDLE_LIFETIME_PRICE_ID",
  "CLIENT_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);
if (missingEnvVars.length > 0) {
  console.warn("Missing Paddle environment variables:", missingEnvVars);
  console.warn(
    "Paddle checkout functionality will not work until these are configured.",
  );
}

// Initialize Paddle client only if API key is available
let paddle = null;
if (process.env.PADDLE_API_KEY) {
  try {
    const environment =
      process.env.PADDLE_ENV === "sandbox"
        ? Environment.sandbox
        : Environment.production;

    console.log(
      "Initializing Paddle with environment:",
      process.env.PADDLE_ENV || "production",
    );
    console.log(
      "API Key prefix:",
      process.env.PADDLE_API_KEY.substring(0, 10) + "...",
    );

    paddle = new Paddle(process.env.PADDLE_API_KEY, {
      environment: environment,
    });

    console.log("Paddle initialized successfully");
    console.log(
      "Environment:",
      environment === Environment.sandbox ? "sandbox" : "production",
    );
  } catch (error) {
    console.error("Failed to initialize Paddle client:", error);
  }
} else {
  console.warn("PADDLE_API_KEY not found. Paddle functionality disabled.");
}

// Product/Price mapping
const PRODUCTS = {
  pro: {
    priceId: process.env.PADDLE_PRO_PRICE_ID,
    name: "Pro Plan",
    price: 9.0,
    currency: "USD",
  },
  lifetime: {
    priceId: process.env.PADDLE_LIFETIME_PRICE_ID,
    name: "Lifetime Plan",
    price: 49.0,
    currency: "USD",
  },
};

console.log("Product configuration loaded:", Object.keys(PRODUCTS));

// Create checkout session
const createCheckoutSession = async (req, res) => {
  try {
    const { productType } = req.body;
    const userId = req.user._id;
    const idempotencyKey = req.headers["idempotency-key"];

    console.log(`🛒 Creating ${productType} checkout for ${req.user.email}`);
    if (idempotencyKey) {
      console.log(`🔑 Idempotency key: ${idempotencyKey}`);
    }

    // Check if Paddle is initialized
    if (!paddle) {
      console.error("Paddle client not initialized");
      return res.status(503).json({
        error:
          "Payment service is currently unavailable. Please try again later.",
      });
    }

    if (!PRODUCTS[productType]) {
      console.error("Invalid product type:", productType);
      return res.status(400).json({ error: "Invalid product type" });
    }

    const product = PRODUCTS[productType];

    // Check if product has a valid priceId
    if (!product.priceId) {
      console.error("Missing priceId for product:", productType);
      return res.status(500).json({
        error: "Product configuration error. Please contact support.",
      });
    }

    // Get full user object from database
    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: "Email must be verified before purchasing a subscription",
      });
    }

    // Check for existing active subscription to prevent double purchases
    if (
      user.subscription &&
      user.subscription.status === "active" &&
      user.subscription.plan === productType
    ) {
      console.log(`⚠️ User already has active ${productType} subscription`);
      return res.status(409).json({
        error: "You already have an active subscription for this plan",
        currentSubscription: {
          plan: user.subscription.plan,
          status: user.subscription.status,
          endDate: user.subscription.endDate,
        },
      });
    }

    // IDEMPOTENCY CHECK: Check if we have a cached response for this key
    if (idempotencyKey) {
      try {
        // Look for existing checkout session with this idempotency key
        const existingUser = await User.findOne({
          "subscription.idempotencyKey": idempotencyKey,
        });

        if (existingUser && existingUser.subscription.checkoutUrl) {
          // Check if the cached checkout is still valid (15 minutes)
          const checkoutTime = existingUser.subscription.checkoutCreatedAt;
          const now = new Date();
          const minutesSinceCheckout = (now - checkoutTime) / (1000 * 60);

          if (minutesSinceCheckout < 15) {
            console.log(
              `⚡ Returning cached checkout for idempotency key: ${idempotencyKey}`,
            );
            return res.json({
              checkoutUrl: existingUser.subscription.checkoutUrl,
              transactionId: existingUser.subscription.transactionId,
              cached: true,
              minutesOld: Math.round(minutesSinceCheckout),
            });
          } else {
            console.log(
              `🕐 Cached checkout expired for idempotency key: ${idempotencyKey}`,
            );
            // Clear expired cache
            if (existingUser.subscription) {
              existingUser.subscription.idempotencyKey = null;
              existingUser.subscription.checkoutUrl = null;
              existingUser.subscription.checkoutCreatedAt = null;
              await existingUser.save();
            }
          }
        }
      } catch (error) {
        console.log("ℹ️ Checking idempotency cache:", error.message);
      }
    }

    // Use hosted checkout with customData for user identification
    const isSandbox = process.env.PADDLE_ENV === "sandbox";
    const baseUrl = isSandbox
      ? "https://sandbox-pay.paddle.io/hsc_01k2hs7cq223hqjfjb1e37pm1b_zv8rjbpb4zteq84hdrf0v0k0g3wgfxt6"
      : "https://pay.paddle.io/hsc_01k56t83qemqtktx2f6f1b45e6_f4vvezpggd0vfzdbrh74qyx71nh1xv1w";

    const hostedCheckoutUrl = new URL(baseUrl);

    // Add the specific price_id for the selected plan
    hostedCheckoutUrl.searchParams.set("price_id", product.priceId);
    hostedCheckoutUrl.searchParams.set("quantity", "1");
    hostedCheckoutUrl.searchParams.set("customer_email", user.email);

    // Store user mapping for webhook identification
    // Since passthrough doesn't work with hosted checkout, we'll use customer email lookup
    // The customer email will be set in the checkout URL and we can look it up in webhooks

    // Set redirect URLs
    hostedCheckoutUrl.searchParams.set(
      "success_url",
      `${process.env.CLIENT_URL}/dashboard?payment=success&userId=${user._id}&productType=${productType}`,
    );
    hostedCheckoutUrl.searchParams.set(
      "cancel_url",
      `${process.env.CLIENT_URL}/pricing?payment=cancelled`,
    );

    // Optional: Add these for better UX
    hostedCheckoutUrl.searchParams.set("disable_quantity", "true");
    hostedCheckoutUrl.searchParams.set("disable_coupon", "true");

    console.log(`✅ Checkout URL created for ${product.name}`);

    const checkoutUrl = hostedCheckoutUrl.toString();

    // CACHE THE CHECKOUT RESPONSE FOR IDEMPOTENCY
    if (idempotencyKey) {
      try {
        // Initialize subscription object if it doesn't exist
        if (!user.subscription) {
          user.subscription = {};
        }

        // Cache the checkout URL and idempotency key
        user.subscription.idempotencyKey = idempotencyKey;
        user.subscription.checkoutUrl = checkoutUrl;
        user.subscription.checkoutCreatedAt = new Date();

        await user.save();
        console.log(
          `💾 Cached checkout for idempotency key: ${idempotencyKey}`,
        );
      } catch (error) {
        console.error("❌ Error caching checkout:", error.message);
        // Don't fail the request if caching fails
      }
    }

    const response = {
      checkoutUrl: checkoutUrl,
      transactionId: null,
      originalCheckoutUrl: checkoutUrl,
      cached: false,
    };

    res.json(response);
  } catch (error) {
    console.error("Checkout creation error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      type: error.type,
      errors: error.errors,
    });
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// Handle webhooks
const handleWebhook = async (req, res) => {
  try {
    if (!paddle) {
      console.error("Paddle client not initialized for webhook");
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const signature = req.headers["paddle-signature"];

    if (!signature) {
      console.error("Missing webhook signature");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Convert raw body to string for verification
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body);

    // Verify webhook signature
    const event = await paddle.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET,
      signature,
    );

    console.log(`📨 Webhook: ${event.eventType}`);

    // Extract event ID for idempotency
    const eventId = event.id;
    const eventType = event.eventType;

    // Check if we've already processed this event
    if (eventId) {
      try {
        const existingUser = await User.findOne({
          "subscription.lastWebhookEventId": eventId,
        });

        if (existingUser) {
          console.log(
            `⚠️ Webhook event ${eventId} already processed, skipping`,
          );
          return res.json({ received: true, duplicate: true });
        }
      } catch (error) {
        console.log("ℹ️ Checking webhook idempotency:", error.message);
      }
    }

    try {
      switch (eventType) {
        case "transaction.created":
          console.log("⏳ Transaction created - waiting for completion");
          break;

        case "transaction.completed":
          console.log("✅ Processing transaction.completed...");
          await handleTransactionCompleted(event.data, eventId);
          console.log("✅ Transaction completed successfully");
          break;

        case "transaction.paid":
          console.log("✅ Processing transaction.paid...");
          await handleTransactionPaid(event.data, eventId);
          console.log("✅ Transaction paid successfully");
          break;

        case "transaction.payment_failed":
          console.log("❌ Processing transaction.payment_failed...");
          await handleTransactionPaymentFailed(event.data, eventId);
          console.log("✅ Transaction payment failed handled");
          break;

        case "transaction.refunded":
          console.log("🔄 Processing transaction.refunded...");
          await handleTransactionRefunded(event.data, eventId);
          console.log("✅ Transaction refunded handled");
          break;

        case "subscription.created":
          console.log("✅ Processing subscription.created...");
          await handleSubscriptionCreated(event.data, eventId);
          console.log("✅ Subscription created successfully");
          break;

        case "subscription.activated":
          console.log("✅ Processing subscription.activated...");
          await handleSubscriptionActivated(event.data, eventId);
          console.log("✅ Subscription activated successfully");
          break;

        case "subscription.updated":
          console.log("🔄 Processing subscription.updated...");
          await handleSubscriptionUpdated(event.data, eventId);
          console.log("✅ Subscription updated successfully");
          break;

        case "subscription.cancelled":
        case "subscription.canceled":
          console.log("❌ Processing subscription.cancelled...");
          await handleSubscriptionCancelled(event.data, eventId);
          console.log("✅ Subscription cancelled successfully");
          break;

        case "subscription.paused":
          console.log("⏸️ Processing subscription.paused...");
          await handleSubscriptionPaused(event.data, eventId);
          console.log("✅ Subscription paused successfully");
          break;

        case "subscription.resumed":
          console.log("▶️ Processing subscription.resumed...");
          await handleSubscriptionResumed(event.data, eventId);
          console.log("✅ Subscription resumed successfully");
          break;

        case "subscription.past_due":
          console.log("⚠️ Processing subscription.past_due...");
          await handleSubscriptionPastDue(event.data, eventId);
          console.log("✅ Subscription past due handled");
          break;

        default:
          console.log(`⚠️ Unhandled webhook event: ${eventType}`);
      }

      res.json({ received: true });
    } catch (webhookError) {
      console.error("❌ Webhook processing error:", webhookError.message);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  } catch (error) {
    console.error("🔍 WEBHOOK ERROR:", error.message);
    console.error("🔍 WEBHOOK ERROR STACK:", error.stack);

    if (
      error.message.includes("signature") ||
      error.message.includes("verification")
    ) {
      console.error("🔍 WEBHOOK: Signature verification failed");
      return res
        .status(400)
        .json({ error: "Webhook signature verification failed" });
    }

    console.error("🔍 WEBHOOK: General webhook processing error");
    res.status(400).json({ error: "Webhook processing failed" });
  }
};

// Webhook handlers
const handleTransactionCompleted = async (data, eventId = null) => {
  try {
    console.log(`💰 Processing transaction: ${data.id}`);
    console.log(`📊 Transaction data:`, JSON.stringify(data, null, 2));

    // For transaction.completed, we only need to log the transaction completion
    // The actual subscription activation is handled by subscription.activated webhook
    // This prevents double processing and conflicts

    const customerId = data.customerId;
    const transactionId = data.id;
    const status = data.status;

    console.log(
      `✅ Transaction ${transactionId} completed with status: ${status}`,
    );
    console.log(`🆔 Customer ID: ${customerId}`);

    // Only update transaction ID if we can find the user, but don't activate subscription
    if (customerId) {
      try {
        // Try to find user by customer ID
        const user = await User.findOne({
          "subscription.customerId": customerId,
        });

        if (user) {
          // Update transaction ID in subscription if it exists
          if (user.subscription) {
            user.subscription.transactionId = transactionId;
            if (eventId) user.subscription.lastWebhookEventId = eventId; // Store for idempotency
            await user.save();
            console.log(`📝 Updated transaction ID for user: ${user.email}`);
          }
        } else {
          console.log(
            `ℹ️ No user found for customer ID: ${customerId} - subscription activation will be handled by subscription.activated webhook`,
          );
        }
      } catch (error) {
        console.error(`❌ Error updating transaction ID:`, error.message);
      }
    }

    console.log(`✅ Transaction completed processing finished`);
  } catch (error) {
    console.error("Error handling transaction completed:", error);
  }
};

const handleSubscriptionCreated = async (data, eventId = null) => {
  try {
    const { customerId, customData } = data;
    const userId = customData?.userId;

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.subscription = {
          status: "active",
          subscriptionId: data.id,
          customerId: customerId,
          startDate: new Date(),
          endDate: new Date(data.nextBilledAt),
          lastWebhookEventId: eventId, // Store for idempotency
        };
        await user.save();
      }
    }
  } catch (error) {
    console.error("Error handling subscription created:", error);
  }
};

const handleSubscriptionActivated = async (data, eventId = null) => {
  try {
    console.log(`🎯 Processing subscription activation: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    // Try to get user data from customData first, then by customer ID lookup
    const customData = data.customData || {};
    const customerId = data.customerId;

    console.log(`🔍 Custom data:`, customData);
    console.log(`🆔 Customer ID:`, customerId);
    if (eventId) console.log(`🔑 Event ID: ${eventId}`);

    let userId = customData.userId;

    // If no userId from customData, try to find user by customer ID directly
    if (!userId && customerId) {
      try {
        console.log(`🔍 Looking up user by customer ID: ${customerId}`);
        const userByCustomerId = await User.findOne({
          "subscription.customerId": customerId,
        });
        if (userByCustomerId) {
          userId = userByCustomerId._id.toString();
          console.log(`✅ Found user by customer ID: ${userId}`);
        } else {
          console.log(`ℹ️ No user found for customer ID: ${customerId}`);

          // Try to find user by email from transaction data
          if (data.customer && data.customer.email) {
            const customerEmail = data.customer.email;
            console.log(`🔍 Trying to find user by email: ${customerEmail}`);
            const userByEmail = await User.findOne({ email: customerEmail });
            if (userByEmail) {
              userId = userByEmail._id.toString();
              console.log(`✅ Found user by email: ${userId}`);
            } else {
              console.log(`❌ No user found for email: ${customerEmail}`);
            }
          }
        }
      } catch (error) {
        console.error(
          `❌ Error looking up user by customer ID:`,
          error.message,
        );
      }
    }

    if (!userId) {
      console.error("❌ No userId found in subscription data");
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      return;
    }

    console.log(`👤 Activating subscription for: ${user.email}`);

    // Determine plan type from subscription data - fix data structure access
    let productType = "pro"; // Default to pro for now
    const priceId = data.items?.[0]?.price?.id;
    if (priceId === process.env.PADDLE_PRO_PRICE_ID) {
      productType = "pro";
    } else if (priceId === process.env.PADDLE_LIFETIME_PRICE_ID) {
      productType = "lifetime";
    }

    // Update user subscription status with plan limits
    const planLimits = {
      pro: { links: 500, customDomains: 3 },
      lifetime: { links: 9999, customDomains: 10 },
    };

    user.subscription = {
      status: "active",
      plan: productType,
      subscriptionId: data.id,
      customerId: data.customerId, // Fix: use customerId not customer_id
      startDate: new Date(data.startedAt || new Date()), // Fix: use startedAt not started_at
      endDate:
        productType === "lifetime"
          ? null
          : new Date(
              data.nextBilledAt || // Fix: use nextBilledAt not next_billed_at
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ),
      usageLimits: planLimits[productType],
      isTrial: false,
      trialDays: 0,
      firstPaymentDate: new Date(data.startedAt || new Date()), // Track first payment for refund window
      lastWebhookEventId: eventId, // Store event ID for idempotency
    };

    // Initialize usage counters if they don't exist
    if (!user.usage) {
      user.usage = {
        linksCreated: 0,
        storageUsed: 0,
      };
    } else {
      user.usage.linksCreated = user.usage.linksCreated || 0;
      user.usage.storageUsed = user.usage.storageUsed || 0;
    }

    await user.save();
    console.log(
      `🎉 User ${user.email} subscription activated for ${productType} plan!`,
    );
  } catch (error) {
    console.error("Error handling subscription activated:", error);
  }
};

const handleSubscriptionUpdated = async (data, eventId = null) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = data.status;
      user.subscription.endDate = new Date(data.nextBilledAt);
      if (eventId) user.subscription.lastWebhookEventId = eventId;
      await user.save();
    }
  } catch (error) {
    console.error("Error handling subscription updated:", error);
  }
};

const handleSubscriptionCancelled = async (data, eventId = null) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "cancelled";
      user.subscription.endDate = new Date(
        data.scheduledChange?.action == "cancel"
          ? data.scheduledChange.effectiveFrom
          : new Date(),
      );
      if (eventId) user.subscription.lastWebhookEventId = eventId;
      await user.save();
    }
  } catch (error) {
    console.error("Error handling subscription cancelled:", error);
  }
};

const handleSubscriptionPaused = async (data, eventId = null) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "paused";
      if (eventId) user.subscription.lastWebhookEventId = eventId;
      await user.save();
      console.log(`⏸️ Subscription paused for user: ${user.email}`);
    }
  } catch (error) {
    console.error("Error handling subscription paused:", error);
  }
};

// New webhook handlers for missing events
const handleTransactionPaid = async (data, eventId = null) => {
  try {
    console.log(`💰 Transaction paid: ${data.id}`);
    const customerId = data.customerId;

    if (customerId) {
      const user = await User.findOne({
        "subscription.customerId": customerId,
      });
      if (user) {
        console.log(`✅ Payment confirmed for user: ${user.email}`);
        if (eventId && user.subscription)
          user.subscription.lastWebhookEventId = eventId;
        await user.save();
        // Could add payment confirmation logic here
      }
    }
  } catch (error) {
    console.error("Error handling transaction paid:", error);
  }
};

const handleTransactionPaymentFailed = async (data, eventId = null) => {
  try {
    console.log(`❌ Payment failed for transaction: ${data.id}`);
    const customerId = data.customerId;

    if (customerId) {
      const user = await User.findOne({
        "subscription.customerId": customerId,
      });
      if (user) {
        console.log(`⚠️ Payment failed for user: ${user.email}`);
        if (eventId && user.subscription)
          user.subscription.lastWebhookEventId = eventId;
        await user.save();
        // Could add payment failure notification logic here
      }
    }
  } catch (error) {
    console.error("Error handling transaction payment failed:", error);
  }
};

const handleTransactionRefunded = async (data, eventId = null) => {
  try {
    console.log(`🔄 Transaction refunded: ${data.id}`);
    const customerId = data.customerId;

    if (customerId) {
      const user = await User.findOne({
        "subscription.customerId": customerId,
      });
      if (user) {
        console.log(`🔄 Refund processed for user: ${user.email}`);

        // Update user subscription with refund details
        user.subscription.refundStatus = "completed";
        user.subscription.refundedAt = new Date();
        user.subscription.refundAmount = data.amount || 0;
        user.subscription.status = "refunded";
        user.subscription.plan = "free";
        user.subscription.usageLimits = { links: 5, customDomains: 1 };
        user.subscription.endDate = new Date(); // Immediate access removal
        if (eventId) user.subscription.lastWebhookEventId = eventId;

        await user.save();
        console.log(
          `✅ User ${user.email} downgraded to free plan after refund`,
        );
      }
    }
  } catch (error) {
    console.error("Error handling transaction refunded:", error);
  }
};

const handleSubscriptionResumed = async (data, eventId = null) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "active";
      if (eventId) user.subscription.lastWebhookEventId = eventId;
      await user.save();
      console.log(`▶️ Subscription resumed for user: ${user.email}`);
    }
  } catch (error) {
    console.error("Error handling subscription resumed:", error);
  }
};

const handleSubscriptionPastDue = async (data, eventId = null) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "past_due";
      if (eventId) user.subscription.lastWebhookEventId = eventId;
      await user.save();
      console.log(`⚠️ Subscription past due for user: ${user.email}`);
      // Could add past due notification logic here
    }
  } catch (error) {
    console.error("Error handling subscription past due:", error);
  }
};

// Get subscription status
const getSubscriptionStatus = async (req, res) => {
  try {
    const user = req.user;

    // Define correct plan limits
    const planLimits = {
      free: { links: 5, customDomains: 1 },
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
                100,
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
                  (1000 * 60 * 60 * 24),
              ),
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
        "Paddle client not initialized for subscription cancellation",
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
          }/${maxRetries})`,
        );

        // Add timeout to the Paddle client call
        // Paddle SDK v3 - try different parameter formats
        console.log(
          `🔍 Attempting to cancel subscription with ID: ${user.subscription.subscriptionId}`,
        );

        // Try the correct Paddle SDK v3 format
        const cancelPromise = paddle.subscriptions.cancel(
          user.subscription.subscriptionId,
          {
            effectiveFrom: "next_billing_period",
          },
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
          apiError.message,
        );

        if (retryCount >= maxRetries) {
          // If all retries failed, we'll still update the local database
          console.error(
            `❌ All ${maxRetries} attempts failed. Proceeding with local cancellation.`,
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
              `⚠️ API error detected (${apiError.message}). Cancelling locally and will sync with Paddle later.`,
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
        `📅 Subscription will remain active until: ${user.subscription.endDate}`,
      );
    } else {
      // Immediate cancellation
      user.subscription.endDate = new Date();
      console.log(`⏰ Subscription cancelled immediately`);
    }

    await user.save();
    console.log(
      `✅ Subscription cancelled successfully for user: ${user.email}`,
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

// Get client token for Paddle initialization
const getClientToken = async (req, res) => {
  try {
    if (!paddle) {
      console.error(
        "Paddle client not initialized for client token generation",
      );
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    // Generate a client token for the user
    const clientToken = await paddle.clientTokens.create({
      name: "LinkNuke Checkout",
    });

    res.json({ clientToken: clientToken.token });
  } catch (error) {
    console.error("Error generating client token:", error);
    res.status(500).json({ error: "Failed to generate client token" });
  }
};

// Start trial
const startTrial = async (req, res) => {
  try {
    const { plan, trialDays = 3 } = req.body;
    const user = req.user;

    if (!PRODUCTS[plan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    // Check if user already has an active subscription or trial
    if (user.subscription?.status === "active") {
      return res
        .status(400)
        .json({ error: "You already have an active subscription" });
    }

    // Calculate trial end date
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    // Update user subscription to trial
    user.subscription = {
      status: "active",
      plan: plan,
      startDate: new Date(),
      endDate: trialEndDate,
      isTrial: true,
      trialDays: trialDays,
    };

    await user.save();

    res.json({
      message: `Started ${plan} trial successfully`,
      trialEndDate: trialEndDate,
      trialDays: trialDays,
    });
  } catch (error) {
    console.error("Trial start error:", error);
    res.status(500).json({ error: "Failed to start trial" });
  }
};

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
          user.subscription.subscriptionId,
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
        ? n(refundResult.data.totals.total / 100)
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
          ? n(refundResult.data.totals.total / 100).toFixed(2)
          : 0,
        refundedAt: user.subscription.refundedAt,
        accessRemoved: true,
        downgradedTo: "free",
      });

      res.json({
        message: "Refund processed successfully",
        refundId: refundResult.data?.id,
        refundAmount: refundResult.data?.totals?.total
          ? n(refundResult.data.totals.total / 100).toFixed(2)
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

// Manual upgrade function for testing
const manualUpgrade = async (req, res) => {
  try {
    const { userId, plan } = req.body;

    if (!userId || !plan) {
      return res.status(400).json({ error: "userId and plan are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user subscription
    const planLimits = {
      pro: { links: 500, customDomains: 3 },
      lifetime: { links: 9999, customDomains: 10 },
    };

    user.subscription = {
      status: "active",
      plan: plan,
      startDate: new Date(),
      endDate:
        plan === "lifetime"
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for pro
      usageLimits: planLimits[plan] || planLimits.pro,
      isTrial: false,
      trialDays: 0,
    };

    await user.save();

    console.log(`✅ Manually upgraded user ${user.email} to ${plan} plan`);

    res.json({
      success: true,
      message: `User upgraded to ${plan} plan successfully`,
      user: {
        email: user.email,
        plan: user.subscription.plan,
        status: user.subscription.status,
      },
    });
  } catch (error) {
    console.error("Manual upgrade error:", error);
    res.status(500).json({ error: "Failed to upgrade user" });
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  updateSubscription,
  startTrial,
  getClientToken,
  requestRefund,
  getRefundPolicyInfo,
  manualUpgrade,
};

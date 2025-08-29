const { Paddle, Environment } = require("@paddle/paddle-node-sdk");
const User = require("../models/User");

// Validate required environment variables (but don't crash the app)
const requiredEnvVars = [
  "PADDLE_API_KEY",
  "PADDLE_STARTER_PRICE_ID",
  "PADDLE_PRO_PRICE_ID",
  "PADDLE_LIFETIME_PRICE_ID",
  "CLIENT_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.warn("Missing Paddle environment variables:", missingEnvVars);
  console.warn(
    "Paddle checkout functionality will not work until these are configured."
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
      process.env.PADDLE_ENV || "production"
    );
    console.log(
      "API Key prefix:",
      process.env.PADDLE_API_KEY.substring(0, 10) + "..."
    );

    paddle = new Paddle(process.env.PADDLE_API_KEY, {
      environment: environment,
    });

    console.log("Paddle initialized successfully");
    console.log(
      "Environment:",
      environment === Environment.sandbox ? "sandbox" : "production"
    );
  } catch (error) {
    console.error("Failed to initialize Paddle client:", error);
  }
} else {
  console.warn("PADDLE_API_KEY not found. Paddle functionality disabled.");
}

// Product/Price mapping
const PRODUCTS = {
  starter: {
    priceId: process.env.PADDLE_STARTER_PRICE_ID,
    name: "Starter Plan",
    price: 9.0,
    currency: "USD",
  },
  pro: {
    priceId: process.env.PADDLE_PRO_PRICE_ID,
    name: "Pro Plan",
    price: 19.0,
    currency: "USD",
  },
  lifetime: {
    priceId: process.env.PADDLE_LIFETIME_PRICE_ID,
    name: "Lifetime Plan",
    price: 59.0,
    currency: "USD",
  },
};

console.log("Product configuration loaded:", Object.keys(PRODUCTS));

// Create checkout session
const createCheckoutSession = async (req, res) => {
  try {
    const { productType } = req.body;
    const userId = req.user._id;

    console.log(`🛒 Creating ${productType} checkout for ${req.user.email}`);

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

    // Use hosted checkout with customData for user identification
    const isSandbox = process.env.PADDLE_ENV === "sandbox";
    const baseUrl = isSandbox
      ? "https://sandbox-pay.paddle.io/hsc_01k2hs7cq223hqjfjb1e37pm1b_zv8rjbpb4zteq84hdrf0v0k0g3wgfxt6"
      : "https://checkout.paddle.com/hsc_01k2hs7cq223hqjfjb1e37pm1b_zv8rjbpb4zteq84hdrf0v0k0g3wgfxt6";

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
      `${process.env.CLIENT_URL}/dashboard?payment=success&userId=${user._id}&productType=${productType}`
    );
    hostedCheckoutUrl.searchParams.set(
      "cancel_url",
      `${process.env.CLIENT_URL}/pricing?payment=cancelled`
    );

    // Optional: Add these for better UX
    hostedCheckoutUrl.searchParams.set("disable_quantity", "true");
    hostedCheckoutUrl.searchParams.set("disable_coupon", "true");

    console.log(`✅ Checkout URL created for ${product.name}`);

    const response = {
      checkoutUrl: hostedCheckoutUrl.toString(),
      transactionId: null,
      originalCheckoutUrl: hostedCheckoutUrl.toString(),
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
      signature
    );

    console.log(`📨 Webhook: ${event.eventType}`);

    try {
      switch (event.eventType) {
        case "transaction.created":
          console.log("⏳ Transaction created - waiting for completion");
          break;

        case "transaction.completed":
          console.log("✅ Processing transaction.completed...");
          await handleTransactionCompleted(event.data);
          console.log("✅ Transaction completed successfully");
          break;

        case "transaction.paid":
          console.log("✅ Processing transaction.paid...");
          await handleTransactionPaid(event.data);
          console.log("✅ Transaction paid successfully");
          break;

        case "transaction.payment_failed":
          console.log("❌ Processing transaction.payment_failed...");
          await handleTransactionPaymentFailed(event.data);
          console.log("✅ Transaction payment failed handled");
          break;

        case "transaction.refunded":
          console.log("🔄 Processing transaction.refunded...");
          await handleTransactionRefunded(event.data);
          console.log("✅ Transaction refunded handled");
          break;

        case "subscription.created":
          console.log("✅ Processing subscription.created...");
          await handleSubscriptionCreated(event.data);
          console.log("✅ Subscription created successfully");
          break;

        case "subscription.activated":
          console.log("✅ Processing subscription.activated...");
          await handleSubscriptionActivated(event.data);
          console.log("✅ Subscription activated successfully");
          break;

        case "subscription.updated":
          console.log("🔄 Processing subscription.updated...");
          await handleSubscriptionUpdated(event.data);
          console.log("✅ Subscription updated successfully");
          break;

        case "subscription.cancelled":
        case "subscription.canceled":
          console.log("❌ Processing subscription.cancelled...");
          await handleSubscriptionCancelled(event.data);
          console.log("✅ Subscription cancelled successfully");
          break;

        case "subscription.paused":
          console.log("⏸️ Processing subscription.paused...");
          await handleSubscriptionPaused(event.data);
          console.log("✅ Subscription paused successfully");
          break;

        case "subscription.resumed":
          console.log("▶️ Processing subscription.resumed...");
          await handleSubscriptionResumed(event.data);
          console.log("✅ Subscription resumed successfully");
          break;

        case "subscription.past_due":
          console.log("⚠️ Processing subscription.past_due...");
          await handleSubscriptionPastDue(event.data);
          console.log("✅ Subscription past due handled");
          break;

        default:
          console.log(`⚠️ Unhandled webhook event: ${event.eventType}`);
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
const handleTransactionCompleted = async (data) => {
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
      `✅ Transaction ${transactionId} completed with status: ${status}`
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
            await user.save();
            console.log(`📝 Updated transaction ID for user: ${user.email}`);
          }
        } else {
          console.log(
            `ℹ️ No user found for customer ID: ${customerId} - subscription activation will be handled by subscription.activated webhook`
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

const handleSubscriptionCreated = async (data) => {
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
        };
        await user.save();
      }
    }
  } catch (error) {
    console.error("Error handling subscription created:", error);
  }
};

const handleSubscriptionActivated = async (data) => {
  try {
    console.log(`🎯 Processing subscription activation: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    // Try to get user data from customData first, then by customer ID lookup
    const customData = data.customData || {};
    const customerId = data.customerId;

    console.log(`🔍 Custom data:`, customData);
    console.log(`🆔 Customer ID:`, customerId);

    let userId = customData.userId;

    // If no userId from customData, try to get customer email from Paddle API
    if (!userId && customerId) {
      try {
        console.log(
          `🔍 Fetching customer details from Paddle API: ${customerId}`
        );
        const customer = await paddle.customers.get(customerId);
        const customerEmail = customer.email;

        if (customerEmail) {
          console.log(`📧 Found customer email: ${customerEmail}`);
          const userByEmail = await User.findOne({ email: customerEmail });
          if (userByEmail) {
            userId = userByEmail._id.toString();
            console.log(`✅ Found user by email: ${userId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching customer from Paddle:`, error.message);
      }
    }

    // If still no userId, try to find user by customer ID (fallback)
    if (!userId && customerId) {
      console.log(`🔍 Looking up user by customer ID: ${customerId}`);
      const userByCustomerId = await User.findOne({
        "subscription.customerId": customerId,
      });
      if (userByCustomerId) {
        userId = userByCustomerId._id.toString();
        console.log(`✅ Found user by customer ID: ${userId}`);
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
    if (priceId === process.env.PADDLE_STARTER_PRICE_ID) {
      productType = "starter";
    } else if (priceId === process.env.PADDLE_PRO_PRICE_ID) {
      productType = "pro";
    } else if (priceId === process.env.PADDLE_LIFETIME_PRICE_ID) {
      productType = "lifetime";
    }

    // Update user subscription status with plan limits
    const planLimits = {
      starter: { links: 10, customDomains: 1 },
      pro: { links: 50, customDomains: 3 },
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
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            ),
      usageLimits: planLimits[productType],
      isTrial: false,
      trialDays: 0,
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
      `🎉 User ${user.email} subscription activated for ${productType} plan!`
    );
  } catch (error) {
    console.error("Error handling subscription activated:", error);
  }
};

const handleSubscriptionUpdated = async (data) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = data.status;
      user.subscription.endDate = new Date(data.nextBilledAt);
      await user.save();
    }
  } catch (error) {
    console.error("Error handling subscription updated:", error);
  }
};

const handleSubscriptionCancelled = async (data) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "cancelled";
      user.subscription.endDate = new Date(
        data.scheduledChange?.action == "cancel"
          ? data.scheduledChange.effectiveFrom
          : new Date()
      );
      await user.save();
    }
  } catch (error) {
    console.error("Error handling subscription cancelled:", error);
  }
};

const handleSubscriptionPaused = async (data) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "paused";
      await user.save();
      console.log(`⏸️ Subscription paused for user: ${user.email}`);
    }
  } catch (error) {
    console.error("Error handling subscription paused:", error);
  }
};

// New webhook handlers for missing events
const handleTransactionPaid = async (data) => {
  try {
    console.log(`💰 Transaction paid: ${data.id}`);
    const customerId = data.customerId;

    if (customerId) {
      const user = await User.findOne({
        "subscription.customerId": customerId,
      });
      if (user) {
        console.log(`✅ Payment confirmed for user: ${user.email}`);
        // Could add payment confirmation logic here if needed
      }
    }
  } catch (error) {
    console.error("Error handling transaction paid:", error);
  }
};

const handleTransactionPaymentFailed = async (data) => {
  try {
    console.log(`❌ Payment failed for transaction: ${data.id}`);
    const customerId = data.customerId;

    if (customerId) {
      const user = await User.findOne({
        "subscription.customerId": customerId,
      });
      if (user) {
        console.log(`⚠️ Payment failed for user: ${user.email}`);
        // Could add payment failure notification logic here
      }
    }
  } catch (error) {
    console.error("Error handling transaction payment failed:", error);
  }
};

const handleTransactionRefunded = async (data) => {
  try {
    console.log(`🔄 Transaction refunded: ${data.id}`);
    const customerId = data.customerId;

    if (customerId) {
      const user = await User.findOne({
        "subscription.customerId": customerId,
      });
      if (user) {
        console.log(`🔄 Refund processed for user: ${user.email}`);
        // Could add refund processing logic here if needed
      }
    }
  } catch (error) {
    console.error("Error handling transaction refunded:", error);
  }
};

const handleSubscriptionResumed = async (data) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "active";
      await user.save();
      console.log(`▶️ Subscription resumed for user: ${user.email}`);
    }
  } catch (error) {
    console.error("Error handling subscription resumed:", error);
  }
};

const handleSubscriptionPastDue = async (data) => {
  try {
    const user = await User.findOne({ "subscription.subscriptionId": data.id });
    if (user) {
      user.subscription.status = "past_due";
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

    // Ensure user has subscription and usage data
    if (!user.subscription) {
      user.subscription = {
        status: "active",
        plan: "free",
        usageLimits: { links: 10, customDomains: 1 },
      };
      await user.save();
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
    const billingPeriod = user.subscription.endDate
      ? {
          start: user.subscription.startDate,
          end: user.subscription.endDate,
          remaining_days: Math.ceil(
            (user.subscription.endDate - Date.now()) / (1000 * 60 * 60 * 24)
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

    if (!user.subscription?.subscriptionId) {
      return res.status(400).json({ error: "No active subscription found" });
    }

    await paddle.subscriptions.cancel({
      subscriptionId: user.subscription.subscriptionId,
    });

    user.subscription.status = "cancelled";
    await user.save();

    res.json({ message: "Subscription cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
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
        "Paddle client not initialized for client token generation"
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

module.exports = {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  updateSubscription,
  startTrial,
  getClientToken,
};

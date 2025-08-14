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
    console.log("Creating checkout session with body:", req.body);
    const { productType } = req.body;
    const userId = req.user._id;

    console.log("User ID:", userId);
    console.log("Product Type:", productType);

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
    console.log("Product config:", product);

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

    console.log("User found:", user.email);

    // Use hosted checkout approach
    console.log("Creating hosted checkout URL...");

    // Build the hosted checkout URL with parameters
    const hostedCheckoutUrl = new URL(
      "https://sandbox-pay.paddle.io/hsc_01k2hs7cq223hqjfjb1e37pm1b_zv8rjbpb4zteq84hdrf0v0k0g3wgfxt6"
    );

    // Add the specific price_id for the selected plan
    hostedCheckoutUrl.searchParams.set("price_id", product.priceId);
    hostedCheckoutUrl.searchParams.set("quantity", "1");
    hostedCheckoutUrl.searchParams.set("customer_email", user.email);

    // Add custom data to track which plan was selected
    hostedCheckoutUrl.searchParams.set(
      "passthrough",
      JSON.stringify({
        userId: user._id.toString(),
        productType: productType,
        planName: product.name,
      })
    );

    // Set redirect URLs
    hostedCheckoutUrl.searchParams.set(
      "success_url",
      `${process.env.CLIENT_URL}/dashboard?payment=success`
    );
    hostedCheckoutUrl.searchParams.set(
      "cancel_url",
      `${process.env.CLIENT_URL}/pricing?payment=cancelled`
    );

    // Optional: Add these for better UX
    hostedCheckoutUrl.searchParams.set("disable_quantity", "true");
    hostedCheckoutUrl.searchParams.set("disable_coupon", "true");

    console.log("Hosted checkout URL created:", hostedCheckoutUrl.toString());
    console.log("Selected plan:", product.name);
    console.log("Price ID:", product.priceId);

    res.json({
      checkoutUrl: hostedCheckoutUrl.toString(),
      transactionId: null,
      originalCheckoutUrl: hostedCheckoutUrl.toString(),
    });
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
      return res.status(400).json({ error: "Missing signature" });
    }

    // req.body is raw Buffer because of express.raw; convert to string
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body);

    // Verify and parse webhook
    const event = await paddle.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET,
      signature
    );

    console.log("Webhook received:", event.eventType);

    switch (event.eventType) {
      case "transaction.completed":
        await handleTransactionCompleted(event.data);
        break;

      case "subscription.created":
        await handleSubscriptionCreated(event.data);
        break;

      case "subscription.updated":
        await handleSubscriptionUpdated(event.data);
        break;

      case "subscription.cancelled":
        await handleSubscriptionCancelled(event.data);
        break;

      case "subscription.paused":
        await handleSubscriptionPaused(event.data);
        break;

      default:
        console.log(`Unhandled webhook event: ${event.eventType}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).json({ error: "Webhook verification failed" });
  }
};

// Webhook handlers
const handleTransactionCompleted = async (data) => {
  try {
    const { customerId, customData } = data;
    const userId = customData?.userId;

    if (!userId) {
      console.error("No userId in transaction data");
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found:", userId);
      return;
    }

    // Update user subscription status with plan limits
    const planLimits = {
      starter: { links: 10, customDomains: 1 },
      pro: { links: 50, customDomains: 3 },
      lifetime: { links: 9999, customDomains: 10 },
    };

    user.subscription = {
      status: "active",
      plan: customData.productType,
      transactionId: data.id,
      customerId: customerId,
      startDate: new Date(),
      endDate:
        customData.productType === "lifetime"
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      usageLimits: planLimits[customData.productType],
      isTrial: false,
      trialDays: 0,
    };

    // Initialize usage counters
    user.usage.linksCreated = 0;
    user.usage.storageUsed = 0;

    await user.save();
    console.log(`User ${userId} subscription activated`);
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
    }
  } catch (error) {
    console.error("Error handling subscription paused:", error);
  }
};

// Get subscription status
const getSubscriptionStatus = async (req, res) => {
  try {
    const user = req.user;

    if (!user.subscription) {
      return res.json({
        hasSubscription: false,
        subscription: null,
      });
    }

    res.json({
      hasSubscription: true,
      subscription: user.subscription,
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

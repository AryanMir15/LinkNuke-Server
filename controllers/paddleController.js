const { Paddle } = require("@paddle/paddle-node-sdk");
const User = require("../models/User");

// Initialize Paddle client
const paddle = new Paddle({
  environment: process.env.PADDLE_ENV === "sandbox" ? "sandbox" : "production",
  apiKey: process.env.PADDLE_API_KEY,
});

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

// Create checkout session
const createCheckoutSession = async (req, res) => {
  try {
    const { productType } = req.body;
    const user = req.user;

    if (!PRODUCTS[productType]) {
      return res.status(400).json({ error: "Invalid product type" });
    }

    const product = PRODUCTS[productType];

    // Create customer if doesn't exist
    let customer;
    try {
      customer = await paddle.customers.get({
        customerId: user._id.toString(),
      });
    } catch (error) {
      // Customer doesn't exist, create one
      customer = await paddle.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        customData: {
          userId: user._id.toString(),
        },
      });
    }

    // Create transaction
    const transaction = await paddle.transactions.create({
      items: [
        {
          priceId: product.priceId,
          quantity: 1,
        },
      ],
      customerId: customer.id,
      customData: {
        userId: user._id.toString(),
        productType: productType,
      },
      successUrl: `${process.env.CLIENT_URL}/dashboard?payment=success`,
      cancelUrl: `${process.env.CLIENT_URL}/pricing?payment=cancelled`,
      returnUrl: `${process.env.CLIENT_URL}/dashboard?payment=return`,
    });

    res.json({
      checkoutUrl: transaction.checkout.url,
      transactionId: transaction.id,
    });
  } catch (error) {
    console.error("Checkout creation error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// Handle webhooks
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["paddle-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Missing signature" });
    }

    // Verify webhook signature
    const event = paddle.webhooks.verify({
      body: req.body,
      signature: signature,
      secret: process.env.PADDLE_WEBHOOK_SECRET,
    });

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

    // Update user subscription status
    user.subscription = {
      status: "active",
      plan: customData.productType,
      transactionId: data.id,
      customerId: customerId,
      startDate: new Date(),
      endDate:
        customData.productType === "lifetime"
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for monthly plans
    };

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
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  updateSubscription,
};

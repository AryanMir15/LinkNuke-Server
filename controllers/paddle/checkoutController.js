const User = require("../../models/User");
const { paddle, PRODUCTS } = require("./config");

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

    // Use Paddle API to create a proper checkout session
    try {
      const checkoutResponse = await paddle.transactions.create({
        items: [
          {
            priceId: product.priceId,
            quantity: 1,
          },
        ],
        customerEmail: user.email,
        customData: {
          userId: user._id.toString(),
          productType: productType,
        },
        successUrl: `${process.env.CLIENT_URL}/dashboard?payment=success&userId=${user._id}&productType=${productType}`,
        cancelUrl: `${process.env.CLIENT_URL}/pricing?payment=cancelled`,
      });

      console.log(`✅ Checkout session created for ${product.name}`);
      console.log(`Checkout URL: ${checkoutResponse.checkoutUrl}`);

      const response = {
        checkoutUrl: checkoutResponse.checkoutUrl,
        transactionId: checkoutResponse.id,
        originalCheckoutUrl: checkoutResponse.checkoutUrl,
      };

      res.json(response);
    } catch (paddleError) {
      console.error("Paddle API error:", paddleError);
      console.error("Paddle error details:", {
        message: paddleError.message,
        code: paddleError.code,
        detail: paddleError.detail,
        type: paddleError.type,
        errors: paddleError.errors,
      });

      return res.status(500).json({
        error: "Failed to create checkout session with Paddle",
        details: paddleError.message,
      });
    }
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
  getClientToken,
  startTrial,
};

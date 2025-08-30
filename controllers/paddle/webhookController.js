const User = require("../../models/User");
const { paddle, PRODUCTS } = require("./config");

// Main webhook handler
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
        console.log(
          `🔍 Fetching customer details from Paddle API: ${customerId}`
        );
        const customer = await paddle.customers.get(customerId);
        const customerEmail = customer.email;

        if (customerEmail) {
          console.log(`📧 Found customer email: ${customerEmail}`);
          const userByEmail = await User.findOne({ email: customerEmail });

          if (userByEmail) {
            console.log(`👤 Found user by email: ${userByEmail.email}`);
            // Only update transaction ID, don't activate subscription yet
            if (!userByEmail.subscription.transactionId) {
              userByEmail.subscription.transactionId = transactionId;
              await userByEmail.save();
              console.log(
                `✅ Updated transaction ID for user: ${userByEmail.email}`
              );
            }
          } else {
            console.log(`❌ No user found with email: ${customerEmail}`);
          }
        }
      } catch (error) {
        console.error("Error fetching customer details:", error.message);
      }
    }

    console.log(`✅ Transaction completed handler finished`);
  } catch (error) {
    console.error("❌ Error in handleTransactionCompleted:", error.message);
    throw error;
  }
};

const handleSubscriptionCreated = async (data) => {
  try {
    console.log(`📋 Processing subscription created: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const subscriptionId = data.id;
    const status = data.status;

    console.log(
      `✅ Subscription ${subscriptionId} created with status: ${status}`
    );
    console.log(`🆔 Customer ID: ${customerId}`);

    if (customerId) {
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
            console.log(`👤 Found user by email: ${userByEmail.email}`);
            // Update subscription ID but don't activate yet
            userByEmail.subscription.subscriptionId = subscriptionId;
            await userByEmail.save();
            console.log(
              `✅ Updated subscription ID for user: ${userByEmail.email}`
            );
          } else {
            console.log(`❌ No user found with email: ${customerEmail}`);
          }
        }
      } catch (error) {
        console.error("Error fetching customer details:", error.message);
      }
    }

    console.log(`✅ Subscription created handler finished`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionCreated:", error.message);
    throw error;
  }
};

const handleSubscriptionActivated = async (data) => {
  try {
    console.log(`🚀 Processing subscription activated: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const subscriptionId = data.id;
    const status = data.status;

    console.log(
      `✅ Subscription ${subscriptionId} activated with status: ${status}`
    );
    console.log(`🆔 Customer ID: ${customerId}`);

    if (customerId) {
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
            console.log(`👤 Found user by email: ${userByEmail.email}`);

            // Determine product type from subscription items
            let productType = "starter"; // default
            if (data.items && data.items.length > 0) {
              const priceId = data.items[0].price?.id;
              console.log(`💰 Price ID: ${priceId}`);

              // Map price ID to product type
              if (priceId === PRODUCTS.pro.priceId) {
                productType = "pro";
              } else if (priceId === PRODUCTS.lifetime.priceId) {
                productType = "lifetime";
              } else if (priceId === PRODUCTS.starter.priceId) {
                productType = "starter";
              }
            }

            console.log(`📦 Product type determined: ${productType}`);

            // Update user subscription status with plan limits
            const planLimits = {
              starter: { links: 10, customDomains: 1 },
              pro: { links: 500, customDomains: 3 },
              lifetime: { links: 9999, customDomains: 10 },
            };

            userByEmail.subscription = {
              status: "active",
              plan: productType,
              subscriptionId: subscriptionId,
              customerId: customerId,
              startDate: new Date(data.startedAt || new Date()),
              endDate: new Date(
                data.nextBilledAt || // Fix: use nextBilledAt not next_billed_at
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              ),
              usageLimits: planLimits[productType],
              isTrial: false,
              trialDays: 0,
              firstPaymentDate: new Date(data.startedAt || new Date()), // Track first payment for refund window
            };

            await userByEmail.save();

            console.log(
              `✅ Subscription activated for user: ${userByEmail.email}`
            );
            console.log(`📦 Plan: ${productType}`);
            console.log(`🔗 Links limit: ${planLimits[productType].links}`);
            console.log(
              `🌐 Custom domains limit: ${planLimits[productType].customDomains}`
            );
          } else {
            console.log(`❌ No user found with email: ${customerEmail}`);
          }
        }
      } catch (error) {
        console.error("Error fetching customer details:", error.message);
      }
    }

    console.log(`✅ Subscription activated handler finished`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionActivated:", error.message);
    throw error;
  }
};

const handleSubscriptionUpdated = async (data) => {
  try {
    console.log(`🔄 Processing subscription updated: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const subscriptionId = data.id;

    console.log(`✅ Subscription ${subscriptionId} updated`);
    console.log(`🆔 Customer ID: ${customerId}`);

    // Handle subscription updates (plan changes, etc.)
    // Implementation depends on your specific needs

    console.log(`✅ Subscription updated handler finished`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionUpdated:", error.message);
    throw error;
  }
};

const handleSubscriptionCancelled = async (data) => {
  try {
    console.log(`❌ Processing subscription cancelled: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const subscriptionId = data.id;

    console.log(`✅ Subscription ${subscriptionId} cancelled`);
    console.log(`🆔 Customer ID: ${customerId}`);

    // Handle subscription cancellation
    // Implementation depends on your specific needs

    console.log(`✅ Subscription cancelled handler finished`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionCancelled:", error.message);
    throw error;
  }
};

const handleSubscriptionPaused = async (data) => {
  try {
    console.log(`⏸️ Processing subscription paused: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const subscriptionId = data.id;

    console.log(`✅ Subscription ${subscriptionId} paused`);
    console.log(`🆔 Customer ID: ${customerId}`);

    // Handle subscription pause
    // Implementation depends on your specific needs

    console.log(`✅ Subscription paused handler finished`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionPaused:", error.message);
    throw error;
  }
};

const handleTransactionPaid = async (data) => {
  try {
    console.log(`💰 Processing transaction paid: ${data.id}`);
    console.log(`📊 Transaction data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const transactionId = data.id;
    const status = data.status;

    console.log(`✅ Transaction ${transactionId} paid with status: ${status}`);
    console.log(`🆔 Customer ID: ${customerId}`);

    // Handle transaction payment
    // Implementation depends on your specific needs

    console.log(`✅ Transaction paid handler finished`);
  } catch (error) {
    console.error("❌ Error in handleTransactionPaid:", error.message);
    throw error;
  }
};

const handleTransactionPaymentFailed = async (data) => {
  try {
    console.log(`❌ Processing transaction payment failed: ${data.id}`);
    console.log(`📊 Transaction data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const transactionId = data.id;
    const status = data.status;

    console.log(
      `❌ Transaction ${transactionId} payment failed with status: ${status}`
    );
    console.log(`🆔 Customer ID: ${customerId}`);

    // Handle payment failure
    // Implementation depends on your specific needs

    console.log(`✅ Transaction payment failed handler finished`);
  } catch (error) {
    console.error("❌ Error in handleTransactionPaymentFailed:", error.message);
    throw error;
  }
};

const handleTransactionRefunded = async (data) => {
  try {
    console.log(`🔄 Processing transaction refunded: ${data.id}`);
    console.log(`📊 Transaction data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const transactionId = data.id;
    const amount = data.amount;

    console.log(
      `✅ Transaction ${transactionId} refunded for amount: ${amount}`
    );
    console.log(`🆔 Customer ID: ${customerId}`);

    if (customerId) {
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
            console.log(`👤 Found user by email: ${userByEmail.email}`);

            // Update user with refund details
            userByEmail.subscription.refundStatus = "completed";
            userByEmail.subscription.refundedAt = new Date();
            userByEmail.subscription.refundAmount = amount || 0;
            userByEmail.subscription.status = "refunded";
            userByEmail.subscription.plan = "free";
            userByEmail.subscription.usageLimits = {
              links: 5,
              customDomains: 1,
            };
            userByEmail.subscription.endDate = new Date(); // Immediate access removal

            await userByEmail.save();

            console.log(`✅ Refund processed for user: ${userByEmail.email}`);
            console.log(`💰 Refund amount: ${amount}`);
            console.log(`📦 Downgraded to: free plan`);
          } else {
            console.log(`❌ No user found with email: ${customerEmail}`);
          }
        }
      } catch (error) {
        console.error("Error fetching customer details:", error.message);
      }
    }

    console.log(`✅ Transaction refunded handler finished`);
  } catch (error) {
    console.error("❌ Error in handleTransactionRefunded:", error.message);
    throw error;
  }
};

const handleSubscriptionResumed = async (data) => {
  try {
    console.log(`▶️ Processing subscription resumed: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const subscriptionId = data.id;

    console.log(`✅ Subscription ${subscriptionId} resumed`);
    console.log(`🆔 Customer ID: ${customerId}`);

    // Handle subscription resume
    // Implementation depends on your specific needs

    console.log(`✅ Subscription resumed handler finished`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionResumed:", error.message);
    throw error;
  }
};

const handleSubscriptionPastDue = async (data) => {
  try {
    console.log(`⚠️ Processing subscription past due: ${data.id}`);
    console.log(`📊 Subscription data:`, JSON.stringify(data, null, 2));

    const customerId = data.customerId;
    const subscriptionId = data.id;

    console.log(`⚠️ Subscription ${subscriptionId} is past due`);
    console.log(`🆔 Customer ID: ${customerId}`);

    // Handle past due subscription
    // Implementation depends on your specific needs

    console.log(`✅ Subscription past due handler finished`);
  } catch (error) {
    console.error("❌ Error in handleSubscriptionPastDue:", error.message);
    throw error;
  }
};

module.exports = {
  handleWebhook,
  handleTransactionCompleted,
  handleSubscriptionCreated,
  handleSubscriptionActivated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handleSubscriptionPaused,
  handleTransactionPaid,
  handleTransactionPaymentFailed,
  handleTransactionRefunded,
  handleSubscriptionResumed,
  handleSubscriptionPastDue,
};

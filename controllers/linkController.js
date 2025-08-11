let nanoid;
(async () => {
  const nanoidModule = await import("nanoid");
  nanoid = nanoidModule.nanoid;
})();
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat.js");
const paddle = require("@paddle/paddle-node-sdk");

dayjs.extend(customParseFormat);

// Initialize Paddle SDK
const vendorId = process.env.PADDLE_VENDOR_ID;
const apiKey = process.env.PADDLE_API_KEY;
const isSandbox = process.env.PADDLE_ENV === "sandbox";

const paddleClient = new paddle.Client({
  vendorId: vendorId,
  apiKey: apiKey,
  sandbox: isSandbox,
});

const Link = require("../models/Link.js");

// Existing link controller functions here...

// Paddle Checkout functions
const createCheckoutSession = async (req, res) => {
  try {
    const { priceId } = req.body;
    const user = req.user;

    const checkoutResponse = await paddleClient.checkout.createPaymentIntent({
      items: [{ priceId, quantity: 1 }],
      customerId: user._id.toString(),
      successUrl: `${process.env.CLIENT_URL}/dashboard?payment=success`,
      cancelUrl: `${process.env.CLIENT_URL}/pricing?payment=cancelled`,
    });

    res.json({ checkoutUrl: checkoutResponse.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

const handleWebhook = async (req, res) => {
  let event;
  try {
    event = paddleClient.webhooks.constructEvent(
      req.body,
      req.headers["paddle-signature"],
      process.env.PADDLE_WEBHOOK_KEY
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "payment.completed":
      const payment = event.data;
      // Handle payment completion logic
      break;
    // Add other webhook handlers as needed
  }

  res.json({ received: true });
};

module.exports = {
  createLink,
  getAllLinks,
  getSingleLink,
  trackLinkView,
  updateLink,
  deleteLink,
  getLinkByLinkId,
  createCheckoutSession,
  handleWebhook,
};

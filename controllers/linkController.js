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
const {
  canCreateLink,
  canUploadFile,
  updateStorageUsage,
} = require("../utils/subscriptionUtils");

// Create link with subscription check
const createLink = async (req, res) => {
  try {
    const { title, description, fileUrl, fileType, fileSize } = req.body;
    const userId = req.user._id;

    // Check if user can create more links
    const linkCheck = await canCreateLink(userId);
    if (!linkCheck.allowed) {
      return res.status(403).json({ error: linkCheck.reason });
    }

    // Check if user can upload this file type/size
    if (fileUrl && fileType && fileSize) {
      const uploadCheck = await canUploadFile(userId, fileSize, fileType);
      if (!uploadCheck.allowed) {
        return res.status(403).json({ error: uploadCheck.reason });
      }
    }

    const linkId = nanoid(10);
    const link = await Link.create({
      linkId,
      title,
      description,
      fileUrl,
      fileType,
      fileSize,
      userId,
    });

    // Update user's link count and storage usage
    if (fileSize) {
      await updateStorageUsage(userId, fileSize, "add");
    }

    res.status(201).json({ link });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

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

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
const isSandbox = process.env.PADDLE_ENV === "sandbox";

const paddleClient = new paddle.Paddle({
  environment: isSandbox ? "sandbox" : "production",
  apiKey: process.env.PADDLE_API_KEY,
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

// Get all links
const getAllLinks = async (req, res) => {
  try {
    const links = await Link.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({ links });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Get single link
const getSingleLink = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await Link.findOne({ _id: id, userId: req.user._id });
    if (!link) return res.status(404).json({ error: "Link not found" });
    res.json({ link });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Track link view
const trackLinkView = async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await Link.findOne({ linkId });
    if (!link) return res.status(404).json({ error: "Link not found" });
    link.views = (link.views || 0) + 1;
    await link.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Update link
const updateLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const link = await Link.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { title, description },
      { new: true }
    );
    if (!link) return res.status(404).json({ error: "Link not found" });
    res.json({ link });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Delete link
const deleteLink = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await Link.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!link) return res.status(404).json({ error: "Link not found" });
    if (link.fileSize)
      await updateStorageUsage(req.user._id, link.fileSize, "remove");
    res.json({ message: "Link deleted" });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Get link by linkId
const getLinkByLinkId = async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await Link.findOne({ linkId });
    if (!link) return res.status(404).json({ error: "Link not found" });
    res.json({ link });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

const handleWebhook = async (req, res) => {
  let event;
  try {
    event = paddleClient.webhooks.constructEvent(
      req.body,
      req.headers["paddle-signature"],
      process.env.PADDLE_WEBHOOK_SECRET
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

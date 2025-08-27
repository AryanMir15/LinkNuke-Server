const crypto = require("crypto");
const mongoose = require("mongoose");
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

const Link = require("../models/Link");
const User = require("../models/User");
const {
  canCreateLink,
  canUploadFile,
  updateStorageUsage,
  getUserPlanLimits,
} = require("../utils/subscriptionUtils");

// Create a new link
const createLink = async (req, res) => {
  try {
    // Idempotency key handling (removed redis dependency for now)
    const idempotencyKey = req.headers["idempotency-key"];
    if (idempotencyKey) {
      // TODO: Implement proper idempotency with redis
      console.log("Idempotency key received:", idempotencyKey);
    }

    const cleanBody = Object.keys(req.body).reduce((acc, key) => {
      if (req.body[key] !== undefined) acc[key] = req.body[key];
      return acc;
    }, {});
    console.log("Creating link with body:", cleanBody);

    const {
      title,
      format,
      text,
      imageUrl,
      videoUrl,
      audioUrl,
      documentUrl,
      expiresAt,
      maxViews,
      extraSecure,
    } = req.body;
    const userId = req.user._id;

    console.log("User ID:", userId);
    console.log("Format:", format);

    // Check if user can create more links
    const linkCheck = await canCreateLink(userId);
    console.log("Link check result:", linkCheck);

    if (!linkCheck.allowed) {
      return res.status(403).json({ error: linkCheck.reason });
    }

    // Check file upload permissions for file-based formats
    if (
      format !== "text" &&
      (imageUrl || videoUrl || audioUrl || documentUrl)
    ) {
      // Determine the file type based on the format and URL
      let fileType = "text/plain"; // default

      if (format === "image" && imageUrl) {
        fileType = "image/jpeg"; // assume JPEG for images
      } else if (format === "video" && videoUrl) {
        fileType = "video/mp4"; // assume MP4 for videos
      } else if (format === "audio" && audioUrl) {
        fileType = "audio/mpeg"; // assume MP3 for audio
      } else if (format === "document" && documentUrl) {
        fileType = "application/pdf"; // assume PDF for documents
      }

      const fileCheck = await canUploadFile(userId, 0, fileType, 1);
      if (!fileCheck.allowed) {
        return res.status(403).json({ error: fileCheck.reason });
      }
    }

    // Generate unique link ID
    const linkId = crypto.randomBytes(8).toString("hex");

    // Create the link with explicit ID
    const linkData = {
      userId,
      title,
      format,
      text,
      imageUrl,
      videoUrl,
      audioUrl,
      documentUrl,
      expiresAt,
      maxViews,
      extraSecure,
      status: "Active",
      linkId,
      url: `${process.env.CLIENT_URL}/preview/${linkId}`,
    };

    console.log("Creating link with data:", linkData);

    const link = new Link(linkData);
    await link.save();

    // Usage is updated by the trackUsage middleware
    console.log("Link saved successfully:", link._id);

    const responsePayload = {
      _id: link._id,
      title: link.title,
      format: link.format,
      linkId: link.linkId,
      url: link.url,
      status: link.status,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      maxViews: link.maxViews,
      views: link.views,
      extraSecure: link.extraSecure,
      text: link.text,
      imageUrl: link.imageUrl,
      videoUrl: link.videoUrl,
      audioUrl: link.audioUrl,
      documentUrl: link.documentUrl,
    };

    // Cache successful response if idempotency key exists
    if (idempotencyKey) {
      // TODO: Implement proper idempotency with redis
      console.log("Idempotency key received:", idempotencyKey);
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    console.error("Error creating link:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to create link" });
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
    res.json(links); // Return links array directly
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Get usage statistics
const getUsageStats = asyncHandler(async (req, res) => {
  console.log("🔍🔍🔍 GET USAGE STATS FUNCTION START");
  console.log("🔍🔍🔍 req.user:", req.user);
  console.log("🔍🔍🔍 req.user._id:", req.user._id);
  console.log("🔍🔍🔍 req.user._id type:", typeof req.user._id);

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Explicitly convert user ID to string
    const userId = req.user._id.toString();

    console.log("🔍🔍🔍 [Usage Stats] User ID:", userId);
    console.log("🔍🔍🔍 [Usage Stats] User ID type:", typeof userId);
    console.log("🔍🔍🔍 [Usage Stats] Start of month:", startOfMonth);

    console.log("🔍🔍🔍 [Usage Stats] Starting aggregation...");
    const stats = await Link.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          monthlyTotal: { $sum: 1 },
        },
      },
    ]);

    console.log("🔍🔍🔍 [Usage Stats] Aggregation result:", stats);

    console.log("🔍🔍🔍 [Usage Stats] Starting countDocuments...");
    const allTimeTotal = await Link.countDocuments({
      userId: mongoose.Types.ObjectId(userId),
    });
    console.log("🔍🔍🔍 [Usage Stats] All time total:", allTimeTotal);

    const response = {
      monthlyTotal: stats[0]?.monthlyTotal || 0,
      allTimeTotal: allTimeTotal,
    };

    console.log("🔍🔍🔍 [Usage Stats] Sending response:", response);
    console.log("🔍🔍🔍 [Usage Stats] Response status: 200");
    res.status(200).json(response);
    console.log("🔍🔍🔍 [Usage Stats] Response sent successfully");
  } catch (error) {
    console.error("🔍🔍🔍 [Usage Stats Error]", error);
    console.error("🔍🔍🔍 Error stack:", error.stack);
    console.error("🔍🔍🔍 Error message:", error.message);
    console.error("🔍🔍🔍 Error name:", error.name);
    res.status(500).json({
      error: "Failed to fetch stats",
      details: error.message,
    });
  }
});

// Get single link
const getSingleLink = async (req, res) => {
  console.log("🔍🔍🔍 GET SINGLE LINK FUNCTION START");
  console.log("🔍🔍🔍 req.params:", req.params);
  console.log("🔍🔍🔍 req.user._id:", req.user._id);

  try {
    const { id } = req.params;
    console.log("🔍🔍🔍 Link ID from params:", id);
    console.log("🔍🔍🔍 User ID:", req.user._id);

    console.log("🔍🔍🔍 Searching for link with criteria:", {
      _id: id,
      userId: req.user._id,
    });
    const link = await Link.findOne({ _id: id, userId: req.user._id });
    console.log("🔍🔍🔍 Link found:", link ? "YES" : "NO");

    if (!link) {
      console.log("🔍🔍🔍 Link not found, returning 404");
      return res.status(404).json({ error: "Link not found" });
    }

    console.log("🔍🔍🔍 Link found, sending response");
    res.json({ link });
  } catch (error) {
    console.error("🔍🔍🔍 Error in getSingleLink:", error);
    console.error("🔍🔍🔍 Error stack:", error.stack);
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Track link view
const trackLinkView = async (req, res) => {
  try {
    const { id } = req.params; // Changed from linkId to id to match route
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const link = await Link.findById(id); // Use findById instead of findOne with linkId
    if (!link) return res.status(404).json({ error: "Link not found" });

    // Prevent duplicate views from same IP
    if (link.viewersIPs?.includes(ip)) {
      return res.json({ success: true }); // Don't count but still return success
    }

    // Check view limits and expiration
    if (link.views >= (link.maxViews || 0)) {
      link.status = "Expired";
      await link.save();
      return res
        .status(410)
        .json({ success: false, error: "View limit reached" });
    }

    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      link.status = "Expired";
      await link.save();
      return res.status(410).json({ success: false, error: "Link expired" });
    }

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
    res.json(link); // Return link object directly
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
  getUsageStats,
};

const crypto = require("crypto");
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat.js");

dayjs.extend(customParseFormat);

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

    // Increment total links created counter (never decreases)
    await User.findByIdAndUpdate(userId, {
      $inc: { "usage.totalLinksCreated": 1 },
    });

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

    console.log("🔍 Link created - URL:", link.url);
    console.log("🔍 Link created - LinkId:", link.linkId);

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
    const links = await Link.find({
      userId: req.user._id,
      deleted: false,
    }).sort({
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
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Explicitly convert user ID to string
    const userId = req.user._id.toString();

    const stats = await Link.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startOfMonth },
          // Don't filter by deleted - count ALL links created this month
        },
      },
      {
        $group: {
          _id: null,
          monthlyTotal: { $sum: 1 },
        },
      },
    ]);

    const allTimeTotal = await Link.countDocuments({
      userId: mongoose.Types.ObjectId(userId),
      deleted: false, // Only count non-deleted links for all-time total
    });

    const response = {
      monthlyTotal: stats[0]?.monthlyTotal || 0,
      allTimeTotal: allTimeTotal,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Usage stats error:", error);
    res.status(500).json({
      error: "Failed to fetch stats",
      details: error.message,
    });
  }
});

// Get single link
const getSingleLink = async (req, res) => {
  try {
    const { id } = req.params;

    const link = await Link.findOne({
      _id: id,
      userId: req.user._id,
      deleted: false,
    });

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    res.json({ link });
  } catch (error) {
    console.error("Error in getSingleLink:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Track link view
const trackLinkView = async (req, res) => {
  try {
    const { id } = req.params; // Changed from linkId to id to match route
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    console.log("🔍 trackLinkView: Tracking link ID:", id);
    console.log("🔍 trackLinkView: IP address:", ip);

    const link = await Link.findOne({ _id: id, deleted: false }); // Don't track deleted links
    if (!link) {
      console.log("🔍 trackLinkView: Link not found");
      return res.status(404).json({ error: "Link not found" });
    }

    console.log("🔍 trackLinkView: Link found - current views:", link.views);
    console.log("🔍 trackLinkView: Max views:", link.maxViews);
    console.log("🔍 trackLinkView: ViewersIPs:", link.viewersIPs);

    // Prevent duplicate views from same IP
    if (link.viewersIPs?.includes(ip)) {
      console.log(
        "🔍 trackLinkView: Duplicate view from same IP - not counting"
      );
      return res.json({ success: true }); // Don't count but still return success
    }

    // Check view limits and expiration
    if (link.views >= (link.maxViews || 0)) {
      console.log("🔍 trackLinkView: View limit reached");
      link.status = "Expired";
      await link.save();
      return res
        .status(410)
        .json({ success: false, error: "View limit reached" });
    }

    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      console.log("🔍 trackLinkView: Link expired");
      link.status = "Expired";
      await link.save();
      return res.status(410).json({ success: false, error: "Link expired" });
    }

    console.log(
      "🔍 trackLinkView: Incrementing views from",
      link.views,
      "to",
      (link.views || 0) + 1
    );
    link.views = (link.views || 0) + 1;

    // Add IP to viewersIPs array
    if (!link.viewersIPs) {
      link.viewersIPs = [];
    }
    link.viewersIPs.push(ip);

    await link.save();
    console.log("🔍 trackLinkView: Link saved successfully");
    res.json({ success: true });
  } catch (error) {
    console.error("🔍 trackLinkView: Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Update link
const updateLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const link = await Link.findOneAndUpdate(
      { _id: id, userId: req.user._id, deleted: false },
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
    // Soft delete: mark as deleted instead of removing from database
    const link = await Link.findOneAndUpdate(
      { _id: id, userId: req.user._id, deleted: false },
      { deleted: true },
      { new: true }
    );
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
    const link = await Link.findOne({ linkId, deleted: false });
    if (!link) return res.status(404).json({ error: "Link not found" });
    res.json(link); // Return link object directly
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Webhook handler moved to paddleController.js

module.exports = {
  createLink,
  getAllLinks,
  getSingleLink,
  trackLinkView,
  updateLink,
  deleteLink,
  getLinkByLinkId,
  createCheckoutSession,
  getUsageStats,
};

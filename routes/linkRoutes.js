const express = require("express");
const authMiddleware = require("../middleware/auth");
const { checkSubscription, trackUsage } = require("../middleware/subscription");
const {
  createLink,
  getAllLinks,
  getSingleLink,
  trackLinkView,
  updateLink,
  deleteLink,
  getLinkByLinkId,
  getUsageStats,
} = require("../controllers/linkController");
const router = express.Router();

router.delete("/links/:id", deleteLink);
router.post("/links/track/:id", trackLinkView);
router.get("/links/usage-stats", (req, res, next) => {
  console.log("🔍🔍🔍 USAGE STATS ROUTE HIT");
  console.log("🔍🔍🔍 Request URL:", req.originalUrl);
  console.log("🔍🔍🔍 Request method:", req.method);
  console.log("🔍🔍🔍 User ID:", req.user._id);
  console.log("🔍🔍🔍 Calling getUsageStats function");
  getUsageStats(req, res, next);
});
router.get("/links/:id", (req, res, next) => {
  console.log("🔍🔍🔍 SINGLE LINK ROUTE HIT");
  console.log("🔍🔍🔍 Request URL:", req.originalUrl);
  console.log("🔍🔍🔍 Request method:", req.method);
  console.log("🔍🔍🔍 Link ID:", req.params.id);
  console.log("🔍🔍🔍 User ID:", req.user._id);
  console.log("🔍🔍🔍 Calling getSingleLink function");
  getSingleLink(req, res, next);
});
router.post("/links", checkSubscription(), trackUsage("link"), createLink);
router.get("/links", getAllLinks);
router.patch("/links/:id", updateLink);
// Public route for preview and sharing
router.get("/public/links/:linkId", getLinkByLinkId);

module.exports = router;

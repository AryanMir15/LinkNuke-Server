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
router.get("/links/usage-stats", getUsageStats);
router.get("/links/:id", getSingleLink);
router.post("/links", checkSubscription(), trackUsage("link"), createLink);
router.get("/links", getAllLinks);
router.patch("/links/:id", updateLink);
// Public route for preview and sharing
router.get("/public/links/:linkId", getLinkByLinkId);

module.exports = router;

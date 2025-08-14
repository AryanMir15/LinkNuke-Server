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
} = require("../controllers/linkController");
const router = express.Router();

router.delete("/links/:id", authMiddleware, deleteLink);
router.post("/links/track/:id", trackLinkView);
router.get("/links/:id", authMiddleware, getSingleLink);
router.post(
  "/links",
  authMiddleware,
  checkSubscription(),
  trackUsage("link"),
  createLink
);
router.get("/links", authMiddleware, getAllLinks);
router.patch("/links/:id", authMiddleware, updateLink);
// Public route for preview and sharing
router.get("/public/links/:linkId", getLinkByLinkId);

module.exports = router;

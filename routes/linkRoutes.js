const express = require("express");
const authMiddleware = require("../middleware/auth");
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
router.post("/links", authMiddleware, createLink);
router.get("/links", authMiddleware, getAllLinks);
router.patch("/links/:id", authMiddleware, updateLink);
// Public route for preview and sharing
router.get("/public/links/:linkId", getLinkByLinkId);

module.exports = router;

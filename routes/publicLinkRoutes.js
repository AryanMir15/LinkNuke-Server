const express = require("express");
const { getLinkByLinkId } = require("../controllers/linkController");
const router = express.Router();

// Public route for preview and sharing
router.get("/:linkId", getLinkByLinkId);

module.exports = router;

const express = require("express");
const {
  getLinkByLinkId,
  trackLinkView,
} = require("../controllers/linkController");
const router = express.Router();

// Add logging middleware for public links
router.use((req, res, next) => {
  process.stdout.write(`🔍 PUBLIC: ${req.method} ${req.originalUrl}\n`);
  process.stdout.write(
    `🔍 PUBLIC: Request params: ${JSON.stringify(req.params)}\n`
  );
  process.stdout.write(
    `🔍 PUBLIC: Request query: ${JSON.stringify(req.query)}\n`
  );
  process.stdout.write(
    `🔍 PUBLIC: Request headers: ${JSON.stringify(req.headers)}\n`
  );
  next();
});

// Public route for preview and sharing
router.get("/:linkId", getLinkByLinkId);

// Public tracking endpoint
router.post("/track/:id", trackLinkView);

module.exports = router;

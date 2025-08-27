const { UnauthenticatedError } = require("../errors");

const authMiddleware = (req, res, next) => {
  console.log("🔍🔍🔍 AUTH MIDDLEWARE START");
  console.log("🔍🔍🔍 Request URL:", req.originalUrl);
  console.log("🔍🔍🔍 Request method:", req.method);
  console.log("🔍🔍🔍 isAuthenticated():", req.isAuthenticated());
  console.log(
    "🔍🔍🔍 req.user:",
    req.user ? { id: req.user._id, email: req.user.email } : "NO USER"
  );
  console.log(
    "🔍🔍🔍 req.session:",
    req.session ? { id: req.session.id, user: req.session.user } : "NO SESSION"
  );

  if (!req.isAuthenticated()) {
    console.log("🔍🔍🔍 AUTH FAILED - User not authenticated");
    console.log("🔍🔍🔍 Returning 401 JSON response");
    return res.status(401).json({ error: "Authentication required" });
  }

  console.log("🔍🔍🔍 User authenticated, checking verification");
  console.log("🔍🔍🔍 req.user.isVerified:", req.user.isVerified);

  if (!req.user.isVerified) {
    console.log("🔍🔍🔍 VERIFICATION FAILED - User not verified");
    console.log("🔍🔍🔍 Returning 403 JSON response");
    return res.status(403).json({ error: "Email verification required" });
  }

  console.log("🔍🔍🔍 AUTH SUCCESS - User authenticated and verified");
  console.log("🔍🔍🔍 Calling next()");
  next();
};

module.exports = authMiddleware;

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  console.log("🔍🔍🔍 JWT AUTH MIDDLEWARE START");
  console.log("🔍🔍🔍 Request URL:", req.originalUrl);
  console.log("🔍🔍🔍 Request method:", req.method);

  // Skip authentication for Paddle webhook routes
  if (req.originalUrl.includes("/paddle/webhook")) {
    console.log("🔍🔍🔍 SKIPPING AUTH - Paddle webhook route");
    return next();
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    console.log("🔍🔍🔍 Authorization header:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("🔍🔍🔍 AUTH FAILED - No Bearer token found");
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    console.log("🔍🔍🔍 Extracted token:", token ? "TOKEN_EXISTS" : "NO_TOKEN");

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔍🔍🔍 JWT decoded:", { userId: decoded.userId });

    // Find user by ID
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log("🔍🔍🔍 AUTH FAILED - User not found");
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log("🔍🔍🔍 User found:", {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified,
    });

    if (!user.isVerified) {
      console.log("🔍🔍🔍 AUTH FAILED - User not verified");
      return res.status(403).json({ error: "Email verification required" });
    }

    // Attach user to request
    req.user = user;
    console.log("🔍🔍🔍 JWT AUTH SUCCESS - User authenticated and verified");
    next();
  } catch (error) {
    console.error("🔍🔍🔍 JWT AUTH ERROR:", error.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = authMiddleware;

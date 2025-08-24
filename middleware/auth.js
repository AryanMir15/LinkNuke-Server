const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { UnauthenticatedError } = require("../errors");

const authMiddleware = async (req, res, next) => {
  // Validate authorization header format
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Missing or invalid authorization header");
  }

  // Extract and verify token
  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new UnauthenticatedError("Missing authentication token");
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration: false,
    });

    const user = await User.findById(payload.userId).select("isVerified");
    if (!user) throw new UnauthenticatedError("User not found");
    if (!user.isVerified) throw new UnauthenticatedError("Email not verified");

    req.user = {
      _id: mongoose.Types.ObjectId(user._id),
      verified: user.isVerified,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new UnauthenticatedError("Token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new UnauthenticatedError("Invalid token");
    }
    throw new UnauthenticatedError("Authentication failed");
  }
};

module.exports = authMiddleware;

const jwt = require("jsonwebtoken");
const { UnauthenticatedError } = require("../errors");

const authMiddleware = (req, res, next) => {
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
      algorithms: ["HS256"], // Explicitly specify algorithm
      ignoreExpiration: false, // Validate expiration
    });

    req.user = {
      _id: payload.userId,
      name: payload.name,
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

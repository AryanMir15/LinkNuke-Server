const { UnauthenticatedError } = require("../errors");

const authMiddleware = (req, res, next) => {
  if (!req.isAuthenticated()) {
    throw new UnauthenticatedError("Authentication required");
  }

  // Verify email confirmation status directly from session user
  if (!req.user.isVerified) {
    throw new UnauthenticatedError("Email not verified");
  }

  next();
};

module.exports = authMiddleware;

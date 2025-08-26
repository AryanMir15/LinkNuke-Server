const { UnauthenticatedError } = require("../errors");

const authMiddleware = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  if (!req.user.isVerified) {
    return res.redirect("/verify-email");
  }

  next();
};

module.exports = authMiddleware;

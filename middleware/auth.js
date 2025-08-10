const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication invalid" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      _id: payload.userId,
      name: payload.name,
    };

    next();
  } catch (error) {
    console.error("Token verification failed", error);
    return res.status(401).json({ error: "Authentication invalid" });
  }
};

module.exports = authMiddleware;

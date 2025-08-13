require("dotenv").config();
require("express-async-errors");
const express = require("express");
const app = express();
const rateLimit = require("express-rate-limit");

// ========== External Packages ==========
const session = require("express-session");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// ========== Internal Imports ==========
const connectDB = require("./db/connect");
const passportConfig = require("./utils/passportConfig");
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");
const authMiddleware = require("./middleware/auth");

// Routes
const authRouter = require("./routes/auth");
const googleAuthRouter = require("./routes/authRoutes");
const linkRouter = require("./routes/linkRoutes");
const publicLinkRouter = require("./routes/publicLinkRoutes");
const paddleRouter = require("./routes/paddleRoutes");

// ========== CORS Setup ==========
const allowedOrigins = [
  "http://localhost:5173", // Vite dev
  "https://linknuke.vercel.app",
  "https://linknuke.whynotship.me",
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Handle preflight

// ========== Middleware ==========
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// ========== Routes ==========
app.get("/", (req, res) => {
  res.send("LinkBolt Server is up and running 🚀");
});

app.use("/api/v1/public/links", publicLinkRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1", googleAuthRouter);
app.use("/api/v1", authMiddleware, linkRouter);
app.use("/api/v1/paddle", paddleRouter);

// ========== Error Middleware ==========
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// ========== Start Server ==========
const port = process.env.PORT || 3000;

const start = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(port, () => console.log(`Server listening on port ${port} 🚀`));
  } catch (error) {
    console.log("Startup error:", error);
  }
};

start();

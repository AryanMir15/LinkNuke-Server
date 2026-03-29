require("dotenv").config();
require("express-async-errors");
const express = require("express");
const app = express();
const rateLimit = require("express-rate-limit");

// Hard resetting Vike setup

// ========== External Packages ==========
const session = require("express-session");
const MongoStore = require("connect-mongo");
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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow Paddle webhook requests
    if (origin.includes("paddle.com") || origin.includes("paddle.io")) {
      return callback(null, true);
    }

    // Allow requests from allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "paddle-signature",
    "paddle-version",
    "Idempotency-Key", // Allow idempotency key header for payment requests
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Handle preflight

// Special raw body parser for Paddle webhooks (must be before express.json)
app.use("/api/v1/paddle/webhook", express.raw({ type: "application/json" }));

// ========== Middleware ==========
// Skip JSON parsing for Paddle webhook route to preserve raw body for signature verification
app.use((req, res, next) => {
  if (req.originalUrl === "/api/v1/paddle/webhook") return next();
  return express.json()(req, res, next);
});
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 24 * 60 * 60, // 24 hours
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  }),
);
console.log("🔍🔍🔍 [APP] Initializing Passport...");
app.use(passport.initialize());
app.use(passport.session());
console.log("🔍🔍🔍 [APP] Passport initialized successfully");

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // limit each IP to 200 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// ========== Routes ==========
app.get("/", (req, res) => {
  res.send("LinkBolt Server is up and running 🚀");
});

// Add request logging middleware (only for non-webhook requests)
app.use((req, res, next) => {
  if (!req.originalUrl.includes("/paddle/webhook")) {
    console.log(`📥 ${req.method} ${req.originalUrl}`);
    // Add more detailed logging for tracking requests
    if (req.originalUrl.includes("/track/")) {
      process.stdout.write(
        `🔍 APP: TRACKING REQUEST: ${req.method} ${req.originalUrl}\n`,
      );
      process.stdout.write(
        `🔍 APP: Request body: ${JSON.stringify(req.body)}\n`,
      );
      process.stdout.write(
        `🔍 APP: Request params: ${JSON.stringify(req.params)}\n`,
      );
    }
  }
  next();
});

console.log("🔍🔍🔍 APP: Mounting routes...");
app.use("/api/v1/public/links", publicLinkRouter);
console.log("🔍🔍🔍 APP: Mounted /api/v1/public/links");
app.use("/api/v1", authRouter);
console.log("🔍🔍🔍 APP: Mounted /api/v1 (auth)");
app.use("/api/v1", googleAuthRouter);
console.log("🔍🔍🔍 APP: Mounted /api/v1 (google auth)");
app.use("/api/v1", authMiddleware, linkRouter);
console.log("🔍🔍🔍 APP: Mounted /api/v1 (links)");
app.use("/api/v1/paddle", paddleRouter);
console.log("🔍🔍🔍 APP: Mounted /api/v1/paddle");

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

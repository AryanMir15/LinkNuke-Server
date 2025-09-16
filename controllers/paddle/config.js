const { Paddle, Environment } = require("@paddle/paddle-node-sdk");

// Validate required environment variables (but don't crash the app)
const requiredEnvVars = [
  "PADDLE_API_KEY",
  "PADDLE_CLIENT_TOKEN",
  "PADDLE_PRO_PRICE_ID",
  "PADDLE_LIFETIME_PRICE_ID",
  "CLIENT_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.warn("Missing Paddle environment variables:", missingEnvVars);
  console.warn(
    "Paddle checkout functionality will not work until these are configured."
  );
}

// Initialize Paddle client only if API key is available
let paddle = null;
if (process.env.PADDLE_API_KEY) {
  try {
    const environment =
      process.env.PADDLE_ENV === "sandbox"
        ? Environment.sandbox
        : Environment.production;

    console.log(
      "Initializing Paddle with environment:",
      process.env.PADDLE_ENV || "production"
    );
    console.log(
      "API Key prefix:",
      process.env.PADDLE_API_KEY.substring(0, 10) + "..."
    );

    paddle = new Paddle(process.env.PADDLE_API_KEY, {
      environment: environment,
    });

    console.log("Paddle initialized successfully");
    console.log(
      "Environment:",
      environment === Environment.sandbox ? "sandbox" : "production"
    );
  } catch (error) {
    console.error("Failed to initialize Paddle client:", error);
  }
} else {
  console.warn("PADDLE_API_KEY not found. Paddle functionality disabled.");
}

// Product/Price mapping
const PRODUCTS = {
  pro: {
    priceId: process.env.PADDLE_PRO_PRICE_ID,
    name: "Pro Plan",
    price: 9.0,
    currency: "USD",
  },
  lifetime: {
    priceId: process.env.PADDLE_LIFETIME_PRICE_ID,
    name: "Lifetime Plan",
    price: 49.0,
    currency: "USD",
  },
};

console.log("Product configuration loaded:", Object.keys(PRODUCTS));

module.exports = {
  paddle,
  PRODUCTS,
  requiredEnvVars,
  missingEnvVars,
};

const mongoose = require("mongoose");

// Simple function to generate random string for linkId
function generateLinkId(length = 10) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const LinkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      enum: ["text", "image", "video", "audio", "document"],
      default: "text",
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    text: {
      type: String,
      default: null,
    },
    audioUrl: {
      type: String,
      default: null,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    documentUrl: {
      type: String,
      default: null,
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    linkId: {
      type: String,
      required: true,
      unique: true,
    },
    maxViews: {
      type: Number,
      default: 1,
    },
    views: {
      type: Number,
      default: 0,
    },
    viewedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Active", "Expired"],
      default: "Active",
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    extraSecure: {
      type: Boolean,
      default: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate linkId and url if not provided
LinkSchema.pre("save", function (next) {
  // Generate linkId if not provided
  if (!this.linkId) {
    this.linkId = generateLinkId(10);
  }

  // Generate url if not provided
  if (!this.url) {
    this.url = `${process.env.CLIENT_URL || "http://localhost:3000"}/preview/${
      this.linkId
    }`;
  }

  next();
});

// Pre-validate hook to ensure linkId and url are set before validation
LinkSchema.pre("validate", function (next) {
  // Generate linkId if not provided
  if (!this.linkId) {
    this.linkId = generateLinkId(10);
  }

  // Generate url if not provided
  if (!this.url) {
    this.url = `${process.env.CLIENT_URL || "http://localhost:3000"}/preview/${
      this.linkId
    }`;
  }

  next();
});

module.exports = mongoose.model("Link", LinkSchema);

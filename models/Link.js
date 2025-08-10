const mongoose = require("mongoose");

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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Link", LinkSchema);

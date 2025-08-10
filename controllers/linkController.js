let nanoid;
(async () => {
  const nanoidModule = await import("nanoid");
  nanoid = nanoidModule.nanoid;
})();
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat.js");

dayjs.extend(customParseFormat);

const Link = require("../models/Link.js");

const FILE_LIMITS = {
  image: {
    types: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
    max: 100 * 1024 * 1024,
  },
  audio: {
    types: [
      "audio/mpeg",
      "audio/wav",
      "audio/mp3",
      "audio/ogg",
      "audio/webm",
      "audio/aac",
      "audio/flac",
    ],
    max: 100 * 1024 * 1024,
  },
  video: {
    types: [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
      "video/x-matroska",
    ],
    max: 500 * 1024 * 1024,
  },
  document: {
    types: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ],
    max: 100 * 1024 * 1024,
  },
};

function validateFile(url, type, format) {
  if (!url) return true; // No file to validate
  // Cloudinary URLs include file extension, so we can check that
  const ext = url.split(".").pop().toLowerCase();
  let valid = false;
  let allowedTypes = FILE_LIMITS[format]?.types || [];
  for (const t of allowedTypes) {
    if (t.includes(ext) || url.includes(t.split("/")[1])) valid = true;
  }
  return valid;
}

function validateFileSize(size, format) {
  if (!size) return true;
  return size <= (FILE_LIMITS[format]?.max || 100 * 1024 * 1024);
}

// Create a new link
const createLink = async (req, res) => {
  try {
    const {
      title,
      maxViews = 1,
      expiresIn = "1h",
      imageUrl,
      audioUrl,
      videoUrl,
      documentUrl,
      format,
      fileSize,
    } = req.body;

    // Backend file type/size validation
    if (
      format === "image" &&
      imageUrl &&
      !validateFile(imageUrl, "image", "image")
    ) {
      return res.status(400).json({ error: "Invalid image file type." });
    }
    if (
      format === "audio" &&
      audioUrl &&
      !validateFile(audioUrl, "audio", "audio")
    ) {
      return res.status(400).json({ error: "Invalid audio file type." });
    }
    if (
      format === "video" &&
      videoUrl &&
      !validateFile(videoUrl, "video", "video")
    ) {
      return res.status(400).json({ error: "Invalid video file type." });
    }
    if (
      format === "document" &&
      documentUrl &&
      !validateFile(documentUrl, "document", "document")
    ) {
      return res.status(400).json({ error: "Invalid document file type." });
    }
    if (
      format === "image" &&
      fileSize &&
      !validateFileSize(fileSize, "image")
    ) {
      return res
        .status(400)
        .json({ error: "Image file too large (max 100MB)." });
    }
    if (
      format === "audio" &&
      fileSize &&
      !validateFileSize(fileSize, "audio")
    ) {
      return res
        .status(400)
        .json({ error: "Audio file too large (max 100MB)." });
    }
    if (
      format === "video" &&
      fileSize &&
      !validateFileSize(fileSize, "video")
    ) {
      return res
        .status(400)
        .json({ error: "Video file too large (max 500MB)." });
    }
    if (
      format === "document" &&
      fileSize &&
      !validateFileSize(fileSize, "document")
    ) {
      return res
        .status(400)
        .json({ error: "Document file too large (max 100MB)." });
    }

    const userId = req.user._id;
    // Wait for nanoid to be loaded
    if (!nanoid) {
      const nanoidModule = await import("nanoid");
      nanoid = nanoidModule.nanoid;
    }
    const linkId = nanoid(6);
    const createdAt = dayjs();
    const expiryDate = createdAt.add(...parseExpiresIn(expiresIn));

    // Use dynamic host for local/dev, fallback to custom domain in prod
    let baseUrl;
    if (process.env.NODE_ENV === "production") {
      baseUrl = "https://linknuke.whynotship.me";
    } else {
      baseUrl = `${req.protocol}://${req.get("host")}`;
    }

    const newLink = await Link.create({
      linkId,
      title,
      url: `${baseUrl}/${linkId}`,
      views: 0,
      maxViews,
      expiresAt: expiryDate.toDate(),
      status: "Active",
      createdAt: createdAt.toDate(),
      userId,
      imageUrl: req.body.imageUrl || null,
      text: req.body.text || null,
      audioUrl: req.body.audioUrl || null,
      videoUrl: req.body.videoUrl || null,
      documentUrl: req.body.documentUrl || null,
      extraSecure: req.body.extraSecure === true,
    });
    console.log("DEBUG: Created link:", newLink);

    res.status(201).json(newLink);
  } catch (err) {
    console.error("Create Link Error:", err);
    res.status(500).json({ error: "Failed to create link." });
  }
};

// Get all links for the current user
const getAllLinks = async (req, res) => {
  try {
    const userId = req.user._id;
    const links = await Link.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(links);
  } catch (err) {
    console.error("Get All Links Error:", err);
    res.status(500).json({ error: "Failed to fetch links." });
  }
};

// Get single link details by _id
const getSingleLink = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await Link.findOne({ _id: id, userId: req.user._id });

    if (!link) return res.status(404).json({ error: "Link not found." });

    const now = new Date();
    const expiredByMaxViews = link.views >= link.maxViews;
    const expiredByAbsoluteTime = link.expiresAt && now > link.expiresAt;
    const expiredByViewWindow =
      link.viewedAt && now - new Date(link.viewedAt) > 30 * 60 * 1000;

    const isExpired =
      expiredByMaxViews || expiredByAbsoluteTime || expiredByViewWindow;

    if (isExpired) {
      link.status = "Expired";
      await link.save();
      return res.status(410).json({ error: "Link has expired." });
    }

    res.status(200).json(link);
  } catch (err) {
    console.error("Get Link Error:", err);
    res.status(500).json({ error: "Failed to fetch link." });
  }
};

// Track a view
const trackLinkView = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await Link.findOne({ _id: id });

    if (!link) return res.status(404).json({ error: "Link not found." });

    // Check if expired already
    const now = new Date();
    const expiredByMaxViews = link.views >= link.maxViews;
    const expiredByAbsoluteTime = link.expiresAt && now > link.expiresAt;
    const expiredByViewWindow =
      link.viewedAt && now - new Date(link.viewedAt) > 30 * 60 * 1000;

    if (expiredByMaxViews || expiredByAbsoluteTime || expiredByViewWindow) {
      link.status = "Expired";
      await link.save();
      return res.status(410).json({ error: "Link has expired." });
    }

    if (!link.viewedAt) {
      link.viewedAt = now;
    }

    link.views += 1;
    await link.save();

    res.status(200).json({ msg: "View tracked successfully." });
  } catch (err) {
    console.error("Track View Error:", err);
    res.status(500).json({ error: "Failed to track view." });
  }
};

// Update link
const updateLink = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const link = await Link.findOne({ _id: id, userId: req.user._id });

    if (!link) return res.status(404).json({ error: "Link not found." });

    if (updates.title !== undefined) link.title = updates.title;
    if (updates.maxViews !== undefined) link.maxViews = updates.maxViews;
    if (updates.expiresIn !== undefined) {
      const newExpiry = dayjs(link.createdAt).add(
        ...parseExpiresIn(updates.expiresIn)
      );
      link.expiresAt = newExpiry.toDate();
    }

    await link.save();
    res.status(200).json(link);
  } catch (err) {
    console.error("Update Link Error:", err);
    res.status(500).json({ error: "Failed to update link." });
  }
};

// Delete link
const deleteLink = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await Link.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!link) return res.status(404).json({ error: "Link not found." });

    res.status(200).json({ message: "Link deleted." });
  } catch (err) {
    console.error("Delete Link Error:", err);
    res.status(500).json({ error: "Failed to delete link." });
  }
};

// Public: Get link by linkId (no auth)
const getLinkByLinkId = async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await Link.findOne({ linkId });
    if (!link) return res.status(404).json({ error: "Link not found." });

    // Check expiry
    const now = new Date();
    const expiredByMaxViews = link.views >= link.maxViews;
    const expiredByAbsoluteTime = link.expiresAt && now > link.expiresAt;
    const expiredByViewWindow =
      link.viewedAt && now - new Date(link.viewedAt) > 30 * 60 * 1000;
    const isExpired =
      expiredByMaxViews || expiredByAbsoluteTime || expiredByViewWindow;
    if (isExpired) {
      link.status = "Expired";
      await link.save();
      return res.status(410).json({ error: "Link has expired." });
    }
    res.status(200).json(link);
  } catch (err) {
    console.error("Get Link by linkId Error:", err);
    res.status(500).json({ error: "Failed to fetch link." });
  }
};

// Helper to parse "1h", "2d", "3w", etc.
function parseExpiresIn(input) {
  const match = input.match(/^(\d+)([hdw])$/i);
  if (!match) return [1, "hour"];

  const value = parseInt(match[1]);
  const unitMap = {
    h: "hour",
    d: "day",
    w: "week",
  };

  return [value, unitMap[match[2].toLowerCase()]];
}

module.exports = {
  createLink,
  getAllLinks,
  getSingleLink,
  trackLinkView,
  updateLink,
  deleteLink,
  getLinkByLinkId,
};

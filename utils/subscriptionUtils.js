const User = require("../models/User");

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    linksPerMonth: 10,
    storageLimit: 100 * 1024 * 1024, // 100MB
    fileTypes: ["image", "text"],
  },
  starter: {
    linksPerMonth: 50,
    storageLimit: 1 * 1024 * 1024 * 1024, // 1GB
    fileTypes: ["image", "text"],
  },
  pro: {
    linksPerMonth: 500,
    storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
    fileTypes: ["image", "video", "text", "audio", "document"],
  },
  lifetime: {
    linksPerMonth: -1, // Unlimited
    storageLimit: -1, // Unlimited
    fileTypes: ["image", "video", "text", "audio", "document"],
  },
};

// Check if user can create more links
const canCreateLink = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { allowed: false, reason: "User not found" };

    const plan = user.subscription?.plan || "free";
    const limits = PLAN_LIMITS[plan];

    if (limits.linksPerMonth === -1) {
      return { allowed: true }; // Unlimited
    }

    // Count links created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const linksThisMonth = await require("../models/Link").countDocuments({
      userId: userId,
      createdAt: { $gte: startOfMonth },
    });

    if (linksThisMonth >= limits.linksPerMonth) {
      return {
        allowed: false,
        reason: `Monthly limit of ${limits.linksPerMonth} links reached. Upgrade your plan for more.`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error checking link creation permission:", error);
    return { allowed: false, reason: "Error checking permissions" };
  }
};

// Check if user can upload file
const canUploadFile = async (userId, fileSize, fileType) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { allowed: false, reason: "User not found" };

    const plan = user.subscription?.plan || "free";
    const limits = PLAN_LIMITS[plan];

    // Check file type
    const allowedTypes = limits.fileTypes;
    const fileCategory = getFileCategory(fileType);

    if (!allowedTypes.includes(fileCategory)) {
      return {
        allowed: false,
        reason: `${fileCategory} files are not supported in your current plan. Upgrade to Pro or Lifetime for all file types.`,
      };
    }

    // Check storage limit
    if (limits.storageLimit === -1) {
      return { allowed: true }; // Unlimited
    }

    const currentUsage = user.usage?.storageUsed || 0;
    if (currentUsage + fileSize > limits.storageLimit) {
      return {
        allowed: false,
        reason: `Storage limit exceeded. You have ${formatBytes(
          limits.storageLimit - currentUsage
        )} remaining.`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error checking file upload permission:", error);
    return { allowed: false, reason: "Error checking permissions" };
  }
};

// Get file category from MIME type
const getFileCategory = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) return "text";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("application/")
  )
    return "document";
  return "unknown";
};

// Format bytes to human readable format
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Update user storage usage
const updateStorageUsage = async (userId, fileSize, operation = "add") => {
  try {
    const user = await User.findById(userId);
    if (!user) return false;

    const currentUsage = user.usage?.storageUsed || 0;
    const newUsage =
      operation === "add"
        ? currentUsage + fileSize
        : Math.max(0, currentUsage - fileSize);

    user.usage = {
      ...user.usage,
      storageUsed: newUsage,
    };

    await user.save();
    return true;
  } catch (error) {
    console.error("Error updating storage usage:", error);
    return false;
  }
};

// Get user's current plan limits
const getUserPlanLimits = (user) => {
  const plan = user.subscription?.plan || "free";
  return PLAN_LIMITS[plan];
};

// Check if user has active subscription
const hasActiveSubscription = (user) => {
  return user.subscription?.status === "active";
};

// Check if user has premium features
const hasPremiumFeatures = (user) => {
  const plan = user.subscription?.plan;
  return plan === "pro" || plan === "lifetime";
};

module.exports = {
  canCreateLink,
  canUploadFile,
  updateStorageUsage,
  getUserPlanLimits,
  hasActiveSubscription,
  hasPremiumFeatures,
  PLAN_LIMITS,
  formatBytes,
  getFileCategory,
};

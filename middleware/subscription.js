const User = require("../models/User");
const { ForbiddenError } = require("../errors");

const checkSubscription = (requiredPlan) => async (req, res, next) => {
  const user = await User.findById(req.user._id);

  // Allow free users to create links within their limits
  if (!user.subscription) {
    // Set default subscription for users without one
    user.subscription = {
      status: "active",
      plan: "free",
      usageLimits: { links: 10, customDomains: 1 },
    };
    await user.save();
  }

  // Check if user has reached their link limit
  if (user.usage.linksCreated >= user.subscription.usageLimits.links) {
    throw new ForbiddenError("Link creation limit exceeded");
  }

  // Only check for specific plan requirements if specified
  if (requiredPlan && user.subscription.plan !== requiredPlan) {
    throw new ForbiddenError(`${requiredPlan} plan required`);
  }

  next();
};

const trackUsage = (resourceType) => async (req, res, next) => {
  const user = await User.findById(req.user._id);

  switch (resourceType) {
    case "link":
      if (user.usage.linksCreated >= user.subscription.usageLimits.links) {
        throw new ForbiddenError("Link creation limit exceeded");
      }
      user.usage.linksCreated += 1;
      break;

    default:
      break;
  }

  await user.save();
  next();
};

module.exports = { checkSubscription, trackUsage };

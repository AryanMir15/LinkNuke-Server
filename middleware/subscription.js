const User = require("../models/User");
const { ForbiddenError } = require("../errors");

const checkSubscription = (requiredPlan) => async (req, res, next) => {
  const user = await User.findById(req.user._id);

  // Check active subscription
  if (!user.subscription || user.subscription.status !== "active") {
    throw new ForbiddenError("Active subscription required");
  }

  // Check plan tier
  if (requiredPlan && user.subscription.plan !== requiredPlan) {
    throw new ForbiddenError(`${requiredPlan} plan required`);
  }

  // Check usage limits
  if (user.usage.linksCreated >= user.subscription.usageLimits.links) {
    throw new ForbiddenError("Link creation limit exceeded");
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

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please provide first name"],
      minlength: 3,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: [true, "Please provide last name"],
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Please provide an Email Address"],
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 6,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    verificationPin: String,
    pinExpires: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
    subscription: {
      status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active",
      },
      plan: {
        type: String,
        enum: ["free", "pro", "lifetime"],
        default: "free",
      },
      usageLimits: {
        links: { type: Number, default: 10 },
        customDomains: { type: Number, default: 1 },
      },
      subscriptionId: String,
      transactionId: String,
      customerId: String,
      startDate: Date,
      endDate: Date,
      nextBillingDate: Date,
      isTrial: {
        type: Boolean,
        default: false,
      },
      trialDays: {
        type: Number,
        default: 0,
      },
    },
    usage: {
      linksCreated: {
        type: Number,
        default: 0,
      },
      storageUsed: {
        type: Number,
        default: 0, // in bytes
      },
    },
  },

  {
    timestamps: true,
  }
);

const createJWT = function () {
  return jwt.sign(
    { userId: this._id, name: this.firstName },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  );
};

const comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.createJWT = createJWT;
UserSchema.methods.comparePassword = comparePassword;

module.exports = mongoose.model("User", UserSchema);

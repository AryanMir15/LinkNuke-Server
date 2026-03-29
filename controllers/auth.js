const app = require("express");
const User = require("../models/User");

const verifyToken = async (req, res) => {
  try {
    // User is already verified by auth middleware
    const user = await User.findById(req.user._id).select(
      "-password -__v -createdAt -updatedAt",
    );

    res.json({
      user,
      valid: true,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({
      error: "Token verification failed",
      valid: false,
    });
  }
};
const crypto = require("crypto");
const { sendResetEmail } = require("../utils/sendResetEmail");
const { sendVerificationPin } = require("../utils/sendVerificationPin");

// Google OAuth callback handler
const googleAuthCallback = async (req, res) => {
  console.log("🔍 [AUTH_CALLBACK] OAuth callback received");
  console.log("🔍 [AUTH_CALLBACK] req.user exists:", !!req.user);

  try {
    if (!req.user) {
      console.log(
        "❌ [AUTH_CALLBACK] No req.user found, redirecting to login with error",
      );
      return res.redirect("/login?error=oauth_failed");
    }

    console.log("✅ [AUTH_CALLBACK] User found, creating JWT");
    const token = req.user.createJWT();
    const redirectUrl = `${process.env.CLIENT_URL}/oauth-success?token=${token}&userId=${req.user._id}`;
    console.log("🔄 [AUTH_CALLBACK] Redirecting to:", redirectUrl);

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ [AUTH_CALLBACK] Google OAuth error:", error);
    res.redirect("/login?error=oauth_failed");
  }
};

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!firstName || !email || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ error: "User already exists with this email" });
    }

    const verificationPin = Math.floor(
      100000 + Math.random() * 900000,
    ).toString(); // 6-digit
    const pinExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = await User.create({
      firstName,
      lastName: lastName || "User",
      email,
      password,
      verificationPin,
      pinExpires,
      subscription: {
        status: "inactive",
        plan: "free",
        usageLimits: { links: 5, customDomains: 1 },
      },
    });

    await sendVerificationPin({ email: user.email, pin: verificationPin });

    res.status(201).json({
      success: true,
      verified: false,
      message: "Verification PIN sent to email",
      email: user.email,
      requiresVerification: true, // Signal frontend to redirect
    });
  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const login = async (req, res) => {
  console.log("🔍🔍🔍 [LOGIN] Login attempt received");
  console.log("🔍🔍🔍 [LOGIN] Email provided:", req.body.email);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ [LOGIN] Missing email or password");
      return res
        .status(400)
        .json({ error: "Please provide email and password" });
    }

    console.log("🔍🔍🔍 [LOGIN] Looking for user in database...");
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      console.log("❌ [LOGIN] User not found in database");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("✅ [LOGIN] User found:", {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified,
      hasPassword: !!user.password,
    });

    if (!user.isVerified) {
      console.log("❌ [LOGIN] User not verified");
      return res
        .status(403)
        .json({ error: "Please verify your email before logging in." });
    }

    console.log("🔍🔍🔍 [LOGIN] Comparing password...");
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      console.log("❌ [LOGIN] Password incorrect");
      return res
        .status(401)
        .json({ error: "Please provide valid credentials" });
    }

    console.log("✅ [LOGIN] Password correct, creating JWT token");

    // Create JWT token
    const token = user.createJWT();

    console.log("🔍🔍🔍 LOGIN: JWT token created successfully");

    res.status(200).json({
      success: true,
      token,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Please provide a valid email" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(200).json({ message: "Email sent if user exists" }); // 🧠 don't reveal user presence
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  await user.save();

  try {
    await sendResetEmail({ email: user.email, token: resetToken });
    res.status(200).json({ message: "Password reset email sent" });
  } catch (err) {
    console.log(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.status(500).json({ error: "Failed to send email. Try again later." });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return res.status(400).json({ error: "Please fill both password fields" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ error: "Token is invalid or has expired" });
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({ message: "Password reset successful" });
};

const verifyPin = async (req, res) => {
  const { email, pin } = req.body;

  if (!email || !pin) {
    return res.status(400).json({ error: "Please provide both email and PIN" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ error: "Invalid email or PIN" });
  }

  if (
    user.verificationPin !== pin ||
    !user.pinExpires ||
    user.pinExpires < Date.now()
  ) {
    return res.status(400).json({ error: "PIN is invalid or has expired" });
  }

  user.verificationPin = undefined;
  user.pinExpires = undefined;
  user.isVerified = true;
  user.subscription.status = "active";
  await user.save();

  const token = user.createJWT();

  res.status(200).json({
    success: true,
    verified: true,
    message: "Email verified successfully",
    token,
    user: {
      firstName: user.firstName,
      email: user.email,
      subscription: user.subscription,
    },
  });
};

const resendPin = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Please provide an email" });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  if (user.isVerified) {
    return res.status(400).json({ error: "User is already verified" });
  }

  const newPin = Math.floor(100000 + Math.random() * 900000).toString();
  const pinExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.verificationPin = newPin;
  user.pinExpires = pinExpires;
  await user.save();

  try {
    await sendVerificationPin({ email: user.email, pin: newPin });
    res.status(200).json({ message: "Verification PIN resent to email." });
  } catch (err) {
    console.error("Error resending PIN:", err);
    res.status(500).json({ error: "Failed to resend PIN. Try again later." });
  }
};

const logout = async (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({ error: "Session cleanup failed" });
      }

      res.clearCookie("connect.sid");
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
};

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyPin,
  resendPin,
  verifyToken,
};

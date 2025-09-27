const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🔐 Reset Password Email
const sendResetEmail = async ({ email, token }) => {
  const resetURL = `${
    process.env.CLIENT_URL || "https://linknuke.whynotship.me"
  }/reset-password/${token}`;
  console.log("Trying to send reset email to:", email);

  await transporter.sendMail(
    {
      from: `"LinkNuke" <support@whynotship.me>`,
      to: email,
      subject: "Reset Your Password - LinkNuke",
      html: `
        <div style="font-family: sans-serif; padding: 2rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f9fafb; max-width: 600px; margin: auto;">
          <h1 style="color: #1de4bf; font-size: 32px; margin-bottom: 8px;">LinkNuke</h1>
          <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            You've requested to reset your password. This link will allow you to securely update your account credentials and regain access to your dashboard.
          </p>
          <a 
            href="${resetURL}" 
            style="display: inline-block; padding: 12px 24px; background-color: #1de4bf; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Reset Password
          </a>
          <p style="font-size: 14px; color: #64748b; margin-top: 30px;">
            If you didn't request this password reset, you can safely ignore this email. This link will expire in 15 minutes.
          </p>
        </div>
      `,
    },
    (err, info) => {
      if (err) {
        console.error("RESET EMAIL ERROR:", err);
      } else {
        console.log("RESET EMAIL SENT ✅:", info.response);
      }
    }
  );
};

module.exports = {
  sendResetEmail,
};

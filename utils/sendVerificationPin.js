const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationPin = async ({ email, pin }) => {
  console.log("Trying to send PIN to:", email);

  await transporter.sendMail(
    {
      from: `"LinkNuke" <support@whynotship.me>`,
      to: email,
      subject: "Verify Your Email - LinkNuke",
      html: `
        <div style="font-family: sans-serif; padding: 2rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f9fafb; max-width: 600px; margin: auto;">
          <h1 style="color: #1de4bf; font-size: 32px; margin-bottom: 8px;">LinkNuke</h1>
          <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Use the following verification code to confirm your email address and activate your account.
          </p>
          <div style="font-size: 28px; font-weight: bold; background-color: #ffffff; border: 1px dashed #1de4bf; padding: 16px 0; text-align: center; letter-spacing: 4px; color: #1de4bf; margin-bottom: 30px;">
            ${pin}
          </div>
          <p style="font-size: 14px; color: #64748b;">
            This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    },
    (err, info) => {
      if (err) {
        console.error("PIN EMAIL ERROR:", err);
      } else {
        console.log("PIN EMAIL SENT ✅:", info.response);
      }
    }
  );
};

module.exports = {
  sendVerificationPin,
};

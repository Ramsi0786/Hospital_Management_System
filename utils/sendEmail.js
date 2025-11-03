const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.sendOtpEmail = async (to, otp) => {
  try {
    console.log("📧 Attempting to send OTP email to:", to);
    console.log("OTP Code:", otp);
    console.log("SMTP Config:", {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS ? "***SET***" : "NOT SET"
    });

    const info = await transporter.sendMail({
      from: `"Healora Support" <${process.env.SMTP_USER}>`,
      to,
      subject: "Your OTP for Healora Signup",
      html: `<h2>Your OTP is: <b>${otp}</b></h2><p>This code expires in 5 minutes.</p>`
    });

    console.log("✅ Email sent successfully! Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
    throw error;
  }
};

exports.sendConfirmationEmail = async (to) => {
  try {
    console.log("📧 Sending confirmation email to:", to);
    await transporter.sendMail({
      from: `"Healora Support" <${process.env.SMTP_USER}>`,
      to,
      subject: "Welcome to Healora! Your Email is now Verified",
      html: `<h2>Congratulations!</h2><p>Your account has been verified.</p><p>You can now log in to Healora.</p>`
    });
    console.log("✅ Confirmation email sent!");
  } catch (error) {
    console.error("❌ Error sending confirmation email:", error);
  }
};

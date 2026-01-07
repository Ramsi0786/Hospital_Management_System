import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendOtpEmail = async (to, otp) => {
  try {
    const info = await transporter.sendMail({
      from: `"Healora Support" <${process.env.SMTP_USER}>`,
      to,
      subject: "Your OTP for Healora Signup",
      html: `<h2>Your OTP is: <b>${otp}</b></h2><p>This code expires in 5 minutes.</p>`
    });
    console.log("OTP email sent successfully!");
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw error;
  }
};

export const sendConfirmationEmail = async (to) => {
  try {
    await transporter.sendMail({
      from: `"Healora Support" <${process.env.SMTP_USER}>`,
      to,
      subject: "Welcome to Healora! Your Email is now Verified",
      html: `<h2>Congratulations!</h2><p>Your account has been verified.</p><p>You can now log in to Healora.</p>`
    });
    console.log("Confirmation email sent!");
  } catch (error) {
    console.error("Error sending confirmation email:", error);
  }
};

export const sendPasswordResetEmail = async (to, link) => {
  try {
    await transporter.sendMail({
      from: `"Healora Support" <${process.env.SMTP_USER}>`,
      to,
      subject: "Reset your Healora password",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${link}">Reset Password</a>
        <p>This link expires in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
    console.log("Password reset email sent!");
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
};

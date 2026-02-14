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
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
};


export const sendDoctorWelcomeEmail = async (to, name, password) => {
  try {
    await transporter.sendMail({
      from: `"Healora Admin" <${process.env.SMTP_USER}>`,
      to,
      subject: "Welcome to Healora Hospital – Your Login Credentials",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; padding: 30px; text-align: center; 
              border-radius: 10px 10px 0 0; 
            }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .credentials { 
              background: white; padding: 25px; border-left: 4px solid #667eea; 
              margin: 20px 0; border-radius: 5px;
            }
            .password-box {
              background: #fff3cd; 
              border: 2px dashed #ffc107;
              padding: 20px;
              border-radius: 5px;
              margin: 15px 0;
              text-align: center;
            }
            .password-text {
              font-size: 28px;
              font-weight: bold;
              color: #ff6b6b;
              letter-spacing: 3px;
              font-family: monospace;
            }
            .login-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 14px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Healora Hospital!</h1>
            </div>
            <div class="content">
              <h2>Hello Dr. ${name},</h2>
              <p>Your doctor account has been successfully created. You can now access the Healora Hospital system.</p>
              
              <div class="credentials">
                <h3 style="margin-top: 0; color: #667eea;">📧 Your Login Credentials</h3>
                
                <p style="margin: 10px 0;">
                  <strong>Email:</strong><br>
                  <span style="color: #667eea; font-size: 16px;">${to}</span>
                </p>
                
                <div class="password-box">
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #856404; font-weight: 600;">
                    Your Password:
                  </p>
                  <p class="password-text">${password}</p>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #856404;">
                    (Copy this password to login)
                  </p>
                </div>
                
                <p style="margin: 20px 0 10px 0;">
                  <strong>Login URL:</strong><br>
                  <a href="${process.env.BASE_URL}/doctor/login" 
                     style="color: #667eea; text-decoration: none; font-size: 15px;">
                    ${process.env.BASE_URL}/doctor/login
                  </a>
                </p>
              </div>
              
              <center>
                <a href="${process.env.BASE_URL}/doctor/login" class="login-button">
                  Login to Dashboard
                </a>
              </center>
              
              <p style="margin-top: 30px; padding: 15px; background: #f0f9ff; border-left: 3px solid #0ea5e9; border-radius: 5px;">
                <strong>💡 Tip:</strong> For security, we recommend changing your password after your first login.
              </p>
              
              <p style="margin-top: 25px; color: #666;">
                <strong>Need Help?</strong><br>
                If you have any questions, please contact the admin support team.
              </p>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} Healora Hospital. All rights reserved.</p>
                <p style="color: #999;">This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    });
  } catch (error) {
    console.error("Error sending doctor welcome email:", error);
    throw error;
  }
};
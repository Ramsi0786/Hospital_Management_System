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

export const sendBookingConfirmationEmail = async (to, data, pdfBuffer) => {
  const { patientName, doctorName, specialization, department,
          date, timeSlot, fee, paymentMethod, paymentStatus,
          bookingId, status } = data;

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  const payLabel =
    paymentMethod === 'cash'     ? 'Pay at Clinic'  :
    paymentMethod === 'wallet'   ? 'Healora Wallet'  :
    'Online Payment (Razorpay)';

  const statusColor =
    status === 'confirmed' ? '#059669' :
    status === 'pending'   ? '#d97706' : '#dc2626';

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:30px 20px;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#203f6a 0%,#1a7f8e 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <h1 style="margin:0;color:white;font-size:28px;font-weight:800;letter-spacing:-0.5px;">HEALORA</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Hospital Management System</p>
        </div>

        <!-- Status Banner -->
        <div style="background:white;padding:24px 32px;border-left:4px solid ${statusColor};">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:12px;height:12px;border-radius:50%;background:${statusColor};flex-shrink:0;"></div>
            <div>
              <p style="margin:0;font-size:18px;font-weight:800;color:#1a202c;">
                Appointment ${statusLabel}
              </p>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
                Booking ID: <strong>#${bookingId}</strong>
              </p>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div style="background:white;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <p style="margin:0 0 24px;font-size:15px;color:#374151;">
            Hello <strong>${patientName}</strong>,<br><br>
            ${status === 'confirmed'
              ? 'Your appointment has been <strong>confirmed</strong>. Your invoice is attached to this email.'
              : 'Your appointment has been <strong>booked successfully</strong>. Please complete payment at the clinic.'}
          </p>

          <!-- Appointment Details Card -->
          <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
            <h3 style="margin:0 0 16px;font-size:14px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
              Appointment Details
            </h3>

            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#64748b;width:40%;">Doctor</td>
                <td style="padding:8px 0;font-size:13px;font-weight:700;color:#1a202c;">Dr. ${doctorName}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 0;font-size:13px;color:#64748b;">Specialization</td>
                <td style="padding:8px 0;font-size:13px;font-weight:600;color:#374151;">${specialization}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 0;font-size:13px;color:#64748b;">Department</td>
                <td style="padding:8px 0;font-size:13px;font-weight:600;color:#374151;">${department}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 0;font-size:13px;color:#64748b;">Date</td>
                <td style="padding:8px 0;font-size:13px;font-weight:700;color:#1a202c;">${dateLabel}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 0;font-size:13px;color:#64748b;">Time</td>
                <td style="padding:8px 0;font-size:13px;font-weight:700;color:#1a202c;">${timeSlot}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 0;font-size:13px;color:#64748b;">Consultation Fee</td>
                <td style="padding:8px 0;font-size:15px;font-weight:800;color:#203f6a;">Rs. ${fee}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 0;font-size:13px;color:#64748b;">Payment Method</td>
                <td style="padding:8px 0;font-size:13px;font-weight:600;color:#374151;">${payLabel}</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 0;font-size:13px;color:#64748b;">Payment Status</td>
                <td style="padding:8px 0;">
                  <span style="background:${statusColor}20;color:${statusColor};font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;">
                    ${paymentStatus}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          ${paymentMethod === 'cash' ? `
          <!-- Cash reminder -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              <strong>Reminder:</strong> Please carry <strong>Rs. ${fee}</strong> in cash to your appointment.
              Payment is due at the time of your visit.
            </p>
          </div>` : ''}

          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${process.env.BASE_URL}/patient/appointments"
               style="display:inline-block;background:linear-gradient(135deg,#203f6a,#1a7f8e);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;">
              View My Appointments
            </a>
          </div>

          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
            Need help? Contact us at <a href="mailto:support@healora.com" style="color:#203f6a;">support@healora.com</a><br>
            © ${new Date().getFullYear()} Healora Hospital Management System
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from:    `"Healora" <${process.env.SMTP_USER}>`,
    to,
    subject: `Appointment ${statusLabel} — Dr. ${doctorName} on ${dateLabel}`,
    html,
    attachments: pdfBuffer ? [{
      filename:    `healora-invoice-${bookingId}.pdf`,
      content:     pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {

    console.error('Booking confirmation email error:', error);
  }
};
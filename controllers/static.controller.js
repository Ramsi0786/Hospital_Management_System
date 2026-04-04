import Doctor from "../models/doctor.model.js";
import Patient from "../models/patient.model.js";
import Settings from '../models/settings.model.js';
import nodemailer from 'nodemailer';
import ContactMessage from '../models/contactMessage.model.js';
import { WeeklyAvailability } from '../models/doctoravailability.model.js';
import { sanitizePagination, PAGINATION } from '../constants/index.js';
import { verifyAccessToken } from '../config/jwt.js';

export const landingPage = async (req, res) => {
  try {
    const doctors = await Doctor.find({ status: 'active' })
      .select("name specialization department profileImage rating experience")
      .limit(8);

    const totalDoctors  = await Doctor.countDocuments({ status: 'active' });
    const totalPatients = await Patient.countDocuments();

    const [expSetting, awardsSetting] = await Promise.all([
      Settings.findOne({ key: 'stats_experience' }),
      Settings.findOne({ key: 'stats_awards' })
    ]);

    res.render("landing_page", {
      title: "Healora - Smarter Healthcare, Simplified for Everyone",
      doctors,
      currentUser: res.locals.currentUser || null,
      stats: {
        experience: expSetting?.value ?? 10,
        doctors:    totalDoctors,
        patients:   totalPatients,
        awards:     awardsSetting?.value ?? 15
      }
    });
  } catch (error) {
    console.error("Landing page error:", error);
    res.render("landing_page", {
      title: "Healora - Smarter Healthcare, Simplified for Everyone",
      doctors: [],
      currentUser: null,
      stats: { experience: 10, doctors: 0, patients: 0, awards: 15 }
    });
  }
};

export const doctorsPage = async (req, res) => {
  try {
    const { department, search, page = 1 } = req.query;
    const { page: pageNum, skip } = sanitizePagination(page, PAGINATION.DOCTORS_PER_PAGE);
    const limitNum = PAGINATION.DOCTORS_PER_PAGE;

    let query = { status: 'active' };
    if (department && department !== 'all') query.department = department;
    if (search) {
      query.$or = [
        { name:           { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }

    const [total, doctors, departments] = await Promise.all([
      Doctor.countDocuments(query),
      Doctor.find(query)
        .select('name specialization department profileImage rating experience consultationFee')
        .limit(limitNum)
        .skip(skip),
      Doctor.distinct('department', { status: 'active' })
    ]);

    res.render('doctors', {
      title: 'Our Doctors - Healora',
      doctors,
      departments,
      currentUser:        res.locals.currentUser || null,
      selectedDepartment: department || 'all',
      searchQuery:        search || '',
      total,
      currentPage:  pageNum,
      totalPages:   Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Doctors page error:', error);
    res.render('doctors', {
      title: 'Our Doctors - Healora',
      doctors: [], departments: [],
      currentUser: null,
      selectedDepartment: 'all', searchQuery: '',
      total: 0, currentPage: 1, totalPages: 0
    });
  }
};


export const doctorDetailPage = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .select("name specialization department phone profileImage rating ratingCount experience bio qualification consultationFee createdAt");

    if (!doctor) return res.redirect("/doctors");

    // Fetch real availability
    const weeklyAvail = await WeeklyAvailability.findOne({ doctor: doctor._id });

    const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const availability = weeklyAvail
      ? DAYS
          .filter(day => weeklyAvail.schedule?.[day]?.isWorking)
          .map(day => ({
            day: day.charAt(0).toUpperCase() + day.slice(1),
            slots: weeklyAvail.schedule[day].slots || []
          }))
      : [];

    res.render("doctor-detail", {
      title: `Dr. ${doctor.name} - Healora`,
      doctor: { ...doctor.toObject(), availability },
      currentUser: res.locals.currentUser || null
    });
  } catch (error) {
    console.error("Doctor detail error:", error);
    res.redirect("/doctors");
  }
};

export const departmentsPage = async (req, res) => {
  try {

    const deptAgg = await Doctor.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$department', count: { $sum: 1 }, doctors: { $push: { name: '$name', profileImage: '$profileImage', specialization: '$specialization', _id: '$_id' } } } },
      { $sort: { _id: 1 } }
    ]);

    res.render('departments', {
      title: 'Departments - Healora',
      departments: deptAgg,
      currentUser: res.locals.currentUser || null
    });
  } catch (error) {
    console.error('Departments page error:', error);
    res.render('departments', {
      title: 'Departments - Healora',
      departments: [],
      currentUser: null
    });
  }
};

export const departmentPage = (req, res) => {
  res.redirect(`/doctors?department=${encodeURIComponent(req.params.name)}`);
};

export const contactPage = (req, res) => res.render("contact", {
  title: "Contact Us - Healora",
  currentUser: res.locals.currentUser || null
});


export const submitContact = async (req, res) => {
  try {
    const { firstName, lastName, contactEmail, contactPhone, contactSubject, contactMessage } = req.body;

    if (!firstName || !lastName || !contactEmail || !contactSubject || !contactMessage) {
      return res.status(400).json({ success: false, error: 'All required fields must be filled.' });
    }

    await ContactMessage.create({
      firstName,
      lastName,
      email:   contactEmail,
      phone:   contactPhone || '',
      subject: contactSubject,
      message: contactMessage,
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from:    `"Healora Contact Form" <${process.env.SMTP_USER}>`,
      to:      process.env.SMTP_USER,  
      replyTo: contactEmail,           
      subject: `[Contact] ${contactSubject}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f1f5f9;padding:28px 16px;">
          <div style="background:linear-gradient(135deg,#203f6a 0%,#1a7f8e 100%);border-radius:14px 14px 0 0;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:white;font-size:24px;font-weight:800;">HEALORA</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:12px;">New Contact Form Message</p>
          </div>
          <div style="background:white;border-radius:0 0 14px 14px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.08);">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;font-size:13px;color:#64748b;width:35%;">Name</td>
                <td style="padding:10px 0;font-size:13px;font-weight:700;color:#1a202c;">${firstName} ${lastName}</td>
              </tr>
              <tr style="border-top:1px solid #f0f2f5;">
                <td style="padding:10px 0;font-size:13px;color:#64748b;">Email</td>
                <td style="padding:10px 0;font-size:13px;font-weight:700;color:#1a202c;">${contactEmail}</td>
              </tr>
              <tr style="border-top:1px solid #f0f2f5;">
                <td style="padding:10px 0;font-size:13px;color:#64748b;">Phone</td>
                <td style="padding:10px 0;font-size:13px;color:#1a202c;">${contactPhone || 'Not provided'}</td>
              </tr>
              <tr style="border-top:1px solid #f0f2f5;">
                <td style="padding:10px 0;font-size:13px;color:#64748b;">Subject</td>
                <td style="padding:10px 0;font-size:13px;font-weight:700;color:#1a202c;">${contactSubject}</td>
              </tr>
            </table>
            <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:10px;border-left:4px solid #203f6a;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;">Message:</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${contactMessage}</p>
            </div>
            <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center;">
              © ${new Date().getFullYear()} Healora Hospital — Contact Form Submission
            </p>
          </div>
        </div>
      `
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
};

export const checkAuthStatus = (req, res) => {
  const token = req.cookies.accessToken || req.cookies.adminToken;
  if (!token) return res.json({ loggedIn: false });
  try {
    verifyAccessToken(token);
    return res.json({ loggedIn: true });
  } catch {
    return res.json({ loggedIn: false });
  }
};

export const loginPage    = (req, res) => res.render("redirect",               { title: "Login - Healora" });
export const aboutUsPage  = (req, res) => res.render("about-us",               { title: "About Us - Healora",    currentUser: res.locals.currentUser || null });
export const servicesPage = (req, res) => res.render("services",               { title: "Our Services - Healora", currentUser: res.locals.currentUser || null });
export const page404      = (req, res) => res.status(404).render("404",        { title: "Page Not Found - Healora" });

export const patientLoginPage  = (req, res) => res.render("patient/patient-login",  { title: "Patient Login - Healora",  error: null, success: null });
export const patientSignupPage = (req, res) => res.render("patient/patient-signup", { title: "Patient Signup - Healora" });
export const patientOtpPage    = (req, res) => res.render("patient/verify-otp",     { title: "Verify OTP - Healora" });
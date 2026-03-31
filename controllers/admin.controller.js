import Patient from "../models/patient.model.js";
import Doctor from "../models/doctor.model.js";
import Settings from "../models/settings.model.js"
import Appointment from "../models/appointment.model.js";
import Wallet from '../models/wallet.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import Payment from '../models/payment.model.js';
import Invoice from '../models/invoice.model.js';
import bcrypt from "bcryptjs";
import Notification from '../models/notification.model.js';
import { sendDoctorWelcomeEmail } from "../utils/sendEmail.js";
import { notifyAppointmentCancelled, notifyRefundProcessed, notifyAppointmentStatusChanged } from '../utils/createNotification.js';
import { HTTP_STATUS, PAGINATION, sanitizePagination } from "../constants/index.js";
import logger from "../utils/logger.js";
import cloudinary from "../config/cloudinary.js";
import Admin from '../models/admin.model.js';


/* ==================== GET DASHBOARD ==================== */

export const getDashboard = async (req, res) => {
  try {
    const admin     = req.admin || req.user;
    const adminName = admin.name || "Admin";

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalAppointments,
      totalPatients,
      totalDoctors,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount,
      todayCount,
    ] = await Promise.all([
      Appointment.countDocuments(),
      Patient.countDocuments(),
      Doctor.countDocuments(),
      Appointment.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ status: 'confirmed' }),
      Appointment.countDocuments({ status: 'completed' }),
      Appointment.countDocuments({ status: 'cancelled' }),
      Appointment.countDocuments({ date: { $gte: today } }),
    ]);

    const revenueAgg = await Invoice.aggregate([
      { $match: { type: 'booking' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      const [appts, rev] = await Promise.all([
        Appointment.countDocuments({ date: { $gte: dayStart, $lt: dayEnd } }),
        Invoice.aggregate([
          { $match: { type: 'booking', createdAt: { $gte: dayStart, $lt: dayEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      weeklyData.push({
        label:        dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        appointments: appts,
        revenue:      rev[0]?.total || 0,
      });
    }

    const monthlyEarnings = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const rev = await Invoice.aggregate([
        { $match: { type: 'booking', createdAt: { $gte: mStart, $lt: mEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      monthlyEarnings.push({
        label:    mStart.toLocaleDateString('en-US', { month: 'short' }),
        earnings: rev[0]?.total || 0,
      });
    }

    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [recentPatients, recentDoctors, recentAppointments] = await Promise.all([
      Patient.find({ createdAt: { $gte: last24Hours } }).select('name createdAt'),
      Doctor.find({ createdAt: { $gte: last24Hours } }).select('name createdAt'),
      Appointment.find({ createdAt: { $gte: last24Hours } })
        .populate('patient', 'name')
        .populate('doctor', 'name')
        .select('createdAt status patient doctor')
    ]);

    const recentActivities = [];

    recentPatients.forEach(p => recentActivities.push({
      type:    'Patient',
      icon:    'fa-user-plus',
      message: `${p.name} registered as a new patient`,
      date:    p.createdAt,
    }));

    recentDoctors.forEach(d => recentActivities.push({
      type:    'Doctor',
      icon:    'fa-user-md',
      message: `Dr. ${d.name} was added to the system`,
      date:    d.createdAt,
    }));

    recentAppointments.forEach(a => recentActivities.push({
      type:    'Appointment',
      icon:    'fa-calendar-check',
      message: `${a.patient?.name || 'A patient'} booked with Dr. ${a.doctor?.name || 'a doctor'}`,
      date:    a.createdAt,
    }));

    recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [newDoctorsThisMonth, newPatientsThisMonth] = await Promise.all([
      Doctor.countDocuments({ createdAt: { $gte: monthStart } }),
      Patient.countDocuments({ createdAt: { $gte: monthStart } }),
    ]);

    res.render('admin/dashboard', {
      admin,
      title: `${adminName} Dashboard - Healora`,

      totalAppointments,
      totalPatients,
      totalDoctors,
      totalRevenue,
      todayCount,
      newDoctorsThisMonth,
      newPatientsThisMonth,

      stats: {
        total:     totalAppointments,
        pending:   pendingCount,
        confirmed: confirmedCount,
        completed: completedCount,
        cancelled: cancelledCount,
      },

      weeklyData,
      monthlyEarnings,

      recentActivities: recentActivities.slice(0, 8),
    });

  } catch (error) {
    logger.error('Dashboard error', 'Admin', error);
    res.render('admin/dashboard', {
      admin:             req.admin || req.user,
      title:             'Dashboard - Healora',
      totalAppointments: 0,
      totalPatients:     0,
      totalDoctors:      0,
      totalRevenue:      0,
      todayCount:        0,
      newDoctorsThisMonth:  0,
      newPatientsThisMonth: 0,
      stats:             { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
      weeklyData:        [],
      monthlyEarnings:   [],
      recentActivities:  [],
    });
  }
};

export const getAdminNotifications = async (req, res) => {
  try {
    const admin = req.admin || req.user;
    const notifications = await Notification.find({
      recipient:     admin._id || admin.id,
      recipientType: 'admin'
    }).sort({ createdAt: -1 }).limit(20);

    const unreadCount = await Notification.countDocuments({
      recipient:     admin._id || admin.id,
      recipientType: 'admin',
      isRead:        false
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

export const markAllAdminNotifsRead = async (req, res) => {
  try {
    const admin = req.admin || req.user;
    await Notification.updateMany(
      { recipient: admin._id || admin.id, recipientType: 'admin', isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

export const markAdminNotifRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/* ==================== ADD PATIENT ==================== */

export const addPatient = async (req, res) => {
  try {
    const { name, email, phone, password, age, gender } = req.body;

    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        success: false,
        error: "Patient email already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newPatient = new Patient({
      name,
      email,
      phone,
      password: hashedPassword,
      age,
      gender,
      isVerified: true,
      isActive: true,
    });

    await newPatient.save();

    logger.info(`New patient added: ${email}`, "Admin");

    res.status(HTTP_STATUS.CREATED).json({ 
      success: true,
      message: "Patient added successfully",
      patient: newPatient
    });
  } catch (err) {
    logger.error("Add Patient Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: "Error adding Patient" 
    });
  }
};

/* ==================== GET ALL PATIENTS ==================== */
export const getAllPatients = async (req, res) => {
  try {
    const {
      search = "",
      page,
      limit,
      status = "all",
      gender = ""
    } = req.query;

    const { page: pageNum, limit: limitNum, skip } = sanitizePagination(
      page,
      limit || PAGINATION.PATIENTS_PER_PAGE
    );

    let query = {};

    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
        { phone: { $regex: search.trim(), $options: "i" } },
      ];
    }

    if (status === "active") {
      query.isActive = true;
      query.isBlocked = false;
    } else if (status === "blocked") {
      query.isBlocked = true;
    } else if (status === "inactive") {
      query.isActive = false;
      query.isBlocked = false;
    }

    if (gender && gender !== "") {
      query.gender = gender;
    }

    const total = await Patient.countDocuments(query);

    const patients = await Patient.find(query)
      .select("-password -googleId")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      patients,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error("Get Patients Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error fetching patients",
    });
  }
};

/* ==================== GET SINGLE PATIENT ==================== */
export const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select("-password");
    
    if (!patient) {
      return res.status(HTTP_STATUS.NOT_FOUND).send("Patient not found");
    }

    const appointments = await Appointment.find({ 
      patient: req.params.id
    })
    .populate('doctor', 'name')
    .sort({ date: -1 })
    .catch(() => []);

    const appointmentsWithNames = appointments.map(apt => ({
      ...apt.toObject(),
      doctorName: apt.doctor?.name || 'Unknown', 
      status: apt.status || 'pending',
      date: apt.date,
      department: apt.department || 'N/A',
      reason: apt.reason || 'N/A'
    }));

    res.render("admin/patient-profile", {
      patient,
      appointments: appointmentsWithNames,
      admin: req.admin || req.user,
      title: "Patient Profile - Healora"
    });
  } catch (err) {
    logger.error("Get Patient Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Error loading patient profile");
  }
};

/* ==================== BLOCK PATIENT ==================== */
export const blockPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { block } = req.body;

    const patient = await Patient.findByIdAndUpdate(
      id,
      {
        isBlocked: block === true || block === "true",
        isActive: !(block === true || block === "true"),
      },
      { new: true }
    ).select("-password");

    if (!patient) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Patient not found",
      });
    }

    logger.info(`Patient ${block ? 'blocked' : 'unblocked'}: ${id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Patient ${block ? 'blocked' : 'unblocked'} successfully`,
      patient,
    });
  } catch (err) {
    logger.error("Block Patient Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error updating patient status",
    });
  }
};

/* ==================== UNBLOCK PATIENT ==================== */
export const unblockPatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findByIdAndUpdate(
      id,
      {
        isBlocked: false,
        isActive: true,
        blockedReason: null,
        blockedAt: null,
      },
      { new: true }
    ).select("-password");

    if (!patient) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Patient not found",
      });
    }

    logger.info(`Patient unblocked: ${id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Patient unblocked successfully",
      patient,
    });
  } catch (err) {
    logger.error("Unblock Patient Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error unblocking patient",
    });
  }
};

/* ==================== DELETE PATIENT ==================== */
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Patient not found",
      });
    }

    patient.isActive = false;
    patient.isBlocked = false;
    await patient.save();

    logger.info(`Patient soft deleted: ${id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Patient marked as inactive successfully",
    });
  } catch (err) {
    logger.error("Delete Patient Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error deleting patient",
    });
  }
};

/* ==================== UPDATE PATIENT ==================== */
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, age, gender } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (age) updateData.age = age;
    if (gender) updateData.gender = gender;

    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const patient = await Patient.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!patient) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Patient not found",
      });
    }

    logger.info(`Patient updated: ${id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Patient updated successfully",
      patient,
    });
  } catch (err) {
    logger.error("Update Patient Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error updating patient",
    });
  }
};

/* ==================== REACTIVATE PATIENT ==================== */
export const reactivatePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findByIdAndUpdate(
      id,
      {
        isActive: true,
        isBlocked: false,
        deactivatedAt: null,
      },
      { new: true }
    ).select("-password");

    if (!patient) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Patient not found",
      });
    }

    logger.info(`Patient reactivated: ${id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Patient reactivated successfully",
      patient,
    });
  } catch (err) {
    logger.error("Reactivate Patient Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error reactivating patient",
    });
  }
};

/* ==================== ADD DOCTOR ==================== */
export const addDoctor = async (req, res) => {
  try {
    const { 
  name, 
  email, 
  phone, 
  password, 
  specialization, 
  department,
  profileImage,
  consultationFee,
  qualification,
  experience
} = req.body;

    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        success: false,
        error: "Doctor email already exists" 
      });
    }

    const plainPassword = password;
    const hashedPassword = await bcrypt.hash(password, 10);

   let finalImageUrl = profileImage || ''; 

    if (profileImage && profileImage.startsWith('data:image')) {
      try {
        const uploadResult = await cloudinary.uploader.upload(profileImage, {
          folder: 'healora/doctors',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' }
          ]
        });
        finalImageUrl = uploadResult.secure_url;
        logger.info(`Profile image uploaded to Cloudinary: ${finalImageUrl}`, "Admin");
      } catch (uploadError) {
        logger.error("Cloudinary upload error", "Admin", uploadError);
        finalImageUrl = profileImage; 
      }
    }

    const newDoctor = new Doctor({
  name,
  email,
  phone,
  specialization,
  department,
  password: hashedPassword,
  profileImage: finalImageUrl,
  status: 'active',
  consultationFee: consultationFee ? Number(consultationFee) : 0,
  qualification:   qualification || '',
  experience:      experience ? Number(experience) : 0
});

    await newDoctor.save();

    try {
      await sendDoctorWelcomeEmail(email, name, plainPassword);
    } catch (emailError) {
      logger.warn("Failed to send welcome email", "Email", emailError);
    }

    logger.info(`New doctor added: ${email} with profile image`, "Admin");

    res.status(HTTP_STATUS.CREATED).json({ 
      success: true,
      message: "Doctor added successfully and welcome email sent!",
      doctor: {
        _id: newDoctor._id,
        name: newDoctor.name,
        email: newDoctor.email,
        profileImage: newDoctor.profileImage
      }
    });
  } catch (err) {
    logger.error("Add Doctor Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: "Error adding Doctor" 
    });
  }
};

/* ==================== GET ALL DOCTORS ==================== */
export const getAllDoctors = async (req, res) => {
  try {
    const {
      search = "",
      page,
      limit,
      status = "",
      department = "",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const { page: pageNum, limit: limitNum, skip } = sanitizePagination(
      page,
      limit || PAGINATION.DOCTORS_PER_PAGE
    );

    let query = {};

    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
        { specialization: { $regex: search.trim(), $options: "i" } },
      ];
    }

    if (status && status !== "") {
      query.status = status;
    }

    if (department && department !== "") {
      query.department = department;
    }

    let sortOptions = {};
    switch(sortBy) {
      case 'name':
        sortOptions = { name: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'fee':
        sortOptions = { consultationFee: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'experience':
        sortOptions = { experience: sortOrder === 'asc' ? 1 : -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const total = await Doctor.countDocuments(query);

    const doctors = await Doctor.find(query)
      .select("-password")
      .sort(sortOptions)
      .limit(limitNum)
      .skip(skip);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      doctors,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error("Get Doctors Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error fetching doctors"
    });
  }
};

/* ==================== GET SINGLE DOCTOR ==================== */
export const getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select("-password");
    
    if (!doctor) {
      return res.status(HTTP_STATUS.NOT_FOUND).send("Doctor not found");
    }

    const appointments = await Appointment.find({ 
      doctor: req.params.id
    })
    .populate('patient', 'name')
    .sort({ date: -1 })
    .catch(() => []);

    const appointmentsWithNames = appointments.map(apt => ({
      ...apt.toObject(),
      patientName: apt.patient?.name || 'Unknown', 
      status: apt.status || 'pending',
      date: apt.date,
      timeSlot: apt.timeSlot || '-',
      department: apt.department || '_',
      reason: apt.reason || '_'
    }));

    res.render("admin/doctor-profile", {
      doctor,
      appointments: appointmentsWithNames,
      admin: req.admin || req.user,
      title: "Doctor Profile - Healora"
    });
  } catch (err) {
    logger.error("Get Doctor Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Error loading doctor profile");
  }
};

/* ==================== BLOCK DOCTOR ==================== */
export const blockDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { block } = req.body;

    const newStatus = block ? 'blocked' : 'active';

    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { status: newStatus },
      { new: true }
    ).select("-password");

    if (!doctor) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Doctor not found",
      });
    }

    logger.info(`Doctor ${block ? 'blocked' : 'unblocked'}: ${id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Doctor ${block ? 'blocked' : 'unblocked'} successfully`,
      doctor,
    });
  } catch (err) {
    logger.error("Block Doctor Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error updating doctor status",
    });
  }
};

/* ==================== DELETE DOCTOR ==================== */
export const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Doctor not found"
      });
    }

    await Doctor.findByIdAndDelete(req.params.id);

    logger.info(`Doctor deleted: ${req.params.id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Doctor deleted successfully"
    });
  } catch (err) {
    logger.error("Delete Doctor Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error deleting Doctor"
    });
  }
};

/* ==================== UPDATE DOCTOR ==================== */
export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
  name, 
  email, 
  phone, 
  password, 
  specialization, 
  department,
  profileImage,
  consultationFee,
  qualification,
  experience
} = req.body;

const updateData = {
  name,
  email,
  phone,
  specialization,
  department,
};

if (consultationFee !== undefined && consultationFee !== '') {
  updateData.consultationFee = Number(consultationFee);
}
if (qualification !== undefined) updateData.qualification = qualification;
if (experience !== undefined && experience !== '') updateData.experience = Number(experience);

    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    if (profileImage) {
      if (profileImage.startsWith('data:image')) {
        try {
          const uploadResult = await cloudinary.uploader.upload(profileImage, {
            folder: 'healora/doctors',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' }
            ]
          });
          updateData.profileImage = uploadResult.secure_url;
          logger.info(`Profile image updated in Cloudinary: ${uploadResult.secure_url}`, "Admin");
        } catch (uploadError) {
          logger.error("Cloudinary upload error during update", "Admin", uploadError);
        }
      } else {
        updateData.profileImage = profileImage;
      }
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedDoctor) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: "Doctor not found"
      });
    }

    logger.info(`Doctor updated: ${id}`, "Admin");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Doctor updated successfully",
      doctor: updatedDoctor,
    });
  } catch (err) {
    logger.error("Update Doctor Error", "Admin", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Error updating doctor"
    });
  }
};


export const getHospitalStats = async (req, res) => {
  try {
    const [expSetting, awardsSetting, totalDoctors, totalPatients] = await Promise.all([
      Settings.findOne({ key: 'stats_experience' }),
      Settings.findOne({ key: 'stats_awards' }),
      Doctor.countDocuments(),
      Patient.countDocuments()
    ]);

    res.json({
      success: true,
      stats: {
        experience: expSetting?.value ?? 10,
        awards:     awardsSetting?.value ?? 15,
        doctors:    totalDoctors,
        patients:   totalPatients
      }
    });
  } catch (error) {
    console.error('Get hospital stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
};

export const updateHospitalStats = async (req, res) => {
  try {
    const { experience, awards } = req.body;

    const errors = {};
    if (experience === undefined || experience === '') {
      errors.experience = 'Experience is required';
    } else if (isNaN(Number(experience)) || Number(experience) < 0) {
      errors.experience = 'Experience must be a positive number';
    }

    if (awards === undefined || awards === '') {
      errors.awards = 'Awards is required';
    } else if (isNaN(Number(awards)) || Number(awards) < 0) {
      errors.awards = 'Awards must be a positive number';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    await Promise.all([
      Settings.findOneAndUpdate(
        { key: 'stats_experience' },
        { value: Number(experience) },
        { upsert: true, new: true }
      ),
      Settings.findOneAndUpdate(
        { key: 'stats_awards' },
        { value: Number(awards) },
        { upsert: true, new: true }
      )
    ]);

    res.json({
      success: true,
      message: 'Hospital stats updated successfully'
    });
  } catch (error) {
    console.error('Update hospital stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to update stats' });
  }
};

/* ==================== GET ALL APPOINTMENTS ==================== */
export const getAdminAppointments = async (req, res) => {
  try {
    const {
      search   = '',
      status   = '',
      payment  = '',
      doctor   = '',
      dateFrom = '',
      dateTo   = '',
      page,
      limit
    } = req.query;

    const { page: pageNum, limit: limitNum, skip } = sanitizePagination(
      page,
      limit || PAGINATION.APPOINTMENTS_PER_PAGE || 10
    );

    let query = {};
    if (status && status !== 'all') query.status = status;

    if (payment && payment !== 'all') query.paymentMethod = payment;

    if (doctor) query.doctor = doctor;

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (search.trim()) {
      const [matchingPatients, matchingDoctors] = await Promise.all([
        Patient.find({ name: { $regex: search.trim(), $options: 'i' } }).select('_id'),
        Doctor.find({ name: { $regex: search.trim(), $options: 'i' } }).select('_id')
      ]);
      query.$or = [
        { patient: { $in: matchingPatients.map(p => p._id) } },
        { doctor:  { $in: matchingDoctors.map(d => d._id) } }
      ];
    }

    const [appointments, total, doctors] = await Promise.all([
      Appointment.find(query)
        .populate('patient', 'name email phone')
        .populate('doctor',  'name specialization department')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Appointment.countDocuments(query),
      Doctor.find({}, 'name department').sort({ name: 1 }) 
    ]);

    const [totalCount, pendingCount, confirmedCount, completedCount, cancelledCount] = await Promise.all([
      Appointment.countDocuments({}),
      Appointment.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ status: 'confirmed' }),
      Appointment.countDocuments({ status: 'completed' }),
      Appointment.countDocuments({ status: 'cancelled' })
    ]);

    res.render('admin/appointments', {
      title:    'Appointments Management - Healora',
      admin:    req.admin || req.user,
      appointments,
      doctors,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      filters: { search, status, payment, doctor, dateFrom, dateTo },
      stats: { total: totalCount, pending: pendingCount, confirmed: confirmedCount, completed: completedCount, cancelled: cancelledCount }
    });
  } catch (err) {
    logger.error('Get Admin Appointments Error', 'Admin', err);
    res.status(500).render('admin/appointments', {
      title: 'Appointments - Healora',
      admin: req.admin || req.user,
      appointments: [],
      doctors: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      filters: {},
      stats: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 }
    });
  }
};

/* ==================== UPDATE APPOINTMENT STATUS (Admin) ==================== */
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    if (appointment.status === 'completed' && status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot change a completed appointment' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Appointment is already cancelled' });
    }

    appointment.status = status;

    // ── CANCELLATION ──────────────────────────────────────────────
    if (status === 'cancelled') {
      appointment.cancelledBy        = 'admin';
      appointment.cancellationReason = reason || '';
      appointment.cancelledAt        = new Date();

      const isCash  = appointment.paymentMethod === 'cash';
      const wasPaid = appointment.paymentStatus === 'paid';

      if (!isCash && wasPaid) {
        const percentage = 100;
        const amount     = percentage > 0 ? Math.round(appointment.consultationFee * percentage / 100) : 0;

        appointment.refundPercentage = percentage;
        appointment.refundAmount     = amount;
        appointment.refundStatus     = amount > 0 ? 'pending' : 'none';

        if (amount > 0) {
          // ── Wallet refund ────────────────────────────────────────
          if (appointment.paymentMethod === 'wallet') {
            const wallet = await Wallet.findOneAndUpdate(
              { patient: appointment.patient },
              { $inc: { balance: amount } },
              { new: true, upsert: true }
            );

            appointment.refundStatus  = 'processed';
            appointment.refundedAt    = new Date();
            appointment.paymentStatus = amount === appointment.consultationFee
              ? 'refunded'
              : 'partially_refunded';

            await WalletTransaction.create({
              patient:         appointment.patient,
              type:            'credit',
              amount,
              description:     `Refund — appointment cancelled by admin (credited to wallet)`,
              balanceBefore:   wallet.balance - amount,
              balanceAfter:    wallet.balance,
              appointment:     id,
              transactionType: 'refund'
            });
          }

          // ── Razorpay refund ──────────────────────────────────────
          
          if (appointment.paymentMethod === 'razorpay') {
            const wallet = await Wallet.findOneAndUpdate(
              { patient: appointment.patient },
              { $inc: { balance: amount } },
              { new: true, upsert: true }
            );
            appointment.refundStatus  = 'processed';
            appointment.refundedAt    = new Date();
            appointment.paymentStatus = 'refunded';
            
            await WalletTransaction.create({
              patient:         appointment.patient,
              type:            'credit',
              amount,
              description:     `Refund — appointment cancelled by admin (credited to wallet)`,
              balanceBefore:   wallet.balance - amount,
              balanceAfter:    wallet.balance,
              appointment:     id,
              transactionType: 'refund'
            });
          
          }

          // ── Update Payment record ────────────────────────────────
          await Payment.findOneAndUpdate(
            { appointment: id },
            {
              status:       appointment.paymentStatus,
              refundAmount: amount,
              refundStatus: appointment.refundStatus,
              refundedAt:   appointment.refundedAt || null
            }
          );
        }
      }
    }

    await appointment.save();

logger.info(`Appointment ${id} → ${status} by admin`, 'Admin');

// ── Notifications ────────────────────────────────────
try {
  const [docN, patN] = await Promise.all([
    Doctor.findById(appointment.doctor).select('name _id'),
    Patient.findById(appointment.patient).select('name _id')
  ]);
  if (docN && patN) {
    if (status === 'cancelled') {
      await notifyAppointmentCancelled(appointment, docN, patN, 'admin');
      if (appointment.refundAmount > 0) {
        await notifyRefundProcessed(patN, appointment.refundAmount, appointment._id);
      }
    } else {
      await notifyAppointmentStatusChanged(appointment, docN, patN, status);
    }
  }
} catch (notifErr) {
  logger.warn('Notification error (non-fatal)', 'Admin', notifErr);
}

    let message = `Appointment ${status} successfully.`;
    if (appointment.refundAmount > 0) {
      message += ` ₹${appointment.refundAmount} refund (${appointment.refundPercentage}%) — ${appointment.refundStatus}.`;
    } else if (status === 'cancelled' && appointment.paymentMethod !== 'cash' && appointment.paymentStatus === 'paid') {
      message += ' No refund — appointment is within 12 hours.';
    }

    res.json({ success: true, message, appointment });

  } catch (err) {
    logger.error('Update Appointment Status Error', 'Admin', err);
    res.status(500).json({ success: false, error: 'Failed to update appointment status' });
  }
};

/* ==================== GET SINGLE APPOINTMENT (Admin API) ==================== */
export const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'name email phone age gender')
      .populate('doctor',  'name specialization department consultationFee profileImage');

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    res.json({ success: true, appointment });
  } catch (err) {
    logger.error('Get Appointment Error', 'Admin', err);
    res.status(500).json({ success: false, error: 'Failed to fetch appointment' });
  }
};

/* ==================== GET ALL INVOICES (Admin) ==================== */
export const getAdminInvoices = async (req, res) => {
  try {
    const {
      search   = '',
      type     = '',
      dateFrom = '',
      dateTo   = '',
      page,
      limit
    } = req.query;

    const { page: pageNum, limit: limitNum, skip } = sanitizePagination(
      page, limit || 10
    );

    let query = {};
    if (type && type !== 'all') query.type = type;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search.trim()) {
      const [matchPatients, matchDoctors] = await Promise.all([
        Patient.find({ name: { $regex: search.trim(), $options: 'i' } }).select('_id'),
        Doctor.find({  name: { $regex: search.trim(), $options: 'i' } }).select('_id')
      ]);
      const apptIds = await Appointment.find({
        $or: [
          { patient: { $in: matchPatients.map(p => p._id) } },
          { doctor:  { $in: matchDoctors.map(d => d._id)  } }
        ]
      }).select('_id');
      query.appointment = { $in: apptIds.map(a => a._id) };
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate({
          path: 'appointment',
          populate: [
            { path: 'patient', select: 'name email phone' },
            { path: 'doctor',  select: 'name specialization department' }
          ]
        })
        .populate('patient', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Invoice.countDocuments(query)
    ]);

    const [totalBooking, totalRefund, revenueAgg] = await Promise.all([
      Invoice.countDocuments({ type: 'booking' }),
      Invoice.countDocuments({ type: 'refund' }),
      Invoice.aggregate([
        { $match: { type: 'booking' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;

    res.render('admin/invoices', {
      title:    'Invoices - Healora Admin',
      admin:    req.admin || req.user,
      invoices,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      filters: { search, type, dateFrom, dateTo },
      stats: {
        total:        await Invoice.countDocuments(),
        totalBooking,
        totalRefund,
        totalRevenue
      }
    });
  } catch (err) {
    logger.error('Get Admin Invoices Error', 'Admin', err);
    res.status(500).render('admin/invoices', {
      title:   'Invoices - Healora Admin',
      admin:    req.admin || req.user,
      invoices: [],
      pagination: { total:0, page:1, limit:10, totalPages:0 },
      filters:  { search:'', type:'', dateFrom:'', dateTo:'' },
      stats:    { total:0, totalBooking:0, totalRefund:0, totalRevenue:0 }
    });
  }
};

/* ==================== GET SETTINGS ==================== */
export const getSettings = async (req, res) => {
  try {
    const rows = await Settings.find({});
    const map  = {
      hospital_email:                 'support@healora.com',
      hospital_phone:                 '+91 12345 67890',
      hospital_address:               'Healora Hospital, Medical District',
      hospital_tagline:               'Your Health, Our Priority',
      stats_experience:               10,
      stats_awards:                   15,
      booking_window_days:            7,
      slot_duration_minutes:          30,
      cancellation_refund_percentage: 90,
      cancellation_window_hours:      12,
      wallet_min_topup:               10,
      wallet_max_topup:               50000,
      email_booking_confirmed:        true,
      email_appointment_cancelled:    true,
      email_refund_processed:         true,
      email_appointment_reminder:     true
    };
    rows.forEach(s => { map[s.key] = s.value; });

    res.render('admin/settings', {
      title:    'Settings - Healora Admin',
      admin:    req.admin || req.user,
      settings: map
    });
  } catch (err) {
    logger.error('Get Settings Error', 'Admin', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load settings' });
  }
};

/* ==================== SAVE SETTINGS ==================== */
export const saveSettings = async (req, res) => {
  try {
    const data = req.body;
    const ops  = Object.entries(data).map(([key, value]) =>
      Settings.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      )
    );
    await Promise.all(ops);
    logger.info('Settings updated by admin', 'Admin');
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    logger.error('Save Settings Error', 'Admin', err);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
};

/* ==================== CHANGE ADMIN PASSWORD ==================== */
export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const adminId = (req.admin || req.user)?.id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'New passwords do not match.' });
    }

    const admin = await Admin.findById(adminId).select('password');
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, error: 'New password must be different.' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    logger.info(`Admin password changed: ${adminId}`, 'Admin');
    res.json({ success: true, message: 'Password changed successfully.' });

  } catch (err) {
    logger.error('Change Admin Password Error', 'Admin', err);
    res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
};

/* ==================== UPDATE SETTINGS ==================== */
export const updateSettings = async (req, res) => {
  try {
    const updates = req.body;

    const ops = Object.entries(updates).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $set: { key, value } },
        upsert: true
      }
    }));

    if (ops.length > 0) {
      await Settings.bulkWrite(ops);
    }

    logger.info('Settings updated by admin', 'Admin');
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    logger.error('Update Settings Error', 'Admin', err);
    res.status(500).json({ success: false, error: 'Failed to save settings.' });
  }
};



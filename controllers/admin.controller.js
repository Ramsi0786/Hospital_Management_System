import Patient from "../models/patient.model.js";
import Doctor from "../models/doctor.model.js";
import Settings from "../models/settings.model.js"
import Appointment from "../models/appointment.model.js";
import bcrypt from "bcryptjs";
import { sendDoctorWelcomeEmail } from "../utils/sendEmail.js";
import { HTTP_STATUS, PAGINATION, sanitizePagination } from "../constants/index.js";
import logger from "../utils/logger.js";
import cloudinary from "../config/cloudinary.js";

/* ==================== GET DASHBOARD ==================== */

export const getDashboard = async (req, res) => {
  try {
    const admin = req.admin || req.user;
    const adminName =
      admin.id === "superAdmin" ? "Super Admin" : admin.name || "Admin";

    const [appointments, patients, doctors] = await Promise.all([
      Appointment.find().catch(() => []),
      Patient.find().catch(() => []),
      Doctor.find().catch(() => [])
    ]);

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentActivities = [];

    patients.forEach(p => {
      if (p.createdAt && p.createdAt >= last24Hours) {
        recentActivities.push({
          type: "Patient",
          message: `${p.name} registered`,
          date: p.createdAt
        });
      }
    });

    doctors.forEach(d => {
      if (d.createdAt && d.createdAt >= last24Hours) {
        recentActivities.push({
          type: "Doctor",
          message: `Dr. ${d.name} added`,
          date: d.createdAt
        });
      }
    });

    appointments.forEach(a => {
      if (a.createdAt && a.createdAt >= last24Hours) {
        recentActivities.push({
          type: "Appointment",
          message: "New appointment scheduled",
          date: a.createdAt
        });
      }
    });

    recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedActivities = recentActivities.slice(0, 5);

    res.render("admin/dashboard", {
      admin,
      title: `${adminName} Dashboard - Healora`,
      appointments: appointments || [],
      patients: patients || [],
      doctors: doctors || [],
      recentActivities: limitedActivities
    });

  } catch (error) {
    logger.error("Dashboard error", "Admin", error);
    res.render("admin/dashboard", {
      admin: req.admin || req.user,
      title: "Dashboard - Healora",
      appointments: [],
      patients: [],
      doctors: [],
      recentActivities: []
    });
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
      time: apt.time,
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
      profileImage 
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
      profileImage: finalImageUrl 
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
      time: apt.time,
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
      profileImage 
    } = req.body;

    const updateData = {
      name,
      email,
      phone,
      specialization,
      department,
    };

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
import Admin from "../models/admin.model.js";
import Patient from "../models/patient.model.js";
import Doctor from "../models/doctor.model.js";
import Appointment from "../models/appointment.model.js";
import bcrypt from "bcryptjs";

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
    console.error("Dashboard error:", error);

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
      return res.status(400).json({ 
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

    res.status(201).json({ 
      success: true,
      message: "Patient added successfully",
      patient: newPatient
    });
  } catch (err) {
    console.error("Add Patient Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Error adding Patient" 
    });
  }
};

/* ==================== ADD DOCTOR ==================== */
export const addDoctor = async (req, res) => {
  try {
    const { name, email, phone, password, specialization, department } =
      req.body;

    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ error: "Doctor email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDoctor = new Doctor({
      name,
      email,
      phone,
      specialization,
      department,
      password: hashedPassword,
    });

    await newDoctor.save();

    res.status(201).json({ message: "Doctor added successfully" });
  } catch (err) {
    console.error("Add Doctor Error:", err);
    res.status(500).json({ error: "Error adding Doctor" });
  }
};

/* ==================== GET ALL DOCTORS ==================== */
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find().select("-password");
    res.json({ doctors });
  } catch (err) {
    console.error("Get Doctors Error:", err);
    res.status(500).json({ error: "Error fetching doctors" });
  }
};

/* ==================== DELETE DOCTOR ==================== */
export const deleteDoctor = async (req, res) => {
  try {
    await Doctor.findByIdAndDelete(req.params.id);
    res.json({ message: "Doctor deleted" });
  } catch (err) {
    console.error("Delete Doctor Error:", err);
    res.status(500).json({ error: "Error deleting Doctor" });
  }
};

/* ==================== UPDATE DOCTOR ==================== */
export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, specialization, department } =
      req.body;

    const updateData = {
      name,
      email,
      phone,
      specialization,
      department,
    };

    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      updateData.password = hashedPassword;
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedDoctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    res.status(200).json({
      message: "Doctor updated successfully",
      doctor: updatedDoctor,
    });
  } catch (err) {
    console.error("Update Doctor Error:", err);
    res.status(500).json({ error: "Error updating doctor" });
  }
};

/* ==================== GET ALL PATIENTS (SEARCH, PAGINATION, FILTER) ==================== */
export const getAllPatients = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      status = "all", 
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

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
    }

    if (status === "blocked") {
      query.isBlocked = true;
    }

    if (status === "inactive") {
      query.isActive = false;
      query.isBlocked = false;
    }

    const total = await Patient.countDocuments(query);

    const patients = await Patient.find(query)
      .select("-password -googleId")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    res.status(200).json({
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
    console.error("Get Patients Error:", err);
    res.status(500).json({
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
      return res.status(404).send("Patient not found");
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
    console.error("Get Patient Error:", err);
    res.status(500).send("Error loading patient profile");
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
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Patient ${block ? 'blocked' : 'unblocked'} successfully`,
      patient,
    });
  } catch (err) {
    console.error("Block Patient Error:", err);
    res.status(500).json({
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
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Patient unblocked successfully",
      patient,
    });
  } catch (err) {
    console.error("Unblock Patient Error:", err);
    res.status(500).json({
      success: false,
      error: "Error unblocking patient",
    });
  }
};

/* ==================== SOFT DELETE (DEACTIVATE) PATIENT ==================== */
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findByIdAndDelete(id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Patient deleted successfully",
    });
  } catch (err) {
    console.error("Delete Patient Error:", err);
    res.status(500).json({
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
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Patient updated successfully",
      patient,
    });
  } catch (err) {
    console.error("Update Patient Error:", err);
    res.status(500).json({
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
      return res.status(404).json({
        success: false,
        error: "Patient not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Patient reactivated successfully",
      patient,
    });
  } catch (err) {
    console.error("Reactivate Patient Error:", err);
    res.status(500).json({
      success: false,
      error: "Error reactivating patient",
    });
  }
};

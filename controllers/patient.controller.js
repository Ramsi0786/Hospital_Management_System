import Doctor from "../models/doctor.model.js";
import Patient from '../models/patient.model.js';
import Department from "../models/department.model.js";
import Appointment from "../models/appointment.model.js";
import { sanitizePagination, PAGINATION } from '../constants/index.js';
import { resolveSlots } from '../controllers/availability.controller.js';
import Invoice from '../models/invoice.model.js';
import MedicalRecord from '../models/medicalRecord.model.js';
import cloudinary from '../config/cloudinary.js';
import bcrypt from 'bcryptjs';
import RefreshToken from '../models/refreshToken.model.js';
import Wallet from '../models/wallet.model.js';
import WalletTransaction from '../models/wallettransaction.model.js';
import Notification from '../models/notification.model.js';

export const getDashboard = (req, res) => {
  res.render("patient/dashboard", {
    user: req.user,
    title: `${req.user.name}'s Dashboard - Healora`,
    showPasswordSetupBanner: req.session.showPasswordSetupBanner || false
  });
  delete req.session.showPasswordSetupBanner;
};

export const getDashboardStats = async (req, res) => {
  try {
    const patientId = req.user._id;
    const now       = new Date();
    
    const [upcoming, completed, cancelled, total] = await Promise.all([
      Appointment.countDocuments({ patient: patientId, status: { $in: ['pending','confirmed'] } }),
      Appointment.countDocuments({ patient: patientId, status: 'completed' }),
      Appointment.countDocuments({ patient: patientId, status: 'cancelled' }),
      Appointment.countDocuments({ patient: patientId })
    ]);

    const wallet = await Wallet.findOne({ patient: patientId }).select('balance');
    const recordsCount = await MedicalRecord.countDocuments({ patient: patientId });
    const recentAppointments = await Appointment.find({ patient: patientId })
      .populate('doctor', 'name specialization profileImage')
      .sort({ createdAt: -1 })
      .limit(4)
      .select('doctor date timeSlot status consultationFee department');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    const apptByMonth = await Appointment.aggregate([
      { $match: { patient: patientId, createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const spendingByMonth = await WalletTransaction.aggregate([
      { $match: {
        patient:         patientId,
        type:            'debit',
        transactionType: 'booking',
        createdAt:       { $gte: sixMonthsAgo }
      }},
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        total: { $sum: '$amount' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const months     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const chartMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      chartMonths.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: months[d.getMonth()] });
    }

    const apptChart = chartMonths.map(cm => {
      const found = apptByMonth.find(a => a._id.year === cm.year && a._id.month === cm.month);
      return { label: cm.label, count: found ? found.count : 0 };
    });

    const spendChart = chartMonths.map(cm => {
      const found = spendingByMonth.find(s => s._id.year === cm.year && s._id.month === cm.month);
      return { label: cm.label, total: found ? found.total : 0 };
    });

    res.json({
      success: true,
      stats: {
        upcoming,
        completed,
        cancelled,
        total,
        walletBalance: wallet?.balance ?? 0,
        recordsCount
      },
      recentAppointments,
      apptChart,
      spendChart
    });

  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard data' });
  }
};

export const getAllDoctors = async (req, res) => {
  try {
    const { department, search, sort, page } = req.query;
    const { page: pageNum, skip } = sanitizePagination(page, PAGINATION.DOCTORS_PER_PAGE);
    const limitNum = PAGINATION.DOCTORS_PER_PAGE;

    let query = { status: 'active' };

    if (department && department !== 'all') {
      query.department = department;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOption = { isFeatured: -1, rating: -1 };
    if (sort === 'fee-low')    sortOption = { consultationFee: 1 };
    if (sort === 'fee-high')   sortOption = { consultationFee: -1 };
    if (sort === 'experience') sortOption = { experience: -1 };
    if (sort === 'rating')     sortOption = { rating: -1 };

    const total = await Doctor.countDocuments(query);

    const doctors = await Doctor.find(query)
      .select('name email specialization department bio qualification experience consultationFee profileImage rating isFeatured')
      .sort(sortOption)
      .limit(limitNum)
      .skip(skip);

    const departments = await Department.find({ isActive: true, isDeleted: false })
      .select('name icon');

    res.render('patient/doctors-list', {
      title: 'Our Doctors - Healora',
      user: req.user,
      doctors,
      departments,
      selectedDepartment: department || 'all',
      searchQuery: search || '',
      sortBy: sort || 'featured',
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      total
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load doctors' });
  }
};

export const getDoctorDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findById(id).select('-password');

    if (!doctor || doctor.status !== 'active') {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Doctor not found',
        user: req.user
      });
    }

    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    });

    const resolvedAll = await Promise.all(
      dates.map(dateStr => resolveSlots(id, dateStr).catch(() => null))
    );

    const startDate = dates[0];
    const endDate   = dates[dates.length - 1];

    const allBooked = await Appointment.find({
      doctor: id,
      date:   { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed'] }
    }).select('date timeSlot');

    const bookedByDate = {};
    for (const appt of allBooked) {
      if (!bookedByDate[appt.date]) bookedByDate[appt.date] = new Set();
      bookedByDate[appt.date].add(appt.timeSlot);
    }

    const slotCalendar = dates.map((dateStr, i) => {
      const d        = new Date(today);
      d.setDate(today.getDate() + i);
      const resolved = resolvedAll[i];

      let available = [];
      let reason    = 'Doctor not available on this day';

      if (resolved?.isWorking && resolved.slots?.length > 0) {
        const bookedSet = bookedByDate[dateStr] || new Set();

        available = resolved.slots.filter(s => {
          if (bookedSet.has(s)) return false;
          if (i === 0) {
            const [hour, min] = s.split(':').map(Number);
            const slotTime = new Date();
            slotTime.setHours(hour, min, 0, 0);
            return (slotTime - now) > 60 * 60 * 1000;
          }
          return true;
        });

        if (available.length === 0) {
          reason = i === 0 ? 'No more bookable slots for today' : 'All slots fully booked';
        } else {
          reason = null;
        }
      }

      return {
        date:          dateStr,
        display:       d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayName:       d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum:        d.getDate(),
        month:         d.toLocaleDateString('en-US', { month: 'short' }),
        slots:         available,
        totalSlots:    resolved?.slots?.length || 0,
        isToday:       i === 0,
        noSlotsReason: reason
      };
    });

    res.render('patient/doctor-profile', {
      title:       `Dr. ${doctor.name} - Healora`,
      user:        req.user,
      doctor,
      slotCalendar
    });

  } catch (error) {
    console.error('Get doctor details error:', error);
    res.status(500).render('error', {
      title:   'Error',
      message: 'Failed to load doctor profile',
      user:    req.user
    });
  }
};

export const getDoctorSlots = async (req, res) => {
  try {
    const { id }   = req.params;
    const { date } = req.query;

    if (!date) return res.status(400).json({ success: false, error: 'Date required' });

    const resolved = await resolveSlots(id, date);

    if (!resolved.isWorking) {
      return res.json({ success: true, slots: [], isWorking: false });
    }

    const booked = await Appointment.find({
      doctor: id,
      date,
      status: { $in: ['pending', 'confirmed'] }
    }).select('timeSlot');

    const bookedSlots = booked.map(a => a.timeSlot);
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const available = resolved.slots.filter(s => {
  if (bookedSlots.includes(s)) return false;

  if (date < todayStr) return false;

  if (date === todayStr) {
    const [slotHour, slotMinute] = s.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(slotHour, slotMinute, 0, 0);
    const diffMs = slotTime - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return false; 
  }

  return true;
});
    res.json({ success: true, slots: available, isWorking: true, bookedSlots });
  } catch (error) {
    console.error('Get doctor slots error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch slots' });
  }
};

export const updatePatientProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      name, phone, dateOfBirth, gender, bloodGroup,
      address, emergencyContactName, 
      emergencyContactPhone, emergencyContactRelation
    } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!name || name.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Name must be at least 3 characters' });
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ success: false, error: 'Phone must be 10 digits' });
    }

    if (emergencyContactPhone && !/^[0-9]{10}$/.test(emergencyContactPhone)) {
      return res.status(400).json({ success: false, error: 'Emergency contact phone must be 10 digits' });
    }

    let calculatedAge = null;
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today     = new Date();
      calculatedAge   = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
    }

    const updateData = {
      name: name.trim(),
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      age: calculatedAge,
      gender: gender || null,
      bloodGroup: bloodGroup || null,
      address: address?.trim() || null,
      emergencyContactName: emergencyContactName?.trim() || null,
      emergencyContactPhone: emergencyContactPhone || null,
      emergencyContactRelation: emergencyContactRelation?.trim() || null
    };

    const updatedPatient = await Patient.findByIdAndUpdate(
      userId, updateData, { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      patient: updatedPatient
    });
  } catch (error) {
    console.error('Update patient profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
};

export const getAppointments = async (req, res) => {
  try {
    const { status, page } = req.query;
    const { page: pageNum, skip } = sanitizePagination(page, 10);

    let query = { patient: req.user._id };
    if (status && status !== 'all') query.status = status;

    const total = await Appointment.countDocuments(query);

    const appointments = await Appointment.find(query)
      .populate('doctor', 'name specialization department profileImage consultationFee')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(10);

    res.render('patient/appointments', {
      title:        'My Appointments - Healora',
      user:          req.user,
      appointments,
      selectedStatus: status || 'all',
      currentPage:   pageNum,
      totalPages:    Math.ceil(total / 10),
      total
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load appointments', user: req.user });
  }
};

export const getAppointmentDetail = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'name specialization department profileImage consultationFee phone email');

    if (!appointment || appointment.patient.toString() !== req.user._id.toString()) {
      return res.redirect('/patient/appointments');
    }

    res.render('patient/appointment-detail', {
      title: 'Appointment Details - Healora',
      user:   req.user,
      appointment
    });
  } catch (error) {
    console.error('Get appointment detail error:', error);
    res.redirect('/patient/appointments');
  }
};


export const getInvoices = async (req, res) => {
  try {
    const { type, page } = req.query;
    const limit   = 10;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip    = (pageNum - 1) * limit;

    let query = { patient: req.user._id };
    if (type && type !== 'all') query.type = type;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate({
          path: 'appointment',
          populate: { path: 'doctor', select: 'name specialization department profileImage' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query)
    ]);

    res.render('patient/invoices', {
      title:       'My Invoices - Healora',
      user:         req.user,
      invoices,
      total,
      selectedType: type || 'all',
      currentPage:  pageNum,
      totalPages:   Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load invoices', user: req.user });
  }
};

export const getMedicalRecords = async (req, res) => {
  try {
    const { tab } = req.query;
    const validTabs = ['prescription', 'lab', 'document'];
    const activeTab = validTabs.includes(tab) ? tab : 'lab';

    const records = await MedicalRecord.find({
      patient: req.user._id,
      type: activeTab
    }).sort({ recordDate: -1, createdAt: -1 });

    res.render('patient/medical-records', {
      title:     'Medical Records - Healora',
      user:       req.user,
      records,
      activeTab,
      currentPage: 'medical-records'
    });
  } catch (err) {
    console.error('Get medical records error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load records', user: req.user });
  }
};

export const uploadMedicalRecord = async (req, res) => {
  try {
    const { title, type, notes, recordDate, fileData, fileType } = req.body;
    const patientId = req.user._id;

    if (!title || !type || !recordDate || !fileData) {
      return res.status(400).json({ success: false, error: 'Title, type, date and file are required' });
    }

    const validTypes = ['lab', 'document'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid record type' });
    }

    const folder = `healora/medical-records/${patientId}`;
    const resourceType = fileType === 'pdf' ? 'raw' : 'image';

const uploadRes = await cloudinary.uploader.upload(fileData, {
  folder,
  resource_type: resourceType,
  ...(fileType === 'pdf' && {
    flags: 'attachment'  // forces browser to download instead of display
  }),
  ...(fileType === 'image' && {
    transformation: [{ quality: 'auto:good' }, { fetch_format: 'auto' }]
  })
});

    const record = await MedicalRecord.create({
      patient:    patientId,
      type,
      title:      title.trim(),
      notes:      notes?.trim() || '',
      fileUrl:    uploadRes.secure_url,
      fileType,
      publicId:   uploadRes.public_id,
      recordDate
    });

    res.json({ success: true, message: 'Record uploaded successfully', record });

  } catch (err) {
    console.error('Upload medical record error:', err);
    res.status(500).json({ success: false, error: 'Failed to upload record' });
  }
};

export const deleteMedicalRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record || record.patient.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    try {
      const resourceType = record.fileType === 'pdf' ? 'raw' : 'image';
      await cloudinary.uploader.destroy(record.publicId, { resource_type: resourceType });
    } catch (err) {
      console.error('Cloudinary delete error:', err);
    }

    await MedicalRecord.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Record deleted successfully' });

  } catch (err) {
    console.error('Delete medical record error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete record' });
  }
};

export const getMedicalRecordCounts = async (req, res) => {
  try {
    const { type } = req.query;
    const count = await MedicalRecord.countDocuments({
      patient: req.user._id,
      ...(type ? { type } : {})
    });
    res.json({ success: true, count });
  } catch (err) {
    res.json({ success: false, count: 0 });
  }
};

export const getSettings = async (req, res) => {
  try {
    const patient = await Patient.findById(req.user._id)
      .select('name email authProvider googleId password notifications createdAt');

    res.render('patient/settings', {
      title:       'Settings - Healora',
      user:         patient,
      currentPage: 'settings',
      hasPassword:  !!patient.password,
      isGoogleUser: !!patient.googleId,
      notifications: patient.notifications || {
        bookingConfirmed:     true,
        appointmentCancelled: true,
        refundProcessed:      true,
        appointmentReminder:  true
      }
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load settings', user: req.user });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const patient = await Patient.findById(req.user._id).select('password');

    if (!patient.password) {
      return res.status(400).json({ success: false, error: 'No password set on this account.' });
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'New passwords do not match.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, patient.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, error: 'New password must be different from current password.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await Patient.findByIdAndUpdate(req.user._id, { password: hashed });

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
};

export const updateNotifications = async (req, res) => {
  try {
    const {
      bookingConfirmed,
      appointmentCancelled,
      refundProcessed,
      appointmentReminder
    } = req.body;

    await Patient.findByIdAndUpdate(req.user._id, {
      notifications: {
        bookingConfirmed:     bookingConfirmed     === true || bookingConfirmed     === 'true',
        appointmentCancelled: appointmentCancelled === true || appointmentCancelled === 'true',
        refundProcessed:      refundProcessed      === true || refundProcessed      === 'true',
        appointmentReminder:  appointmentReminder  === true || appointmentReminder  === 'true'
      }
    });

    res.json({ success: true, message: 'Notification preferences saved.' });
  } catch (err) {
    console.error('Update notifications error:', err);
    res.status(500).json({ success: false, error: 'Failed to save preferences.' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { password, reason } = req.body;
    const patient = await Patient.findById(req.user._id).select('password googleId');

    if (patient.password) {
      if (!password) {
        return res.status(400).json({ success: false, error: 'Please enter your password to confirm.' });
      }
      const isMatch = await bcrypt.compare(password, patient.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Incorrect password.' });
      }
    }

    await Patient.findByIdAndUpdate(req.user._id, {
      isActive:      false,
      deactivatedAt: new Date(),
      phone:         null,
      profileImage:  '',
      ...(reason ? { deletionReason: reason } : {})
    });

    await RefreshToken.deleteMany({ userId: req.user._id, userModel: 'Patient' });

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ success: true, redirect: '/patient/login?message=account_deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete account.' });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient:     req.user._id,
      recipientType: 'patient'
    }).sort({ createdAt: -1 }).limit(20);

    const unreadCount = await Notification.countDocuments({
      recipient:     req.user._id,
      recipientType: 'patient',
      isRead:        false
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, recipientType: 'patient', isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark notifications' });
  }
};

export const markOneRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark notification' });
  }
};

export const getAppointmentPrescription = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }
    const Prescription = (await import('../models/prescription.model.js')).default;
    const prescription = await Prescription.findOne({ appointment: req.params.id });
    res.json({ success: true, prescription: prescription || null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch prescription' });
  }
};

import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';
import { WeeklyAvailability, MonthlyAvailability, DailyException } from '../models/doctoravailability.model.js';
import Wallet from '../models/wallet.model.js';
import WalletTransaction from '../models/wallettransaction.model.js';
import Payment from '../models/payment.model.js';
import { sendAppointmentCancelledByDoctorEmail } from '../utils/sendEmail.js';
import { sanitizePagination } from '../constants/index.js';
import Prescription   from '../models/prescription.model.js';
import MedicalRecord  from '../models/medicalRecord.model.js';
import Notification   from '../models/notification.model.js';
import cloudinary     from '../config/cloudinary.js';
import bcrypt         from 'bcryptjs';
import Patient        from '../models/patient.model.js';
import { resolveSlots, getWeeklyAvailability as _getWeekly, setWeeklyAvailability as _setWeekly, getDailyExceptions as _getExceptions, setDailyException as _setException, deleteDailyException as _deleteException } from './availability.controller.js';


export const getDashboard = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    const [total, pending, confirmed, completed, cancelled, todayAppointments] = await Promise.all([
      Appointment.countDocuments({ doctor: doctorId }),
      Appointment.countDocuments({ doctor: doctorId, status: 'pending' }),
      Appointment.countDocuments({ doctor: doctorId, status: 'confirmed' }),
      Appointment.countDocuments({ doctor: doctorId, status: 'completed' }),
      Appointment.countDocuments({ doctor: doctorId, status: 'cancelled' }),
      Appointment.find({ doctor: doctorId, date: todayStr })
        .populate('patient', 'name profileImage age gender phone')
        .sort({ timeSlot: 1 })
    ]);

    const nextAppointment = await Appointment.findOne({
      doctor: doctorId,
      date:   { $gte: todayStr },
      status: { $in: ['pending', 'confirmed'] }
    })
    .populate('patient', 'name profileImage')
    .sort({ date: 1, timeSlot: 1 });

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7.push(d.toISOString().split('T')[0]);
    }

    const weeklyData = await Promise.all(
      last7.map(async (date) => {
        const [appts, revenue] = await Promise.all([
          Appointment.countDocuments({ doctor: doctorId, date }),
          Appointment.aggregate([
            {
              $match: {
                doctor: doctorId,
                date,
                status: 'completed',
                paymentStatus: 'paid'
              }
            },
            { $group: { _id: null, total: { $sum: '$consultationFee' } } }
          ])
        ]);
        return {
          date,
          label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
          appointments: appts,
          revenue: revenue[0]?.total || 0
        };
      })
    );

    // ── Monthly earnings (last 6 months) ──
    const monthlyEarnings = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year  = d.getFullYear();
      const month = d.getMonth() + 1;
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const result = await Appointment.aggregate([
        {
          $match: {
            doctor: doctorId,
            date:   { $regex: `^${monthStr}` },
            status: 'completed',
            paymentStatus: 'paid'
          }
        },
        { $group: { _id: null, total: { $sum: '$consultationFee' } } }
      ]);

      monthlyEarnings.push({
        label:    d.toLocaleDateString('en-US', { month: 'short' }),
        earnings: result[0]?.total || 0
      });
    }

    const totalEarningsResult = await Appointment.aggregate([
      {
        $match: {
          doctor: doctorId,
          status: 'completed',
          paymentStatus: 'paid'
        }
      },
      { $group: { _id: null, total: { $sum: '$consultationFee' } } }
    ]);
    const totalEarnings = totalEarningsResult[0]?.total || 0;

    res.render('doctor/dashboard', {
      title:    `Dr. ${req.user.name}'s Dashboard - Healora`,
      user:      req.user,
      currentPage: 'dashboard',
      stats: { total, pending, confirmed, completed, cancelled },
      todayAppointments,
      nextAppointment,
      weeklyData,
      monthlyEarnings,
      totalEarnings
    });
  } catch (err) {
    console.error('Doctor dashboard error:', err);
    res.render('doctor/dashboard', {
      title: 'Dashboard - Healora',
      user:   req.user,
      currentPage: 'dashboard',
      stats: { total:0, pending:0, confirmed:0, completed:0, cancelled:0 },
      todayAppointments: [],
      nextAppointment:   null,
      weeklyData:        [],
      monthlyEarnings:   [],
      totalEarnings:     0
    });
  }
};

/* ==================== GET PATIENTS ==================== */
export const getPatients = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { search = '', page } = req.query;
    const { page: pageNum, limit: limitNum, skip } = sanitizePagination(page, 10);

    const patientIds = await Appointment.distinct('patient', { doctor: doctorId });

    let patientQuery = { _id: { $in: patientIds } };
    if (search.trim()) {
      patientQuery.$or = [
        { name:  { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [patients, total] = await Promise.all([
      Patient.find(patientQuery)
        .select('name email phone profileImage age gender bloodGroup createdAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum),
      Patient.countDocuments(patientQuery)
    ]);

    const patientsWithLastAppt = await Promise.all(
      patients.map(async (p) => {
        const last = await Appointment.findOne({
          doctor: doctorId, patient: p._id
        }).sort({ date: -1 }).select('date status timeSlot');
        const apptCount = await Appointment.countDocuments({
          doctor: doctorId, patient: p._id
        });
        return { ...p.toObject(), lastAppointment: last, apptCount };
      })
    );

    res.render('doctor/patients', {
      title:       'My Patients - Healora',
      user:         req.user,
      currentPage: 'patients',
      patients:     patientsWithLastAppt,
      total,
      searchQuery:  search,
      currentPage_: pageNum,
      totalPages:   Math.ceil(total / limitNum)
    });
  } catch (err) {
    console.error('Get patients error:', err);
    res.render('doctor/patients', {
      title: 'My Patients - Healora',
      user:   req.user,
      currentPage: 'patients',
      patients: [], total: 0, searchQuery: '',
      currentPage_: 1, totalPages: 0
    });
  }
};

/* ==================== GET / SAVE PRESCRIPTION ==================== */
export const getPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.user._id;

    const appointment = await Appointment.findOne({
      _id: appointmentId, doctor: doctorId
    }).populate('patient', 'name email age gender bloodGroup profileImage');

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const prescription = await Prescription.findOne({ appointment: appointmentId });

    res.json({ success: true, prescription: prescription || null, appointment });
  } catch (err) {
    console.error('Get prescription error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch prescription' });
  }
};

export const savePrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId  = req.user._id;
    const { diagnosis, notes, medicines, followUpDate, fileData, fileType } = req.body;

    const appointment = await Appointment.findOne({
      _id:    appointmentId,
      doctor: doctorId,
      status: { $in: ['confirmed', 'completed'] }
    }).populate('patient', 'name');

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found or not eligible' });
    }

    let fileUrl  = '';
    let publicId = '';

    if (fileData && fileData.startsWith('data:')) {
      const resourceType = fileType === 'pdf' ? 'raw' : 'image';
      const uploaded = await cloudinary.uploader.upload(fileData, {
        folder:        `healora/prescriptions/${doctorId}`,
        resource_type: resourceType
      });
      fileUrl  = uploaded.secure_url;
      publicId = uploaded.public_id;
    }

    const updateData = {
      doctor:       doctorId,
      patient:      appointment.patient._id,
      appointment:  appointmentId,
      diagnosis:    diagnosis?.trim()    || '',
      notes:        notes?.trim()        || '',
      medicines:    medicines?.trim()    || '',
      followUpDate: followUpDate         || '',
      ...(fileUrl ? { fileUrl, fileType, publicId } : {})
    };

    const prescription = await Prescription.findOneAndUpdate(
      { appointment: appointmentId },
      updateData,
      { upsert: true, new: true }
    );

    await MedicalRecord.findOneAndUpdate(
      { appointment: appointmentId, type: 'prescription' },
      {
        patient:    appointment.patient._id,
        type:       'prescription',
        title:      `Prescription — Dr. ${req.user.name}`,
        notes:      `${diagnosis ? 'Diagnosis: ' + diagnosis + '\n' : ''}${medicines ? 'Medicines: ' + medicines + '\n' : ''}${notes || ''}`.trim(),
        fileUrl:    fileUrl || '',
        fileType:   fileUrl ? fileType : '',
        publicId:   publicId || '',
        recordDate: appointment.date,
        appointment: appointmentId,
        doctor:     doctorId
      },
      { upsert: true, new: true }
    );

    await Notification.create({
      recipient:     appointment.patient._id,
      recipientType: 'patient',
      type:          'appointment_completed',
      title:         'Prescription Added',
      message:       `Dr. ${req.user.name} has added a prescription for your appointment`,
      link:          '/patient/medical-records?tab=prescription',
      isRead:        false
    }).catch(() => {});

    res.json({ success: true, message: 'Prescription saved successfully', prescription });
  } catch (err) {
    console.error('Save prescription error:', err);
    res.status(500).json({ success: false, error: 'Failed to save prescription' });
  }
};

/* ==================== GET NOTIFICATIONS (Doctor) ==================== */
export const getDoctorNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient:     req.user._id,
      recipientType: 'doctor'
    }).sort({ createdAt: -1 }).limit(20);

    const unreadCount = await Notification.countDocuments({
      recipient:     req.user._id,
      recipientType: 'doctor',
      isRead:        false
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

export const markDoctorNotifRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

export const markAllDoctorNotifsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, recipientType: 'doctor', isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/* ==================== CHANGE DOCTOR PASSWORD ==================== */
export const changeDoctorPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const doctor = await Doctor.findById(req.user._id).select('password');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'New passwords do not match.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, error: 'New password must be different.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, doctor.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    doctor.password = await bcrypt.hash(newPassword, 10);
    await doctor.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change doctor password error:', err);
    res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
};

export const updateDoctorProfile = async (req, res) => {
  try {
    const userId = req.user?._id; 
    const { 
      name, 
      phone, 
      specialization,
      bio, 
      qualification, 
      experience, 
      consultationFee 
    } = req.body;

     if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const errors = {};

    if (!name || typeof name !== 'string') {
      errors.name = 'Name is required';
    } else {
      const trimmedName = name.trim();
      
      if (trimmedName.length < 3) {
        errors.name = 'Name must be at least 3 characters';
      } else if (trimmedName.length > 100) {
        errors.name = 'Name must be less than 100 characters';
      } else if (!/^[a-zA-Z\s.]+$/.test(trimmedName)) {
        errors.name = 'Name can only contain letters, spaces, and dots';
      }
    }

    if (!phone || typeof phone !== 'string') {
      errors.phone = 'Phone is required';
    } else {
      const trimmedPhone = phone.trim();
      
      if (!/^[0-9]{10}$/.test(trimmedPhone)) {
        errors.phone = 'Phone must be exactly 10 digits';
      }
    }

   if (!specialization || typeof specialization !== 'string') {
      errors.specialization = 'Specialization is required';
    } else {
      const trimmed = specialization.trim();
      
      if (trimmed.length < 3) {
        errors.specialization = 'Specialization must be at least 3 characters';
      } else if (trimmed.length > 100) {
        errors.specialization = 'Specialization must be less than 100 characters';
      }
    }

    if (qualification) {
      const trimmed = qualification.trim();
      
      if (trimmed.length > 200) {
        errors.qualification = 'Qualification must be less than 200 characters';
      }
    }

    if (experience !== null && experience !== undefined && experience !== '') {
      const exp = Number(experience);
      
      if (isNaN(exp)) {
        errors.experience = 'Experience must be a number';
      } else if (exp < 0) {
        errors.experience = 'Experience cannot be negative';
      } else if (exp > 70) {
        errors.experience = 'Experience cannot exceed 70 years';
      }
    }

    if (consultationFee !== null && consultationFee !== undefined && consultationFee !== '') {
      const fee = Number(consultationFee);
      
      if (isNaN(fee)) {
        errors.consultationFee = 'Consultation fee must be a number';
      } else if (fee < 0) {
        errors.consultationFee = 'Consultation fee cannot be negative';
      } else if (fee > 50000) {
        errors.consultationFee = 'Consultation fee cannot exceed ₹50,000';
      }
    }

    if (bio) {
      const trimmed = bio.trim();
      
      if (trimmed.length > 1000) {
        errors.bio = 'Bio must be less than 1000 characters';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors
      });
    }

    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
      specialization: specialization.trim(),
      qualification: qualification ? qualification.trim() : '',
      experience: experience ? Number(experience) : 0,
      consultationFee: consultationFee ? Number(consultationFee) : 500,
      bio: bio ? bio.trim() : ''
    };

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password');

    if (!updatedDoctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      doctor: updatedDoctor
    });

  } catch (error) {
    console.error('Update doctor profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile. Please try again later.' 
    });
  }
};

export const getAppointments = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { status = 'all', page } = req.query;

    const { page: pageNum, limit: limitNum, skip } = sanitizePagination(page, 10);

    let query = { doctor: doctorId };
    if (status !== 'all') query.status = status;

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate('patient', 'name phone profileImage age gender')
        .sort({ date: -1, timeSlot: -1 })
        .skip(skip)
        .limit(limitNum),
      Appointment.countDocuments(query)
    ]);

    const [totalCount, pendingCount, confirmedCount, completedCount, cancelledCount] = await Promise.all([
      Appointment.countDocuments({ doctor: doctorId }),
      Appointment.countDocuments({ doctor: doctorId, status: 'pending' }),
      Appointment.countDocuments({ doctor: doctorId, status: 'confirmed' }),
      Appointment.countDocuments({ doctor: doctorId, status: 'completed' }),
      Appointment.countDocuments({ doctor: doctorId, status: 'cancelled' })
    ]);

    res.render('doctor/appointments', {
      title: 'My Appointments - Healora',
      user: req.user,
      currentPage: 'appointments',
      appointments,
      selectedStatus: status,
      stats: { total: totalCount, pending: pendingCount, confirmed: confirmedCount, completed: completedCount, cancelled: cancelledCount },
      pagination: { page: pageNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    console.error('Doctor getAppointments error:', err);
    res.render('doctor/appointments', {
      title: 'My Appointments - Healora',
      user: req.user,
      currentPage: 'appointments',
      appointments: [],
      selectedStatus: 'all',
      stats: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
      pagination: { page: 1, totalPages: 0 }
    });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const doctorId = req.user._id;

    const allowed = ['confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const appointment = await Appointment.findOne({ _id: id, doctor: doctorId })
      .populate('patient', 'name email');

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }
    if (appointment.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot change a completed appointment' });
    }
    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Appointment already cancelled' });
    }

    if (status === 'cancelled') {
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      }

      appointment.cancelledBy        = 'doctor';
      appointment.cancellationReason = reason.trim();
      appointment.cancelledAt        = new Date();

      const isCash  = appointment.paymentMethod === 'cash';
      const wasPaid = appointment.paymentStatus === 'paid';

      if (!isCash && wasPaid) {
        const percentage = 100;
        const amount = Math.round(appointment.consultationFee * percentage / 100);

        appointment.refundPercentage = percentage;
        appointment.refundAmount     = amount;
        appointment.refundStatus     = amount > 0 ? 'pending' : 'none';

        if (amount > 0) {
          if (appointment.paymentMethod === 'wallet') {
            const wallet = await Wallet.findOneAndUpdate(
              { patient: appointment.patient._id },
              { $inc: { balance: amount } },
              { new: true, upsert: true }
            );
            appointment.refundStatus  = 'processed';
            appointment.refundedAt    = new Date();
            appointment.paymentStatus = amount === appointment.consultationFee ? 'refunded' : 'partially_refunded';

            await WalletTransaction.create({
              patient:         appointment.patient._id,
              type:            'credit',
              amount,
              description:     `Refund — appointment cancelled by doctor (${percentage}%)`,
              balanceBefore:   wallet.balance - amount,
              balanceAfter:    wallet.balance,
              appointment:     id,
              transactionType: 'refund'
            });
          }

if (appointment.paymentMethod === 'razorpay') {
  const wallet = await Wallet.findOneAndUpdate(
    { patient: appointment.patient._id },
    { $inc: { balance: amount } },
    { new: true, upsert: true }
  );
  appointment.refundStatus  = 'processed';
  appointment.refundedAt    = new Date();
  appointment.paymentStatus = 'refunded';

  await WalletTransaction.create({
    patient:         appointment.patient._id,
    type:            'credit',
    amount,
    description:     `Refund — appointment cancelled by doctor (credited to wallet)`,
    balanceBefore:   wallet.balance - amount,
    balanceAfter:    wallet.balance,
    appointment:     id,
    transactionType: 'refund'
  });
}

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

let availableSlots = [];
try {
  const dateStr = typeof appointment.date === 'string'
    ? appointment.date
    : new Date(appointment.date).toISOString().split('T')[0];

  const dayName = new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const [dateObj] = [new Date(dateStr + 'T00:00:00')];
  const month = dateObj.getMonth() + 1;
  const year  = dateObj.getFullYear();
  
  const exception = await DailyException.findOne({ doctor: doctorId, date: dateStr });

  let slots = [];
  if (exception) {
    slots = exception.isWorking ? exception.slots : [];
  } else {
    const monthly = await MonthlyAvailability.findOne({ doctor: doctorId, month, year });
    if (monthly?.schedule?.[dayName]?.isWorking) {
      slots = monthly.schedule[dayName].slots;
    } else {
      const weekly = await WeeklyAvailability.findOne({ doctor: doctorId });
      if (weekly?.schedule?.[dayName]?.isWorking) {
        slots = weekly.schedule[dayName].slots;
      }
    }
  }

  const bookedAppointments = await Appointment.find({
    doctor: doctorId,
    date:   dateStr,
    status: { $in: ['pending', 'confirmed'] },
    _id:    { $ne: id }
  }).select('timeSlot');

  const bookedSlots = bookedAppointments.map(a => a.timeSlot);
  availableSlots = slots.filter(s => !bookedSlots.includes(s));
} catch (slotErr) {
  console.error('Slot fetch error:', slotErr);
}

      try {
        await sendAppointmentCancelledByDoctorEmail(
          appointment.patient.email,
          appointment.patient.name,
          {
            doctorName:     req.user.name,
            date:           appointment.date,
            timeSlot:       appointment.timeSlot,
            reason:         reason.trim(),
            availableSlots,
            refundAmount:   appointment.refundAmount || 0,
            refundStatus:   appointment.refundStatus,
            paymentMethod:  appointment.paymentMethod
          }
        );
      } catch (emailErr) {
        console.error('Cancel email error:', emailErr);
      }
    }

    appointment.status = status;
    await appointment.save();

    res.json({ success: true, message: `Appointment ${status} successfully`, appointment });
  } catch (err) {
    console.error('Doctor updateAppointmentStatus error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/* ==================== AVAILABILITY (Doctor self) ==================== */

export const getAvailabilityPage = async (req, res) => {
  res.render('doctor/availability', {
    title:       'My Availability - Healora',
    user:         req.user,
    currentPage: 'availability'
  });
};

export const getMyWeekly = async (req, res) => {
  req.params.doctorId = req.user._id.toString();
  return _getWeekly(req, res);
};

export const setMyWeekly = async (req, res) => {
  req.params.doctorId = req.user._id.toString();
  return _setWeekly(req, res);
};

export const getMyExceptions = async (req, res) => {
  req.params.doctorId = req.user._id.toString();
  return _getExceptions(req, res);
};

export const setMyException = async (req, res) => {
  req.params.doctorId = req.user._id.toString();
  return _setException(req, res);
};

export const deleteMyException = async (req, res) => {
  req.params.doctorId = req.user._id.toString();
  return _deleteException(req, res);
};
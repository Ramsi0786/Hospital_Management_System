
import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';
import { WeeklyAvailability, MonthlyAvailability, DailyException } from '../models/doctorAvailability.model.js';
import Wallet from '../models/wallet.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import Payment from '../models/payment.model.js';
import Razorpay from 'razorpay';
import { sendAppointmentCancelledByDoctorEmail } from '../utils/sendEmail.js';
import { sanitizePagination } from '../constants/index.js';


export const getDashboard = (req, res) => {
  res.render("doctor/dashboard", {
    title: `Dr. ${req.user.name}'s Dashboard - Healora`,
    currentPage: 'dashboard'
  });
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

    // ── Cancellation ──────────────────────────────────────────────
    if (status === 'cancelled') {
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      }

      appointment.cancelledBy        = 'doctor';
      appointment.cancellationReason = reason.trim();
      appointment.cancelledAt        = new Date();

      // ── Refund logic (same as admin) ──
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

      // ── Fetch available slots same day ──
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

  // Priority: DailyException → MonthlyAvailability → WeeklyAvailability
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
      
      // ── Send email to patient ──
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
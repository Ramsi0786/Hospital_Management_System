import LeaveRequest     from '../models/leaveRequest.model.js';
import DoctorSalary     from '../models/doctorSalary.model.js';
import SalaryDeduction  from '../models/salaryDeduction.model.js';
import Doctor           from '../models/doctor.model.js';
import Appointment      from '../models/appointment.model.js';
import { DailyException, WeeklyAvailability } from '../models/doctoravailability.model.js';
import Admin            from '../models/admin.model.js';
import { cancelAppointmentsForLeave } from '../utils/cancelAppointments.js';
import Notification from '../models/notification.model.js';
import {
  sendLeaveRequestAdminEmail,
  sendEmergencyLeaveAdminEmail,
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
} from '../utils/sendEmail.js';


async function notifyAdmin(type, title, message, link = '/admin/leave-requests') {
  try {
    const admin = await Admin.findOne({}).select('_id');
    if (!admin) return;
    await Notification.create({
      recipient:     admin._id,
      recipientType: 'admin',
      type,
      title,
      message,
      link,
      isRead: false
    });
  } catch (err) {
    console.error('Admin notify error:', err);
  }
}

async function notifyDoctor(doctorId, type, title, message, link = '/doctor/availability') {
  try {
    await Notification.create({
      recipient:     doctorId,
      recipientType: 'doctor',
      type,
      title,
      message,
      link,
      isRead: false
    });
  } catch (err) {
    console.error('Doctor notify error:', err);
  }
}

async function getAdminEmail() {
  const admin = await Admin.findOne({}).select('email');
  return admin?.email || process.env.ADMIN_EMAIL;
}

async function calculateSalaryImpact(doctorId, leaveType, halfDayPeriod, date) {
  const salaryConfig = await DoctorSalary.findOne({ doctor: doctorId });
  if (!salaryConfig || !salaryConfig.monthlySalary) {
    return { withinAllowance: true, amount: 0, type: 'none', description: 'No salary configured' };
  }

  const d = new Date(date + 'T00:00:00');
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();

  const { monthlySalary, workingDaysPerMonth, normalLeaveAllowance,
          halfDayAllowance, emergencyFreeCount,
          emergencyTier1, emergencyTier2, emergencyTier3 } = salaryConfig;

  const dailySalary = monthlySalary / workingDaysPerMonth;

  if (leaveType === 'emergency') {

    const emergencyCount = await LeaveRequest.countDocuments({
      doctor: doctorId,
      type:   'emergency',
      status: { $in: ['approved', 'auto_approved'] },
      date:   { $regex: `^${year}-${String(month).padStart(2,'0')}` }
    });

    const thisEmergencyNumber = emergencyCount + 1;

    if (thisEmergencyNumber <= emergencyFreeCount) {
      return { withinAllowance: true, amount: 0, type: 'none',
               description: `Emergency ${thisEmergencyNumber} of ${emergencyFreeCount} free per month` };
    }

    const tierIndex = thisEmergencyNumber - emergencyFreeCount; 
    let percentage, tierKey;
    if      (tierIndex === 1) { percentage = emergencyTier1; tierKey = 'emergency_tier1'; }
    else if (tierIndex === 2) { percentage = emergencyTier2; tierKey = 'emergency_tier2'; }
    else                      { percentage = emergencyTier3; tierKey = 'emergency_tier3'; }

    const amount = Math.round(monthlySalary * percentage / 100);
    return {
      withinAllowance: false,
      amount,
      type: tierKey,
      description: `Emergency leave #${thisEmergencyNumber} this month — ${percentage}% of monthly salary`
    };
  }

  if (leaveType === 'half') {
    const halfDayCount = await LeaveRequest.countDocuments({
      doctor: doctorId,
      type:   'half',
      status: { $in: ['approved', 'auto_approved'] },
      date:   { $regex: `^${year}-${String(month).padStart(2,'0')}` }
    });

    if (halfDayCount < halfDayAllowance) {
      return { withinAllowance: true, amount: 0, type: 'none',
               description: `Half day ${halfDayCount+1} of ${halfDayAllowance} free per month` };
    }

    const amount = Math.round(dailySalary / 2);
    return {
      withinAllowance: false,
      amount,
      type: 'normal_excess',
      description: `Exceeded half day allowance (${halfDayAllowance}/month) — 0.5 day deduction`
    };
  }

  const normalCount = await LeaveRequest.countDocuments({
    doctor: doctorId,
    type:   'full',
    status: { $in: ['approved', 'auto_approved'] },
    date:   { $regex: `^${year}-${String(month).padStart(2,'0')}` }
  });

  if (normalCount < normalLeaveAllowance) {
    return { withinAllowance: true, amount: 0, type: 'none',
             description: `Leave ${normalCount+1} of ${normalLeaveAllowance} free per month` };
  }

  const amount = Math.round(dailySalary);
  return {
    withinAllowance: false,
    amount,
    type: 'normal_excess',
    description: `Exceeded normal leave allowance (${normalLeaveAllowance}/month) — 1 day deduction`
  };
}

/* ══════════════════════════════════════ DOCTOR SIDE ══════════════════════════════════════ */

export const getAvailabilityPage = async (req, res) => {
  try {
    const doctorId = req.user._id;

    const [weekly, leaveRequests, salaryConfig] = await Promise.all([
      WeeklyAvailability.findOne({ doctor: doctorId }),
      LeaveRequest.find({ doctor: doctorId }).sort({ date: -1 }).limit(20),
      DoctorSalary.findOne({ doctor: doctorId })
    ]);

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const monthStr = `${year}-${String(month).padStart(2,'0')}`;

    const [normalUsed, halfUsed, emergencyUsed] = await Promise.all([
      LeaveRequest.countDocuments({ doctor: doctorId, type: 'full', status: { $in: ['approved','auto_approved'] }, date: { $regex: `^${monthStr}` } }),
      LeaveRequest.countDocuments({ doctor: doctorId, type: 'half', status: { $in: ['approved','auto_approved'] }, date: { $regex: `^${monthStr}` } }),
      LeaveRequest.countDocuments({ doctor: doctorId, type: 'emergency', status: { $in: ['approved','auto_approved'] }, date: { $regex: `^${monthStr}` } })
    ]);

    res.render('doctor/availability', {
      title:       'My Availability - Healora',
      user:         req.user,
      currentPage: 'availability',
      weekly:       weekly || null,
      leaveRequests,
      salaryConfig: salaryConfig || null,
      monthlyUsage: { normalUsed, halfUsed, emergencyUsed, month, year }
    });
  } catch (err) {
    console.error('Get availability page error:', err);
    res.render('doctor/availability', {
      title: 'My Availability - Healora',
      user:   req.user,
      currentPage: 'availability',
      weekly: null, leaveRequests: [], salaryConfig: null,
      monthlyUsage: { normalUsed:0, halfUsed:0, emergencyUsed:0 }
    });
  }
};

export const getLeaveImpact = async (req, res) => {
  try {
    const { date, type, halfDayPeriod } = req.query;
    const doctorId = req.user._id;

    if (!date || !type) {
      return res.status(400).json({ success: false, error: 'Date and type required' });
    }

    const existing = await LeaveRequest.findOne({ doctor: doctorId, date });
    if (existing) {
      return res.json({
        success: false,
        error:   `You already have a ${existing.status} leave request for this date.`
      });
    }

    const d       = new Date(date + 'T00:00:00');
    const days    = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayName = days[d.getDay()];
    const weekly  = await WeeklyAvailability.findOne({ doctor: doctorId });
    const isWorkingDay = weekly?.schedule?.[dayName]?.isWorking || false;

    if (!isWorkingDay) {
      return res.json({
        success: false,
        error:   'This is already a non-working day in your schedule.'
      });
    }

    let apptQuery = { doctor: doctorId, date, status: { $in: ['pending','confirmed'] } };
    const allAppts = await Appointment.find(apptQuery);

    let affectedAppts = allAppts;
    if (type === 'half' && halfDayPeriod) {
      affectedAppts = allAppts.filter(a => {
        const [h] = a.timeSlot.split(':').map(Number);
        if (halfDayPeriod === 'morning')   return h < 12;
        if (halfDayPeriod === 'afternoon') return h >= 14;
        return true;
      });
    }

    const affectedCount  = affectedAppts.length;
    const earningsLoss   = affectedAppts.reduce((s, a) => s + (a.consultationFee || 0), 0);

    const today    = new Date();
    today.setHours(0,0,0,0);
    const daysUntil = Math.floor((d - today) / (1000*60*60*24));
    const isEmergency = type === 'emergency' || daysUntil < 5;

    const salaryImpact = await calculateSalaryImpact(
      doctorId, isEmergency ? 'emergency' : type, halfDayPeriod, date
    );

    res.json({
      success: true,
      affectedCount,
      earningsLoss,
      daysUntil,
      isEmergency,
      isWorkingDay,
      salaryImpact
    });
  } catch (err) {
    console.error('Get leave impact error:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate impact' });
  }
};

export const requestLeave = async (req, res) => {
  try {
    const { date, type, halfDayPeriod, reason } = req.body;
    const doctorId = req.user._id;

    if (!date || !type || !reason?.trim()) {
      return res.status(400).json({ success: false, error: 'Date, type and reason are required.' });
    }

    const d     = new Date(date + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    if (d < today) {
      return res.status(400).json({ success: false, error: 'Cannot request leave for a past date.' });
    }

    const existing = await LeaveRequest.findOne({ doctor: doctorId, date });
    if (existing) {
      return res.status(409).json({ success: false, error: 'You already have a leave request for this date.' });
    }

    const daysUntil  = Math.floor((d - today) / (1000*60*60*24));
    const isEmergency = type === 'emergency' || daysUntil < 5;
    const effectiveType = isEmergency ? 'emergency' : type;

    const allAppts = await Appointment.find({
      doctor: doctorId, date, status: { $in: ['pending','confirmed'] }
    }).populate('patient', 'name');

    let affectedAppts = allAppts;
    if (effectiveType === 'half' && halfDayPeriod) {
      affectedAppts = allAppts.filter(a => {
        const [h] = a.timeSlot.split(':').map(Number);
        if (halfDayPeriod === 'morning')   return h < 12;
        if (halfDayPeriod === 'afternoon') return h >= 14;
        return true;
      });
    }

    const affectedCount = affectedAppts.length;
    const earningsLoss  = affectedAppts.reduce((s, a) => s + (a.consultationFee || 0), 0);
    const salaryImpact  = await calculateSalaryImpact(doctorId, effectiveType, halfDayPeriod, date);

    const autoApproveAt = isEmergency
      ? new Date(Date.now() + 2 * 60 * 60 * 1000) 
      : null;

    const leave = await LeaveRequest.create({
      doctor:   doctorId,
      date,
      type:     effectiveType,
      halfDayPeriod: effectiveType === 'half' ? halfDayPeriod : null,
      reason:   reason.trim(),
      isEmergency,
      autoApproveAt,
      affectedAppointmentsCount: affectedCount,
      estimatedConsultationLoss: earningsLoss,
      withinAllowance:       salaryImpact.withinAllowance,
      salaryDeductionAmount: salaryImpact.amount,
      salaryDeductionType:   salaryImpact.type,
      requestedAt: new Date()
    });

if (isEmergency) {
  notifyAdmin(
    'leave_emergency',
    '🚨 Emergency Leave Request',
    `Dr. ${req.user.name} has submitted an emergency leave request for ${date}. Auto-approves in 2 hours.`,
    '/admin/leave-requests'
  );
} else {
  notifyAdmin(
    'leave_request',
    'New Leave Request',
    `Dr. ${req.user.name} has requested ${effectiveType === 'half' ? 'half day' : 'full day'} leave for ${date}.`,
    '/admin/leave-requests'
  );
}
    const adminEmail = await getAdminEmail();
    if (isEmergency) {
      sendEmergencyLeaveAdminEmail(adminEmail, {
        doctorName:    req.user.name,
        date,
        reason:        reason.trim(),
        affectedCount,
        earningsLoss,
        autoApproveAt
      }).catch(() => {});
    } else {
      sendLeaveRequestAdminEmail(adminEmail, {
        doctorName:      req.user.name,
        date,
        type:            effectiveType,
        halfDayPeriod,
        reason:          reason.trim(),
        affectedCount,
        earningsLoss,
        salaryImpact:    salaryImpact.amount,
        withinAllowance: salaryImpact.withinAllowance
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: isEmergency
        ? 'Emergency leave request submitted. Auto-approves in 2 hours if admin does not respond.'
        : 'Leave request submitted successfully. Awaiting admin approval.',
      leave,
      isEmergency
    });
  } catch (err) {
    console.error('Request leave error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'You already have a leave request for this date.' });
    }
    res.status(500).json({ success: false, error: 'Failed to submit leave request.' });
  }
};

export const getMyLeaveRequests = async (req, res) => {
  try {
    const leaves = await LeaveRequest.find({ doctor: req.user._id })
      .sort({ date: -1 })
      .limit(30);
    res.json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leave requests.' });
  }
};

/* ══════════════════════════════════════ ADMIN SIDE ══════════════════════════════════════ */

export const getAdminLeaveRequests = async (req, res) => {
  try {
    const { status = '', page = 1 } = req.query;
    const limit = 15;
    const skip  = (parseInt(page) - 1) * limit;

    let query = {};
    if (status && status !== 'all') query.status = status;

    const [leaves, total] = await Promise.all([
      LeaveRequest.find(query)
        .populate('doctor', 'name email specialization department profileImage')
        .sort({ isEmergency: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeaveRequest.countDocuments(query)
    ]);

    const [pendingCount, emergencyCount] = await Promise.all([
      LeaveRequest.countDocuments({ status: 'pending' }),
      LeaveRequest.countDocuments({ status: 'pending', isEmergency: true })
    ]);

    res.render('admin/leave-requests', {
      title:   'Leave Requests - Healora Admin',
      admin:    req.admin || req.user,
      leaves,
      pagination: {
        total, page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      },
      filters: { status },
      stats: { pendingCount, emergencyCount }
    });
  } catch (err) {
    console.error('Get admin leave requests error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load leave requests' });
  }
};

export const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote = '' } = req.body;

    const leave = await LeaveRequest.findById(id)
      .populate('doctor', 'name email');

    if (!leave) return res.status(404).json({ success: false, error: 'Leave request not found' });
    if (leave.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'This request has already been processed.' });
    }

    leave.status      = 'approved';
    leave.adminNote   = adminNote;
    leave.respondedAt = new Date();
    await leave.save();

    await DailyException.findOneAndUpdate(
      { doctor: leave.doctor._id, date: leave.date },
      {
        doctor:    leave.doctor._id,
        date:      leave.date,
        isWorking: false,
        slots:     [],
        reason:    `Approved leave — ${leave.reason}`
      },
      { upsert: true, new: true }
    );

    const cancelled = await cancelAppointmentsForLeave(
      leave.doctor._id, leave.date, leave.halfDayPeriod
    );

    leave.appointmentsCancelled = true;
    await leave.save();

    if (!leave.withinAllowance && leave.salaryDeductionAmount > 0) {
      const d = new Date(leave.date + 'T00:00:00');
      await SalaryDeduction.create({
        doctor:        leave.doctor._id,
        leaveRequest:  leave._id,
        month:         d.getMonth() + 1,
        year:          d.getFullYear(),
        amount:        leave.salaryDeductionAmount,
        deductionType: leave.salaryDeductionType,
        description:   `Leave on ${leave.date} — ${leave.salaryDeductionType.replace(/_/g,' ')}`,
        status:        'pending'
      });
    }

if (!leave.withinAllowance && leave.salaryDeductionAmount > 0) {
  notifyAdmin(
    'salary_deduction',
    'Salary Deduction Pending',
    `Leave approved for Dr. ${leave.doctor.name}. ₹${leave.salaryDeductionAmount} deduction pending your confirmation.`,
    '/admin/leave-requests'
  );
}

    sendLeaveApprovedEmail(leave.doctor.email, {
      doctorName:            leave.doctor.name,
      date:                  leave.date,
      type:                  leave.type,
      halfDayPeriod:         leave.halfDayPeriod,
      salaryDeductionAmount: leave.salaryDeductionAmount,
      withinAllowance:       leave.withinAllowance,
      adminNote
    }).catch(() => {});

notifyDoctor(
  leave.doctor._id,
  'appointment_confirmed',
  'Leave Request Approved',
  `Your leave request for ${leave.date} has been approved by admin.${leave.salaryDeductionAmount > 0 ? ` Salary deduction of ₹${leave.salaryDeductionAmount} is pending confirmation.` : ''}`,
  '/doctor/availability'
).catch(() => {});

    res.json({
      success: true,
      message: `Leave approved. ${cancelled} appointment(s) cancelled with full refunds.`
    });
  } catch (err) {
    console.error('Approve leave error:', err);
    res.status(500).json({ success: false, error: 'Failed to approve leave.' });
  }
};

export const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    if (!adminNote?.trim()) {
      return res.status(400).json({ success: false, error: 'Please provide a reason for rejection.' });
    }

    const leave = await LeaveRequest.findById(id)
      .populate('doctor', 'name email');

    if (!leave) return res.status(404).json({ success: false, error: 'Leave request not found' });
    if (leave.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'This request has already been processed.' });
    }

    leave.status      = 'rejected';
    leave.adminNote   = adminNote.trim();
    leave.respondedAt = new Date();
    await leave.save();

    sendLeaveRejectedEmail(leave.doctor.email, {
      doctorName: leave.doctor.name,
      date:       leave.date,
      type:       leave.type,
      adminNote:  adminNote.trim()
    }).catch(() => {});

notifyDoctor(
  leave.doctor._id,
  'appointment_cancelled',
  'Leave Request Rejected',
  `Your leave request for ${leave.date} has been rejected. Reason: ${adminNote.trim()}`,
  '/doctor/availability'
).catch(() => {});

    res.json({ success: true, message: 'Leave request rejected.' });
  } catch (err) {
    console.error('Reject leave error:', err);
    res.status(500).json({ success: false, error: 'Failed to reject leave.' });
  }
};

export const getSalaryDeductions = async (req, res) => {
  try {
    const { doctorId, month, year, status } = req.query;

    let query = {};
    if (doctorId) query.doctor = doctorId;
    if (month)    query.month  = parseInt(month);
    if (year)     query.year   = parseInt(year);
    if (status)   query.status = status;

    const deductions = await SalaryDeduction.find(query)
      .populate('doctor', 'name email department')
      .populate('leaveRequest', 'date type reason')
      .sort({ createdAt: -1 });

    res.json({ success: true, deductions });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch deductions.' });
  }
};

export const processDeduction = async (req, res) => {
  try {
    const { id }      = req.params;
    const { action, adminNote } = req.body; 

    if (!['processed','waived'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action.' });
    }

    const deduction = await SalaryDeduction.findByIdAndUpdate(
      id,
      { status: action, adminNote: adminNote || '', confirmedAt: new Date() },
      { new: true }
    ).populate('doctor', 'name');

    if (!deduction) return res.status(404).json({ success: false, error: 'Deduction not found.' });

    res.json({
      success: true,
      message: action === 'waived'
        ? `Deduction waived for Dr. ${deduction.doctor.name}.`
        : `Deduction confirmed for Dr. ${deduction.doctor.name}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to process deduction.' });
  }
};

export const getDoctorSalary = async (req, res) => {
  try {
    const salary = await DoctorSalary.findOne({ doctor: req.params.doctorId });
    res.json({ success: true, salary: salary || null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch salary.' });
  }
};

export const setDoctorSalary = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const {
      monthlySalary, workingDaysPerMonth,
      normalLeaveAllowance, halfDayAllowance, emergencyFreeCount,
      emergencyTier1, emergencyTier2, emergencyTier3
    } = req.body;

    if (!monthlySalary || isNaN(Number(monthlySalary))) {
      return res.status(400).json({ success: false, error: 'Valid monthly salary is required.' });
    }

    const salary = await DoctorSalary.findOneAndUpdate(
      { doctor: doctorId },
      {
        doctor:               doctorId,
        monthlySalary:        Number(monthlySalary),
        workingDaysPerMonth:  Number(workingDaysPerMonth)  || 26,
        normalLeaveAllowance: Number(normalLeaveAllowance) || 2,
        halfDayAllowance:     Number(halfDayAllowance)     || 4,
        emergencyFreeCount:   Number(emergencyFreeCount)   || 1,
        emergencyTier1:       Number(emergencyTier1)       || 5,
        emergencyTier2:       Number(emergencyTier2)       || 15,
        emergencyTier3:       Number(emergencyTier3)       || 25
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Salary configuration saved.', salary });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save salary.' });
  }
};


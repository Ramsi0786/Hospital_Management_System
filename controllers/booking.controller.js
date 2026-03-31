import Appointment from '../models/appointment.model.js';
import Doctor from '../models/doctor.model.js';
import Wallet from '../models/wallet.model.js';
import WalletTransaction from '../models/wallettransaction.model.js';
import Payment from '../models/payment.model.js';
import Review from '../models/review.model.js';
import { resolveSlots } from './availability.controller.js';
import { generateInvoicePDF, saveInvoiceRecord } from '../utils/generateInvoice.js';
import { sendBookingConfirmationEmail } from '../utils/sendEmail.js';
import { notifyAppointmentBooked, notifyAppointmentCancelled, notifyRefundProcessed } from '../utils/createNotification.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';


const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


const sendInvoiceAndEmail = async (appointment, doctor, patient) => {
  try {
    const pdfBuffer = await generateInvoicePDF({ appointment, doctor, patient });
    await saveInvoiceRecord(appointment, 'booking'); 
    await sendBookingConfirmationEmail(patient.email, {
      patientName:    patient.name,
      doctorName:     doctor.name,
      specialization: doctor.specialization,
      department:     doctor.department,
      date:           appointment.date,
      timeSlot:       appointment.timeSlot,
      fee:            appointment.consultationFee,
      paymentMethod:  appointment.paymentMethod,
      paymentStatus:  appointment.paymentStatus,
      bookingId:      appointment._id.toString().slice(-8).toUpperCase(),
      status:         appointment.status
    }, pdfBuffer);
  } catch (err) {
    console.error('Invoice/email error (non-fatal):', err.message);
  }
};

export const downloadInvoice = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate('doctor')
      .populate('patient');

    if (!appointment || appointment.patient._id.toString() !== req.user._id.toString()) {
      return res.status(404).send('Invoice not found');
    }

    const pdfBuffer = await generateInvoicePDF({ 
      appointment, 
      doctor: appointment.doctor, 
      patient: appointment.patient 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${req.params.appointmentId.slice(-8).toUpperCase()}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Download invoice error:', err);
    res.status(500).send('Failed to generate invoice');
  }
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function isSlotAvailable(doctorId, date, timeSlot) {

  const resolved = await resolveSlots(doctorId, date);
  if (!resolved.isWorking || !resolved.slots.includes(timeSlot)) return false;

  const conflict = await Appointment.findOne({
    doctor:   doctorId,
    date,
    timeSlot,
    status:   { $in: ['pending', 'confirmed'] }
  });
  return !conflict;
}

function calcRefund(fee, appointmentDate, timeSlot) {
  const apptDateTime = new Date(`${appointmentDate}T${timeSlot}:00`);
  const now          = new Date();
  const diffHours    = (apptDateTime - now) / (1000 * 60 * 60);

  if (diffHours >= 12) return { percentage: 90, amount: Math.round(fee * 0.9) };
  return                      { percentage: 0,  amount: 0 };
}

export const renderBookingPage = async (req, res) => {
  try {
    const { doctor: doctorId, date, slot } = req.query;

    if (!doctorId || !date || !slot) {
      return res.redirect('/patient/doctors');
    }

    const doctor = await Doctor.findById(doctorId).select('-password');
    if (!doctor || doctor.status !== 'active') {
      return res.redirect('/patient/doctors');
    }

    const available = await isSlotAvailable(doctorId, date, slot);
    if (!available) {
      return res.redirect(`/patient/doctors/${doctorId}?slotTaken=1`);
    }

    const wallet = await Wallet.findOne({ patient: req.user._id });
    const walletBalance = wallet ? wallet.balance : 0;

    res.render('patient/booking', {
      title:   'Book Appointment - Healora',
      user:     req.user,
      doctor,
      date,
      slot,
      walletBalance,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Render booking page error:', err);
    res.redirect('/patient/doctors');
  }
};


export const createBooking = async (req, res) => {
  try {
    const { doctorId, date, timeSlot, reason, paymentMethod } = req.body;
    const patientId = req.user._id;

    if (!doctorId || !date || !timeSlot || !paymentMethod) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const doctor = await Doctor.findById(doctorId).select('-password');
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    const available = await isSlotAvailable(doctorId, date, timeSlot);
    if (!available) {
      return res.status(409).json({ success: false, error: 'This slot is no longer available. Please choose another.' });
    }

    const fee = doctor.consultationFee;

    // ── CASH ──────────────────────────────────────────────
    if (paymentMethod === 'cash') {
      const appointment = await Appointment.create({
        patient:       patientId,
        doctor:        doctorId,
        department:    doctor.department,
        date,
        timeSlot,
        reason:        reason || '',
        status:        'pending',
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        consultationFee: fee
      });

      await Payment.create({
        appointment: appointment._id,
        patient:     patientId,
        amount:      fee,
        method:      'cash',
        status:      'pending'
      });

      const patient = await (await import('../models/patient.model.js')).default.findById(patientId).select('name email phone');
      sendInvoiceAndEmail(appointment, doctor, patient);
      notifyAppointmentBooked(appointment, doctor, patient).catch(e => console.error('Notify error:', e));
      
      return res.json({
        success: true,
        method:  'cash',
        appointmentId: appointment._id,
        redirectUrl: `/patient/appointments/${appointment._id}/success`
      });
    }

    // ── WALLET ─────────────────────────────────────────────
    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ patient: patientId });
      if (!wallet || wallet.balance < fee) {
        return res.status(400).json({ success: false, error: `Insufficient wallet balance. You need ₹${fee}, you have ₹${wallet?.balance || 0}.` });
      }

      const balanceBefore = wallet.balance;
      wallet.balance -= fee;
      await wallet.save();

      const appointment = await Appointment.create({
        patient:         patientId,
        doctor:          doctorId,
        department:      doctor.department,
        date,
        timeSlot,
        reason:          reason || '',
        status:          'confirmed',
        paymentMethod:   'wallet',
        paymentStatus:   'paid',
        consultationFee: fee
      });

      await Payment.create({
        appointment: appointment._id,
        patient:     patientId,
        amount:      fee,
        method:      'wallet',
        status:      'completed'
      });

      await WalletTransaction.create({
        patient:         patientId,
        type:            'debit',
        amount:          fee,
        description:     `Appointment booked with Dr. ${doctor.name}`,
        balanceBefore,
        balanceAfter:    wallet.balance,
        appointment:     appointment._id,
        transactionType: 'booking'
      });

      const patient = await (await import('../models/patient.model.js')).default.findById(patientId).select('name email phone');
      sendInvoiceAndEmail(appointment, doctor, patient);
      notifyAppointmentBooked(appointment, doctor, patient).catch(e => console.error('Notify error:', e));
      
      return res.json({
        success: true,
        method:  'wallet',
        appointmentId: appointment._id,
        redirectUrl: `/patient/appointments/${appointment._id}/success`
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid payment method' });

  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
};


export const createRazorpayOrder = async (req, res) => {
  try {
    const { doctorId, date, timeSlot } = req.body;

    const doctor = await Doctor.findById(doctorId).select('consultationFee');
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    const available = await isSlotAvailable(doctorId, date, timeSlot);
    if (!available) {
      return res.status(409).json({ success: false, error: 'Slot no longer available' });
    }

    const order = await razorpay.orders.create({
      amount:   doctor.consultationFee * 100, 
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`
    });

    res.json({ success: true, order, fee: doctor.consultationFee });
  } catch (err) {
    console.error('Create Razorpay order error:', err);
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
};


export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      doctorId,
      date,
      timeSlot,
      reason
    } = req.body;

    const patientId = req.user._id;

    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    const doctor = await Doctor.findById(doctorId).select('-password');
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    const fee = doctor.consultationFee;

    const available = await isSlotAvailable(doctorId, date, timeSlot);
    if (!available) {
      await razorpay.payments.refund(razorpay_payment_id, { amount: fee * 100 });
      return res.status(409).json({ success: false, error: 'Slot was taken. Your payment will be refunded.' });
    }

    const appointment = await Appointment.create({
      patient:           patientId,
      doctor:            doctorId,
      department:        doctor.department,
      date,
      timeSlot,
      reason:            reason || '',
      status:            'confirmed',
      paymentMethod:     'razorpay',
      paymentStatus:     'paid',
      consultationFee:   fee,
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature
    });

    await Payment.create({
      appointment:       appointment._id,
      patient:           patientId,
      amount:            fee,
      method:            'razorpay',
      status:            'completed',
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature
    });

    const patientDoc = await (await import('../models/patient.model.js')).default.findById(patientId).select('name email phone');
    sendInvoiceAndEmail(appointment, doctor, patientDoc);
    notifyAppointmentBooked(appointment, doctor, patientDoc).catch(e => console.error('Notify error:', e));
    
    res.json({
      success: true,
      appointmentId: appointment._id,
      redirectUrl: `/patient/appointments/${appointment._id}/success`
    });
  } catch (err) {
    console.error('Verify Razorpay payment error:', err);
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

export const bookingSuccess = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'name specialization department profileImage consultationFee')
      .populate('patient', 'name email');

    if (!appointment || appointment.patient._id.toString() !== req.user._id.toString()) {
      return res.redirect('/patient/dashboard');
    }

    res.render('patient/booking-success', {
      title: 'Booking Confirmed - Healora',
      user:  req.user,
      appointment
    });
  } catch (err) {
    console.error('Booking success error:', err);
    res.redirect('/patient/dashboard');
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const patientId = req.user._id;

    const appointment = await Appointment.findById(id);
    if (!appointment || appointment.patient.toString() !== patientId.toString()) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({ success: false, error: 'This appointment cannot be cancelled' });
    }

const isCash = appointment.paymentMethod === 'cash';
const { percentage, amount } = isCash
  ? { percentage: 0, amount: 0 }
  : calcRefund(appointment.consultationFee, appointment.date, appointment.timeSlot);

appointment.status             = 'cancelled';
appointment.cancelledBy        = 'patient';
appointment.cancellationReason = reason || '';
appointment.cancelledAt        = new Date();
appointment.refundPercentage   = percentage;
appointment.refundAmount       = amount;
appointment.refundStatus       = isCash ? 'none' : (amount > 0 ? 'pending' : 'none');
    if (amount > 0) {
      if (appointment.paymentMethod === 'wallet') {
        const wallet = await Wallet.findOneAndUpdate(
          { patient: patientId },
          { $inc: { balance: amount } },
          { new: true, upsert: true }
        );
        appointment.refundStatus = 'processed';
        appointment.refundedAt   = new Date();

        await WalletTransaction.create({
          patient:         patientId,
          type:            'credit',
          amount,
          description:     `Refund for cancelled appointment (${percentage}%)`,
          balanceBefore:   wallet.balance - amount,
          balanceAfter:    wallet.balance,
          appointment:     id,
          transactionType: 'refund'
        });
      }

      if (appointment.paymentMethod === 'razorpay') {
  const wallet = await Wallet.findOneAndUpdate(
    { patient: patientId },
    { $inc: { balance: amount } },
    { new: true, upsert: true }
  );
  appointment.refundStatus = 'processed';
  appointment.refundedAt   = new Date();

  await WalletTransaction.create({
    patient:         patientId,
    type:            'credit',
    amount,
    description:     `Refund for cancelled appointment (${percentage}%) — credited to wallet`,
    balanceBefore:   wallet.balance - amount,
    balanceAfter:    wallet.balance,
    appointment:     id,
    transactionType: 'refund'
  });
}

      await Payment.findOneAndUpdate(
        { appointment: id },
        {
          status:       'refunded',
          refundAmount: amount,
          refundStatus: appointment.refundStatus,
          refundedAt:   appointment.refundedAt
        }
      );

      if (appointment.paymentMethod === 'wallet') {
        appointment.paymentStatus = amount === appointment.consultationFee ? 'refunded' : 'partially_refunded';
      } else {
        appointment.paymentStatus = amount === appointment.consultationFee ? 'refunded' : 'partially_refunded';
      }
    }

    await appointment.save();

// ── Notifications ──
try {
  const [docN, patN] = await Promise.all([
    Doctor.findById(appointment.doctor).select('name _id'),
    Promise.resolve({ _id: patientId, name: req.user.name })
  ]);
  if (docN) {
    await notifyAppointmentCancelled(appointment, docN, patN, 'patient');
    if (amount > 0) {
      await notifyRefundProcessed(patN, amount, appointment._id);
    }
  }
} catch (notifErr) {
  console.error('Notify error (non-fatal):', notifErr);
}

res.json({
  success: true,
  message: amount > 0
    ? `Appointment cancelled. ₹${amount} refund (${percentage}%) will be processed.`
    : 'Appointment cancelled. No refund applicable — less than 12 hours before appointment.',
  refundAmount: amount,
  refundPercentage: percentage
});
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel appointment' });
  }
};


export const getWallet = async (req, res) => {
  try {
    const patientId = req.user._id;
    const { type, page } = req.query;
    const limit   = 10;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip    = (pageNum - 1) * limit;

    let wallet = await Wallet.findOne({ patient: patientId });
    if (!wallet) wallet = await Wallet.create({ patient: patientId, balance: 0 });

    let query = { patient: patientId };
    if (type && type !== 'all') {
      if (type === 'credit' || type === 'debit') {
        query.type = type;
      } else {
        query.transactionType = type; 
      }
    }

    const [transactions, total, allTxns] = await Promise.all([
      WalletTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WalletTransaction.countDocuments(query),
      WalletTransaction.find({ patient: patientId }) 
    ]);

    const totalCredit = allTxns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const totalDebit  = allTxns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const creditCount = allTxns.filter(t => t.type === 'credit').length;
    const debitCount  = allTxns.filter(t => t.type === 'debit').length;

    res.render('patient/wallet', {
      title:        'My Wallet - Healora',
      user:          req.user,
      wallet,
      transactions,
      total,
      totalCredit,
      totalDebit,
      creditCount,
      debitCount,
      selectedType:  type || 'all',
      currentPage:   pageNum,
      totalPages:    Math.ceil(total / limit),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load wallet', user: req.user });
  }
};

export const createTopupOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 10 || amount > 50000) {
      return res.status(400).json({ success: false, error: 'Invalid amount. Must be between ₹10 and ₹50,000.' });
    }

    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `wp_${req.user._id.toString().slice(-8)}_${Date.now().toString().slice(-8)}`
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error('Create topup order error:', err);
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
};

export const verifyTopup = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const patientId = req.user._id;

    const body     = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    let wallet = await Wallet.findOne({ patient: patientId });
    if (!wallet) wallet = await Wallet.create({ patient: patientId, balance: 0 });

    const balanceBefore = wallet.balance;
    wallet.balance += Number(amount);
    await wallet.save();

    await WalletTransaction.create({
      patient:           patientId,
      type:              'credit',
      amount:            Number(amount),
      description:       `Wallet top-up via Razorpay`,
      balanceBefore,
      balanceAfter:      wallet.balance,
      razorpayPaymentId: razorpay_payment_id,
      transactionType:   'topup'
    });

    res.json({ success: true, newBalance: wallet.balance });
  } catch (err) {
    console.error('Verify topup error:', err);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
};

export const submitReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const patientId = req.user._id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment || appointment.patient.toString() !== patientId.toString()) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    if (appointment.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Can only rate completed appointments' });
    }

    await Review.findOneAndUpdate(
      { appointment: id },
      {
        patient: patientId,
        doctor:  appointment.doctor,
        appointment: id,
        rating:  Number(rating),
        review:  review || ''
      },
      { upsert: true, new: true }
    );

    appointment.hasReview = true;
    await appointment.save();

    const allReviews = await Review.find({ doctor: appointment.doctor });
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await Doctor.findByIdAndUpdate(appointment.doctor, {
      rating:      Math.round(avg * 10) / 10,
      ratingCount: allReviews.length
    });

    res.json({ success: true, message: 'Review submitted successfully' });

  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit review' });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const patientId = req.user._id;
    const { type, page } = req.query;
    const limit   = 10;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip    = (pageNum - 1) * limit;

    const Invoice = (await import('../models/invoice.model.js')).default;

    let query = { patient: patientId };
    if (type && type !== 'all') query.type = type;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate({
          path: 'appointment',
          populate: { path: 'doctor', select: 'name specialization department' }
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
      totalPages:   Math.ceil(total / limit),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load invoices', user: req.user });
  }
};

import Appointment       from '../models/appointment.model.js';
import Wallet            from '../models/wallet.model.js';
import WalletTransaction from '../models/wallettransaction.model.js';
import Payment           from '../models/payment.model.js';
import { sendAppointmentCancelledLeaveEmail } from './sendEmail.js';

export async function cancelAppointmentsForLeave(doctorId, date, halfDayPeriod = null) {
  const appointments = await Appointment.find({
    doctor: doctorId,
    date,
    status: { $in: ['pending', 'confirmed'] }
  })
  .populate('patient', 'name email')
  .populate('doctor', 'name');

  for (const appt of appointments) {
    if (halfDayPeriod) {
      const [h] = appt.timeSlot.split(':').map(Number);
      if (halfDayPeriod === 'morning'   && h >= 12) continue;
      if (halfDayPeriod === 'afternoon' && h < 14)  continue;
    }

    const isCash     = appt.paymentMethod === 'cash';
    const wasPaid    = appt.paymentStatus === 'paid';
    let   refundAmount = 0;

    if (!isCash && wasPaid) {
      refundAmount = appt.consultationFee;

      const wallet = await Wallet.findOneAndUpdate(
        { patient: appt.patient._id },
        { $inc: { balance: refundAmount } },
        { new: true, upsert: true }
      );

      await WalletTransaction.create({
        patient:         appt.patient._id,
        type:            'credit',
        amount:          refundAmount,
        description:     'Refund — appointment cancelled due to doctor leave',
        balanceBefore:   wallet.balance - refundAmount,
        balanceAfter:    wallet.balance,
        appointment:     appt._id,
        transactionType: 'refund'
      });

      await Payment.findOneAndUpdate(
        { appointment: appt._id },
        {
          status:       'refunded',
          refundAmount,
          refundStatus: 'processed',
          refundedAt:   new Date()
        }
      );

      appt.paymentStatus = 'refunded';
      appt.refundAmount  = refundAmount;
      appt.refundStatus  = 'processed';
      appt.refundedAt    = new Date();
    }

    appt.status             = 'cancelled';
    appt.cancelledBy        = 'admin';
    appt.cancellationReason = 'Doctor on approved leave';
    appt.cancelledAt        = new Date();
    await appt.save();

    if (appt.patient?.email) {
      sendAppointmentCancelledLeaveEmail(appt.patient.email, {
        patientName:   appt.patient.name,
        doctorName:    appt.doctor?.name || 'the doctor',
        date:          appt.date,
        timeSlot:      appt.timeSlot,
        refundAmount,
        paymentMethod: appt.paymentMethod
      }).catch(() => {});
    }
  }

  return appointments.length;
}
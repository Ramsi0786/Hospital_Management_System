import cron            from 'node-cron';
import LeaveRequest    from '../models/leaveRequest.model.js';
import SalaryDeduction from '../models/salaryDeduction.model.js';
import { DailyException } from '../models/doctoravailability.model.js';
import { sendLeaveAutoApprovedEmail } from '../utils/sendEmail.js';
import Notification    from '../models/notification.model.js';
import { cancelAppointmentsForLeave } from '../utils/cancelAppointments.js';

export const startAutoApproveJob = () => {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const now = new Date();

      const pendingEmergencies = await LeaveRequest.find({
        status:        'pending',
        isEmergency:   true,
        autoApproveAt: { $lte: now }
      }).populate('doctor', 'name email');

      if (pendingEmergencies.length === 0) return;

      console.log(`Auto-approve job: found ${pendingEmergencies.length} emergency leave(s) to process`);

      for (const leave of pendingEmergencies) {
        try {
          leave.status      = 'auto_approved';
          leave.respondedAt = now;
          await leave.save();

          await DailyException.findOneAndUpdate(
            { doctor: leave.doctor._id, date: leave.date },
            {
              doctor:    leave.doctor._id,
              date:      leave.date,
              isWorking: false,
              slots:     [],
              reason:    `Auto-approved emergency leave — ${leave.reason}`
            },
            { upsert: true, new: true }
          );

          await cancelAppointmentsForLeave(
            leave.doctor._id,
            leave.date,
            leave.halfDayPeriod
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
              description:   `Auto-approved emergency leave on ${leave.date}`,
              status:        'pending'
            });
          }

          sendLeaveAutoApprovedEmail(leave.doctor.email, {
            doctorName:            leave.doctor.name,
            date:                  leave.date,
            salaryDeductionAmount: leave.salaryDeductionAmount,
            withinAllowance:       leave.withinAllowance
          }).catch(() => {});

          Notification.create({
            recipient:     leave.doctor._id,
            recipientType: 'doctor',
            type:          'appointment_confirmed',
            title:         'Emergency Leave Auto-Approved',
            message:       `Your emergency leave for ${leave.date} was auto-approved after 2 hours.${leave.salaryDeductionAmount > 0 ? ` Deduction of ₹${leave.salaryDeductionAmount} pending admin confirmation.` : ''}`,
            link:          '/doctor/availability',
            isRead:        false
          }).catch(() => {});

          console.log(`✓ Auto-approved: Dr. ${leave.doctor.name} — ${leave.date}`);

        } catch (innerErr) {
          console.error(`✗ Failed to auto-approve leave ${leave._id}:`, innerErr.message);
        }
      }
    } catch (err) {
      console.error('Auto-approve cron job error:', err);
    }
  });

  console.log('✓ Auto-approve leave job started — runs every 30 minutes');
};
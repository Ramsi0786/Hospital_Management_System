import Notification from '../models/notification.model.js';

export const notify = async ({ recipient, recipientType, type, title, message, link = '' }) => {
  try {
    await Notification.create({ recipient, recipientType, type, title, message, link });
  } catch (err) {
    console.error('Notification create error (non-fatal):', err.message);
  }
};

// ── Preset notification builders ──────────────────────────

export const notifyAppointmentBooked = async (appointment, doctor, patient) => {
  const dateStr = new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
  const [h, m] = appointment.timeSlot.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const time   = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;

  await notify({
    recipient:     doctor._id,
    recipientType: 'doctor',
    type:          'appointment_booked',
    title:         'New Appointment',
    message:       `${patient.name} booked an appointment on ${dateStr} at ${time}`,
    link:          `/doctor/appointments`
  });

  await notify({
    recipient:     patient._id,
    recipientType: 'patient',
    type:          'appointment_booked',
    title:         'Appointment Booked',
    message:       `Your appointment with Dr. ${doctor.name} on ${dateStr} at ${time} is confirmed`,
    link:          `/patient/appointments/${appointment._id}`
  });
};

export const notifyAppointmentCancelled = async (appointment, doctor, patient, cancelledBy) => {
  const dateStr = new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  await notify({
    recipient:     patient._id,
    recipientType: 'patient',
    type:          'appointment_cancelled',
    title:         'Appointment Cancelled',
    message:       cancelledBy === 'patient'
      ? `Your appointment with Dr. ${doctor.name} on ${dateStr} has been cancelled`
      : `Your appointment with Dr. ${doctor.name} on ${dateStr} was cancelled by ${cancelledBy}`,
    link: `/patient/appointments`
  });

  if (cancelledBy !== 'doctor') {
    await notify({
      recipient:     doctor._id,
      recipientType: 'doctor',
      type:          'appointment_cancelled',
      title:         'Appointment Cancelled',
      message:       `Appointment with ${patient.name} on ${dateStr} has been cancelled`,
      link:          `/doctor/appointments`
    });
  }
};

export const notifyRefundProcessed = async (patient, amount, appointmentId) => {
  await notify({
    recipient:     patient._id,
    recipientType: 'patient',
    type:          'refund_processed',
    title:         'Refund Credited',
    message:       `₹${amount} has been credited to your Healora Wallet`,
    link:          `/patient/wallet`
  });
};

export const notifyAppointmentStatusChanged = async (appointment, doctor, patient, newStatus) => {
  const dateStr = new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  await notify({
    recipient:     patient._id,
    recipientType: 'patient',
    type:          'appointment_confirmed',
    title:         `Appointment ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
    message:       `Your appointment with Dr. ${doctor.name} on ${dateStr} is now ${newStatus}`,
    link:          `/patient/appointments/${appointment._id}`
  });
};
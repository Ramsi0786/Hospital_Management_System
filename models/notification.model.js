import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient:     { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientType: {
    type: String,
    enum: ['patient', 'doctor', 'admin'], 
    required: true
  },
  type: {
    type: String,
    enum: [

      'appointment_booked',
      'appointment_confirmed',
      'appointment_cancelled',
      'appointment_completed',
      'refund_processed',
      'appointment_reminder',
      'leave_emergency',
      'leave_request',
      'salary_deduction'
    ],
    required: true
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  link:    { type: String, default: '' },
  isRead:  { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
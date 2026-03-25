import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  date:          { type: String, required: true }, 
  type:          { type: String, enum: ['full', 'half', 'emergency'], required: true },
  halfDayPeriod: { type: String, enum: ['morning', 'afternoon', null], default: null },
  reason:        { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'auto_approved'],
    default: 'pending'
  },
  isEmergency:   { type: Boolean, default: false },
  autoApproveAt: { type: Date, default: null }, 

  adminNote:    { type: String, default: '' },
  respondedAt:  { type: Date, default: null },

  affectedAppointmentsCount:  { type: Number, default: 0 },
  estimatedConsultationLoss:  { type: Number, default: 0 }, 

  withinAllowance:       { type: Boolean, default: true },
  salaryDeductionAmount: { type: Number, default: 0 }, 
  salaryDeductionType: {
    type: String,
    enum: ['none', 'normal_excess', 'emergency_tier1', 'emergency_tier2', 'emergency_tier3'],
    default: 'none'
  },

  appointmentsCancelled: { type: Boolean, default: false },
  requestedAt:           { type: Date, default: Date.now }
}, { timestamps: true });

leaveRequestSchema.index({ doctor: 1, date: 1 }, { unique: true });
leaveRequestSchema.index({ status: 1, isEmergency: 1 });
leaveRequestSchema.index({ autoApproveAt: 1 });

export default mongoose.model('LeaveRequest', leaveRequestSchema);
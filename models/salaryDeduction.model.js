import mongoose from 'mongoose';

const salaryDeductionSchema = new mongoose.Schema({
  doctor:        { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  leaveRequest:  { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', required: true },
  month:         { type: Number, required: true },
  year:          { type: Number, required: true },
  amount:        { type: Number, required: true },
  deductionType: {
    type: String,
    enum: ['normal_excess', 'emergency_tier1', 'emergency_tier2', 'emergency_tier3'],
    required: true
  },
  description:   { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'processed', 'waived'],
    default: 'pending'
  },
  adminNote:    { type: String, default: '' },
  confirmedAt:  { type: Date, default: null }
}, { timestamps: true });

salaryDeductionSchema.index({ doctor: 1, month: 1, year: 1 });

export default mongoose.model('SalaryDeduction', salaryDeductionSchema);
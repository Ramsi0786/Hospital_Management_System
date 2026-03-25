import mongoose from 'mongoose';

const doctorSalarySchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    unique: true
  },
  monthlySalary:          { type: Number, required: true, default: 0 },
  workingDaysPerMonth:    { type: Number, default: 26 },

  normalLeaveAllowance:   { type: Number, default: 2 }, 
  halfDayAllowance:       { type: Number, default: 4 }, 
  emergencyFreeCount:     { type: Number, default: 1 },

  emergencyTier1: { type: Number, default: 5  }, 
  emergencyTier2: { type: Number, default: 15 }, 
  emergencyTier3: { type: Number, default: 25 }, 
}, { timestamps: true });

export default mongoose.model('DoctorSalary', doctorSalarySchema);
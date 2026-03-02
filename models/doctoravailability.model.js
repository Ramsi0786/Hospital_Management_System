import mongoose from 'mongoose';

const dayScheduleSchema = new mongoose.Schema({
  isWorking: { type: Boolean, default: false },
  slots: [{ type: String }]  
}, { _id: false });

const weeklyAvailabilitySchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    unique: true   
  },
  schedule: {
    monday:    { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    tuesday:   { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    wednesday: { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    thursday:  { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    friday:    { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    saturday:  { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    sunday:    { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
  },
  slotDuration: {
    type: Number,
    default: 30  
  }
}, { timestamps: true });

const monthlyAvailabilitySchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  month: { type: Number, required: true }, 
  year:  { type: Number, required: true },
  schedule: {
    monday:    { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    tuesday:   { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    wednesday: { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    thursday:  { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    friday:    { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    saturday:  { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
    sunday:    { type: dayScheduleSchema, default: () => ({ isWorking: false, slots: [] }) },
  }
}, { timestamps: true });

monthlyAvailabilitySchema.index({ doctor: 1, month: 1, year: 1 }, { unique: true });

const dailyExceptionSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  date: {
    type: String,   
    required: true
  },
  isWorking: {
    type: Boolean,
    default: false 
  },
  slots: [{ type: String }],  
  reason: {
    type: String,
    default: ''
  }
}, { timestamps: true });

dailyExceptionSchema.index({ doctor: 1, date: 1 }, { unique: true });

export const WeeklyAvailability  = mongoose.model('WeeklyAvailability',  weeklyAvailabilitySchema);
export const MonthlyAvailability = mongoose.model('MonthlyAvailability', monthlyAvailabilitySchema);
export const DailyException      = mongoose.model('DailyException',      dailyExceptionSchema);
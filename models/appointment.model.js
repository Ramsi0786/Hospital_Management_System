import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  department: {
    type: String,
    default: ''
  },

  date: {
    type: String,         
    required: true
  },
  timeSlot: {
    type: String,  
    required: true
  },
  reason: {
    type: String,
    default: ''
  },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'razorpay', 'wallet'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'partially_refunded', 'failed'],
    default: 'pending'
  },
  consultationFee: {
    type: Number,
    required: true
  },

  razorpayOrderId:   { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },

  cancelledBy: {
    type: String,
    enum: ['patient', 'doctor', 'admin', null],
    default: null
  },
  cancellationReason: { type: String, default: '' },
  cancelledAt:        { type: Date, default: null },

  rejectionReason: { type: String, default: '' },

  refundAmount:     { type: Number, default: 0 },
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'processed', 'failed'],
    default: 'none'
  },
  refundPercentage: { type: Number, default: 0 },
  refundedAt:       { type: Date, default: null },

  hasReview: { type: Boolean, default: false },

}, { timestamps: true });

appointmentSchema.index({ doctor: 1, date: 1, timeSlot: 1 });
appointmentSchema.index({ patient: 1, status: 1 });

export default mongoose.model('Appointment', appointmentSchema);
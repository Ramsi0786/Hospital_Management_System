import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['cash', 'razorpay', 'wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },

  razorpayOrderId:   { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },

  refundId:     { type: String, default: null },
  refundAmount: { type: Number, default: 0 },
  refundStatus: {
    type: String,
    enum: ['none', 'processing', 'completed'],
    default: 'none'
  },
  refundedAt: { type: Date, default: null },

}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
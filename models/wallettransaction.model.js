import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },

  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },

  razorpayPaymentId: {
    type: String,
    default: null
  },

  transactionType: {
    type: String,
    enum: [
      'booking',        
      'refund',         
      'topup',         
      'withdrawal'      
    ],
    required: true
  }

}, { timestamps: true });

walletTransactionSchema.index({ patient: 1, createdAt: -1 });

export default mongoose.model('WalletTransaction', walletTransactionSchema);
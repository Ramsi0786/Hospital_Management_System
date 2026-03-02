import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
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
  invoiceNumber: {
    type: String,
    required: true,
    unique: true  
  },
  type: {
    type: String,
    enum: ['booking', 'refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  pdfUrl: {
    type: String,
    default: null  
  },
  pdfGeneratedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

invoiceSchema.statics.generateInvoiceNumber = async function(type) {
  const prefix = type === 'booking' ? 'INV' : 'REF';
  const year = new Date().getFullYear();
  const count = await this.countDocuments({ type });
  const number = String(count + 1).padStart(6, '0');
  return `${prefix}-${year}-${number}`;
};

export default mongoose.model('Invoice', invoiceSchema);
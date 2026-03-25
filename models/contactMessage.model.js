import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, trim: true },
  phone:     { type: String, default: '', trim: true },
  subject:   { type: String, required: true, trim: true },
  message:   { type: String, required: true, trim: true },
  isRead:    { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('ContactMessage', contactMessageSchema);
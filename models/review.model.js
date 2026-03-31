import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctor:      { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor',  required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  rating:      { type: Number, required: true, min: 1, max: 5 },
  review:      { type: String, default: '', maxlength: 500 }
}, { timestamps: true });

export default mongoose.model('Review', reviewSchema);
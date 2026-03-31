import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    unique: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  diagnosis:       { type: String, default: '' },
  notes:           { type: String, default: '' },
  medicines:       { type: String, default: '' },
  followUpDate:    { type: String, default: '' },
  fileUrl:         { type: String, default: '' },
  fileType:        { type: String, default: '' },
  publicId:        { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Prescription', prescriptionSchema);
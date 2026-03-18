import mongoose from 'mongoose';

const medicalRecordSchema = new mongoose.Schema({
  patient:   { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  type:      { type: String, enum: ['prescription', 'lab', 'document'], required: true },
  title:     { type: String, required: true, trim: true, maxlength: 100 },
  notes:     { type: String, default: '', maxlength: 500 },
  fileUrl:   { type: String, required: true },
  fileType:  { type: String, enum: ['pdf', 'image'], required: true },
  publicId:  { type: String, required: true },
  recordDate:{ type: String, required: true }
}, { timestamps: true });

export default mongoose.model('MedicalRecord', medicalRecordSchema);
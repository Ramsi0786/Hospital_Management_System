import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    dateOfBirth: {
    type: Date,
    default: null
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', ''],
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  emergencyContactName: {
    type: String,
    default: ''
  },
  emergencyContactPhone: {
    type: String,
    default: ''
  },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    phone: { type: String },
    password: { type: String },
    age: { type: Number, default: null },
    gender: { type: String, enum: ["Male", "Female", "Other"], default: null },
    profileImage: { type: String, default: '' },  
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: { type: String },
    isVerified: { type: Boolean, default: false },
    needsPasswordSetup: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    deactivatedAt: { type: Date },
    blockedReason: { type: String },
    blockedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
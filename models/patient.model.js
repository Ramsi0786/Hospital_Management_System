const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  phone: { type: String },
  password: { type: String }, 
  googleId: { type: String },
}, { timestamps: true });

// ← Remove the entire pre-save hook

module.exports = mongoose.model("Patient", patientSchema);
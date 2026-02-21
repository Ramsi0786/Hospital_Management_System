import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Patient', 'Doctor', 'Admin']
  },
  family: {
    type: String,
    required: true,
    index: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800   
  }
});

export default mongoose.model('RefreshToken', refreshTokenSchema);
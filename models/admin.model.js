import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      lowercase: true
    },
    password: { 
      type: String, 
      required: true 
    },
    role: {
      type: String,
      enum: ['admin', 'super_admin'],
      default: 'admin'
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active'
    },
    permissions: {
      canManagePatients: { type: Boolean, default: true },
      canManageDoctors: { type: Boolean, default: true },
      canManageDepartments: { type: Boolean, default: true },
      canManageAdmins: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: true }
    },
    lastLogin: { 
      type: Date 
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  { 
    timestamps: true 
  }
);

adminSchema.index({ email: 1 });
adminSchema.index({ status: 1 });

export default mongoose.model("Admin", adminSchema);
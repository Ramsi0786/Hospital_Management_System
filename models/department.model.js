import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      unique: true,
      minlength: [3, 'Department name must be at least 3 characters'],
      maxlength: [50, 'Department name must not exceed 50 characters']
    },
    description: {
      type: String,
      required: [true, 'Department description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description must not exceed 500 characters']
    },
    icon: {
      type: String,
      default: 'fa-hospital', 
      trim: true
    },
    departmentHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    deletedReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

departmentSchema.index({ name: 1 });
departmentSchema.index({ isActive: 1, isDeleted: 1 });
departmentSchema.index({ deletedAt: 1 });
departmentSchema.query.active = function() {
  return this.where({ isDeleted: false });
};

departmentSchema.query.deleted = function() {
  return this.where({ isDeleted: true });
};

departmentSchema.virtual('doctorCount', {
  ref: 'Doctor',
  localField: 'name',
  foreignField: 'department',
  count: true
});

departmentSchema.pre('save', function(next) {
  if (this.isModified('isDeleted') && this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  next();
});

const Department = mongoose.model('Department', departmentSchema);

export default Department;
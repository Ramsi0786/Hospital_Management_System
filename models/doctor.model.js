import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    specialization: { type: String, required: true },
    department: { type: String, required: true },
    
    bio: { type: String, default: '' },
    qualification: { type: String, default: '' },
    experience: { type: Number, default: 0 }, 
    consultationFee: { type: Number, default: 0 },
    profileImage: { type: String, default: '' }, 
    rating: { type: Number, default: 0, min: 0, max: 5 },
    
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }, 
    
    availability: { 
        type: [{
            day: String, 
            slots: [String] 
        }], 
        default: [] 
    },
    
    role: { type: String, default: "doctor" }
}, { timestamps: true });

export default mongoose.model('Doctor', doctorSchema);

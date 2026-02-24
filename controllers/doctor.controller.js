
import Doctor from '../models/doctor.model.js';

export const getDashboard = (req, res) => {
  res.render("doctor/dashboard", {
    title: `Dr. ${req.user.name}'s Dashboard - Healora`,
    currentPage: 'dashboard'
  });
};

export const updateDoctorProfile = async (req, res) => {
  try {
    const userId = req.user?._id; 
    const { 
      name, 
      phone, 
      specialization,
      bio, 
      qualification, 
      experience, 
      consultationFee 
    } = req.body;

     if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const errors = {};

    if (!name || typeof name !== 'string') {
      errors.name = 'Name is required';
    } else {
      const trimmedName = name.trim();
      
      if (trimmedName.length < 3) {
        errors.name = 'Name must be at least 3 characters';
      } else if (trimmedName.length > 100) {
        errors.name = 'Name must be less than 100 characters';
      } else if (!/^[a-zA-Z\s.]+$/.test(trimmedName)) {
        errors.name = 'Name can only contain letters, spaces, and dots';
      }
    }

    if (!phone || typeof phone !== 'string') {
      errors.phone = 'Phone is required';
    } else {
      const trimmedPhone = phone.trim();
      
      if (!/^[0-9]{10}$/.test(trimmedPhone)) {
        errors.phone = 'Phone must be exactly 10 digits';
      }
    }

   if (!specialization || typeof specialization !== 'string') {
      errors.specialization = 'Specialization is required';
    } else {
      const trimmed = specialization.trim();
      
      if (trimmed.length < 3) {
        errors.specialization = 'Specialization must be at least 3 characters';
      } else if (trimmed.length > 100) {
        errors.specialization = 'Specialization must be less than 100 characters';
      }
    }

    if (qualification) {
      const trimmed = qualification.trim();
      
      if (trimmed.length > 200) {
        errors.qualification = 'Qualification must be less than 200 characters';
      }
    }

    if (experience !== null && experience !== undefined && experience !== '') {
      const exp = Number(experience);
      
      if (isNaN(exp)) {
        errors.experience = 'Experience must be a number';
      } else if (exp < 0) {
        errors.experience = 'Experience cannot be negative';
      } else if (exp > 70) {
        errors.experience = 'Experience cannot exceed 70 years';
      }
    }

    if (consultationFee !== null && consultationFee !== undefined && consultationFee !== '') {
      const fee = Number(consultationFee);
      
      if (isNaN(fee)) {
        errors.consultationFee = 'Consultation fee must be a number';
      } else if (fee < 0) {
        errors.consultationFee = 'Consultation fee cannot be negative';
      } else if (fee > 50000) {
        errors.consultationFee = 'Consultation fee cannot exceed ₹50,000';
      }
    }

    if (bio) {
      const trimmed = bio.trim();
      
      if (trimmed.length > 1000) {
        errors.bio = 'Bio must be less than 1000 characters';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors
      });
    }

    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
      specialization: specialization.trim(),
      qualification: qualification ? qualification.trim() : '',
      experience: experience ? Number(experience) : 0,
      consultationFee: consultationFee ? Number(consultationFee) : 500,
      bio: bio ? bio.trim() : ''
    };

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password');

    if (!updatedDoctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      doctor: updatedDoctor
    });

  } catch (error) {
    console.error('Update doctor profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile. Please try again later.' 
    });
  }
};
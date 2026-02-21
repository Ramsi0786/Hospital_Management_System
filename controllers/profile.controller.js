import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import { HTTP_STATUS } from '../constants/index.js';

export const updatePatientProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, phone, age, gender } = req.body;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!name || name.trim().length < 3) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Name must be at least 3 characters'
      });
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Phone must be 10 digits'
      });
    }

    if (age && (age < 1 || age > 120)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Age must be between 1 and 120'
      });
    }

    const updateData = {
      name: name.trim(),
      phone: phone || null,
      age: age || null,
      gender: gender || null
    };

    const updatedPatient = await Patient.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Patient not found'
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile updated successfully',
      patient: updatedPatient
    });

  } catch (error) {
    console.error('Update patient profile error:', error);
    return res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

export const updateDoctorProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { 
      name, 
      phone, 
      bio, 
      qualification, 
      experience, 
      consultationFee,
      specialization,
      department
    } = req.body;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!name || name.trim().length < 3) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Name must be at least 3 characters'
      });
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Phone must be 10 digits'
      });
    }

    if (experience && (experience < 0 || experience > 70)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Experience must be between 0 and 70 years'
      });
    }

    if (consultationFee && (consultationFee < 0 || consultationFee > 50000)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Consultation fee must be between 0 and 50000'
      });
    }

    const updateData = {
      name: name.trim(),
      phone: phone || '',
      bio: bio || '',
      qualification: qualification || '',
      experience: experience || 0,
      consultationFee: consultationFee || 500,
      specialization: specialization || '',
      department: department || ''
    };

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDoctor) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile updated successfully',
      doctor: updatedDoctor
    });

  } catch (error) {
    console.error('Update doctor profile error:', error);
    return res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};
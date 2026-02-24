import Doctor from "../models/doctor.model.js";
import Patient from '../models/patient.model.js';
import Department from "../models/department.model.js";
import { sanitizePagination, PAGINATION } from '../constants/index.js';


export const getDashboard = (req, res) => {
  res.render("patient/dashboard", {
    user: req.user,
    title: `${req.user.name}'s Dashboard - Healora`,
    showPasswordSetupBanner: req.session.showPasswordSetupBanner || false
  });
  delete req.session.showPasswordSetupBanner;
};

export const getAllDoctors = async (req, res) => {
  try {
    const { department, search, sort, page } = req.query; 
    const { page: pageNum, skip } = sanitizePagination(page, PAGINATION.DOCTORS_PER_PAGE);
    const limitNum = PAGINATION.DOCTORS_PER_PAGE;

    let query = { status: 'active' };

    if (department && department !== 'all') {
      query.department = department;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOption = { isFeatured: -1, rating: -1 };
    if (sort === 'fee-low') sortOption = { consultationFee: 1 };
    if (sort === 'fee-high') sortOption = { consultationFee: -1 };
    if (sort === 'experience') sortOption = { experience: -1 };
    if (sort === 'rating') sortOption = { rating: -1 };

    const total = await Doctor.countDocuments(query);

    const doctors = await Doctor.find(query)
      .select('name email specialization department bio qualification experience consultationFee profileImage rating isFeatured')
      .sort(sortOption)
      .limit(limitNum)
      .skip(skip);

    const departments = await Department.find({ isActive: true, isDeleted: false })
      .select('name icon');

    res.render('patient/doctors-list', {
      title: 'Our Doctors - Healora',
      user: req.user,
      doctors,
      departments,
      selectedDepartment: department || 'all',
      searchQuery: search || '',
      sortBy: sort || 'featured',
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      total
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load doctors'
    });
  }
};


export const getDoctorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const doctor = await Doctor.findById(id)
      .select('-password');
    
    if (!doctor || doctor.status !== 'active') {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Doctor not found',
        user: req.user
      });
    }
    
    res.render('patient/doctor-profile', {
      title: `Dr. ${doctor.name} - Healora`,
      user: req.user,
      doctor
    });
  } catch (error) {
    console.error('Get doctor details error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load doctor profile',
      user: req.user
    });
  }
};

export const updatePatientProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { 
      name, 
      phone, 
      dateOfBirth, 
      gender, 
      bloodGroup, 
      address, 
      emergencyContactName, 
      emergencyContactPhone 
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!name || name.trim().length < 3) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name must be at least 3 characters' 
      });
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone must be 10 digits' 
      });
    }

    if (emergencyContactPhone && !/^[0-9]{10}$/.test(emergencyContactPhone)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Emergency contact phone must be 10 digits' 
      });
    }

    let calculatedAge = null;
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
    }

    const updateData = {
      name: name.trim(),
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      age: calculatedAge,
      gender: gender || null,
      bloodGroup: bloodGroup || null,
      address: address?.trim() || null,
      emergencyContactName: emergencyContactName?.trim() || null,
      emergencyContactPhone: emergencyContactPhone || null
    };

    const updatedPatient = await Patient.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      patient: updatedPatient
    });

  } catch (error) {
    console.error('Update patient profile error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    });
  }
};
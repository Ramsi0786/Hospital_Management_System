import Doctor from "../models/doctor.model.js";
import Department from "../models/department.model.js";


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
    const { department, search, sort } = req.query;
    
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
    
    const doctors = await Doctor.find(query)
      .select('name email specialization department bio qualification experience consultationFee profileImage rating isFeatured')
      .sort(sortOption);
    
    const departments = await Department.find({ isActive: true, isDeleted: false })
      .select('name icon');
    
    res.render('patient/doctors-list', {
      title: 'Our Doctors - Healora',
      user: req.user,
      doctors,
      departments,
      selectedDepartment: department || 'all',
      searchQuery: search || '',
      sortBy: sort || 'featured'
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

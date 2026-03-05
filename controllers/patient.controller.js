import Doctor from "../models/doctor.model.js";
import Patient from '../models/patient.model.js';
import Department from "../models/department.model.js";
import Appointment from "../models/appointment.model.js";
import { sanitizePagination, PAGINATION } from '../constants/index.js';
import { resolveSlots } from '../controllers/availability.controller.js';
import Invoice from '../models/invoice.model.js';


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
    if (sort === 'fee-low')    sortOption = { consultationFee: 1 };
    if (sort === 'fee-high')   sortOption = { consultationFee: -1 };
    if (sort === 'experience') sortOption = { experience: -1 };
    if (sort === 'rating')     sortOption = { rating: -1 };

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
    res.status(500).render('error', { title: 'Error', message: 'Failed to load doctors' });
  }
};

export const getDoctorDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findById(id).select('-password');

    if (!doctor || doctor.status !== 'active') {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Doctor not found',
        user: req.user
      });
    }

    const today = new Date();
    const now   = new Date();

    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const resolvedAll = await Promise.all(
      dates.map(dateStr => resolveSlots(id, dateStr).catch(() => null))
    );

    const startDate = dates[0];
    const endDate   = dates[dates.length - 1];

    const allBooked = await Appointment.find({
      doctor: id,
      date:   { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed'] }
    }).select('date timeSlot');

    const bookedByDate = {};
    for (const appt of allBooked) {
      if (!bookedByDate[appt.date]) bookedByDate[appt.date] = new Set();
      bookedByDate[appt.date].add(appt.timeSlot);
    }

    const slotCalendar = dates.map((dateStr, i) => {
      const d        = new Date(today);
      d.setDate(today.getDate() + i);
      const resolved = resolvedAll[i];

      let available = [];
      let reason    = 'Doctor not available on this day';

      if (resolved?.isWorking && resolved.slots?.length > 0) {
        const bookedSet = bookedByDate[dateStr] || new Set();

        available = resolved.slots.filter(s => {
          if (bookedSet.has(s)) return false;
          if (i === 0) {
            const [hour, min] = s.split(':').map(Number);
            const slotTime = new Date();
            slotTime.setHours(hour, min, 0, 0);
            return (slotTime - now) > 60 * 60 * 1000;
          }
          return true;
        });

        if (available.length === 0) {
          reason = i === 0 ? 'No more bookable slots for today' : 'All slots fully booked';
        } else {
          reason = null;
        }
      }

      return {
        date:          dateStr,
        display:       d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayName:       d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum:        d.getDate(),
        month:         d.toLocaleDateString('en-US', { month: 'short' }),
        slots:         available,
        totalSlots:    resolved?.slots?.length || 0,
        isToday:       i === 0,
        noSlotsReason: reason
      };
    });

    res.render('patient/doctor-profile', {
      title:       `Dr. ${doctor.name} - Healora`,
      user:        req.user,
      doctor,
      slotCalendar
    });

  } catch (error) {
    console.error('Get doctor details error:', error);
    res.status(500).render('error', {
      title:   'Error',
      message: 'Failed to load doctor profile',
      user:    req.user
    });
  }
};

export const getDoctorSlots = async (req, res) => {
  try {
    const { id }   = req.params;
    const { date } = req.query;

    if (!date) return res.status(400).json({ success: false, error: 'Date required' });

    const resolved = await resolveSlots(id, date);

    if (!resolved.isWorking) {
      return res.json({ success: true, slots: [], isWorking: false });
    }

    const booked = await Appointment.find({
      doctor: id,
      date,
      status: { $in: ['pending', 'confirmed'] }
    }).select('timeSlot');

    const bookedSlots = booked.map(a => a.timeSlot);
    const available   = resolved.slots.filter(s => !bookedSlots.includes(s));

    res.json({ success: true, slots: available, isWorking: true, bookedSlots });
  } catch (error) {
    console.error('Get doctor slots error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch slots' });
  }
};

export const updatePatientProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      name, phone, dateOfBirth, gender, bloodGroup,
      address, emergencyContactName, emergencyContactPhone
    } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!name || name.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Name must be at least 3 characters' });
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ success: false, error: 'Phone must be 10 digits' });
    }

    if (emergencyContactPhone && !/^[0-9]{10}$/.test(emergencyContactPhone)) {
      return res.status(400).json({ success: false, error: 'Emergency contact phone must be 10 digits' });
    }

    let calculatedAge = null;
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today     = new Date();
      calculatedAge   = today.getFullYear() - birthDate.getFullYear();
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
      userId, updateData, { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      patient: updatedPatient
    });
  } catch (error) {
    console.error('Update patient profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
};

export const getAppointments = async (req, res) => {
  try {
    const { status, page } = req.query;
    const { page: pageNum, skip } = sanitizePagination(page, 10);

    let query = { patient: req.user._id };
    if (status && status !== 'all') query.status = status;

    const total = await Appointment.countDocuments(query);

    const appointments = await Appointment.find(query)
      .populate('doctor', 'name specialization department profileImage consultationFee')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(10);

    res.render('patient/appointments', {
      title:        'My Appointments - Healora',
      user:          req.user,
      appointments,
      selectedStatus: status || 'all',
      currentPage:   pageNum,
      totalPages:    Math.ceil(total / 10),
      total
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load appointments', user: req.user });
  }
};

export const getAppointmentDetail = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'name specialization department profileImage consultationFee phone email');

    if (!appointment || appointment.patient.toString() !== req.user._id.toString()) {
      return res.redirect('/patient/appointments');
    }

    res.render('patient/appointment-detail', {
      title: 'Appointment Details - Healora',
      user:   req.user,
      appointment
    });
  } catch (error) {
    console.error('Get appointment detail error:', error);
    res.redirect('/patient/appointments');
  }
};


export const getInvoices = async (req, res) => {
  try {
    const { type, page } = req.query;
    const limit   = 10;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip    = (pageNum - 1) * limit;

    let query = { patient: req.user._id };
    if (type && type !== 'all') query.type = type;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate({
          path: 'appointment',
          populate: { path: 'doctor', select: 'name specialization department profileImage' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query)
    ]);

    res.render('patient/invoices', {
      title:       'My Invoices - Healora',
      user:         req.user,
      invoices,
      total,
      selectedType: type || 'all',
      currentPage:  pageNum,
      totalPages:   Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load invoices', user: req.user });
  }
};
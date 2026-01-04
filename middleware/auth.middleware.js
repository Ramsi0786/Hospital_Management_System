import jwt from 'jsonwebtoken';
import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';

const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

// Patient Protection
const protect = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/patient/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const patient = await Patient.findById(decoded.id).select('-password');
    
    if (!patient) {
      res.clearCookie('token');
      return res.redirect('/patient/login');
    }

    if (patient.isBlocked) {
      res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Account Blocked',
        message: 'Your account has been blocked. Please contact support.',
        reason: patient.blockedReason || 'Account violation'
      });
    }

    if (!patient.isActive) {
      res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Account Inactive',
        message: 'Your account has been deactivated. Please sign up again to create a new account.'
      });
    }

    req.user = patient;
    next();
  } catch (error) {
    console.error('Patient auth error:', error);
    res.clearCookie('token');
    return res.redirect('/patient/login');
  }
};

// Doctor Protection
const protectDoctor = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/doctor/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'doctor') {
      res.clearCookie('token');
      return res.redirect('/doctor/login');
    }

    const doctor = await Doctor.findById(decoded.id).select('-password');
    
    if (!doctor) {
      res.clearCookie('token');
      return res.redirect('/doctor/login');
    }

    if (doctor.isBlocked) {
      res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Account Blocked',
        message: 'Your account has been blocked. Please contact admin.',
        reason: doctor.blockedReason || 'Account violation'
      });
    }

    if (!doctor.isActive) {
      res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Account Inactive',
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }

    req.user = doctor;
    next();
  } catch (error) {
    console.error('Doctor auth error:', error);
    res.clearCookie('token');
    return res.redirect('/doctor/login');
  }
};

const checkAuth = (req, res, next) => {
  if (req.cookies.token) {
    try {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      
      if (decoded.role === 'doctor') {
        return res.redirect('/doctor/dashboard');
      }
      return res.redirect('/patient/dashboard');
    } catch (error) {
      res.clearCookie('token');
    }
  }
  next();
};

export { protect, protectDoctor, checkAuth };

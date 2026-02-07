import jwt from 'jsonwebtoken';
import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import Admin from '../models/admin.model.js';

const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

// ============= PATIENT MIDDLEWARE =============
const protect = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/patient/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role && decoded.role !== 'patient') {
       res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        redirectUrl: '/patient/login',
        redirectText: 'Go to Patient Login'
      });
    }

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
    res.clearCookie('token');
    return res.redirect('/patient/login');
  }
};

// ============= DOCTOR MIDDLEWARE =============
const protectDoctor = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/doctor/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.role || decoded.role !== 'doctor') {
      res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        redirectUrl: '/doctor/login',
        redirectText: 'Go to Doctor Login'
      });
    }

    const doctor = await Doctor.findById(decoded.id).select('-password');
    
    if (!doctor) {
      res.clearCookie('token');
      return res.redirect('/doctor/login');
    }

    if (doctor.status === 'blocked') {
      res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Account Blocked',
        message: 'Your account has been blocked. Please contact the administrator.',
        reason: 'Account violation'
      });
    }

    if (doctor.status === 'inactive') {
      res.clearCookie('token');
      return res.status(403).render('error', {
        title: 'Account Inactive',
        message: 'Your account is inactive. Please contact the administrator.'
      });
    }

    req.user = doctor;
    req.user.role = 'doctor';
    next();
  } catch (error) {
    res.clearCookie('token');
    return res.redirect('/doctor/login');
  }
};


// ============= ADMIN MIDDLEWARE =============
const protectAdmin = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    
    const token = req.cookies.adminToken;
    
    if (!token) {
      return res.redirect('/admin/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.role || decoded.role !== 'admin') {
      res.clearCookie('adminToken');
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        redirectUrl: '/admin/login',
        redirectText: 'Go to Admin Login'
      });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) {
      res.clearCookie('adminToken');
      return res.redirect('/admin/login');
    }

    if (admin.status === 'blocked' || !admin.isActive) {
      res.clearCookie('adminToken');
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'Your admin account is no longer active.'
      });
    }

    req.user = admin;
    req.user.role = 'admin';
    next();
  } catch (error) {
    console.error('[Admin Protect] Error:', error.message);
    res.clearCookie('adminToken');
    return res.redirect('/admin/login');
  }
};


// ============= CHECK AUTH (for login pages) =============
const checkAuth = (req, res, next) => {
  const token = req.cookies.token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
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

const checkAdminAuth = (req, res, next) => {
  const token = req.cookies.adminToken;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        return res.redirect('/admin/dashboard');
      }
    } catch (error) {
      res.clearCookie('adminToken');
    }
  }
  
  next();
};

export { protect, protectDoctor, protectAdmin, checkAuth, checkAdminAuth };
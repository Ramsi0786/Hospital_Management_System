import { verifyAccessToken, verifyRefreshToken, generateAccessToken } from '../config/jwt.js';
import RefreshToken from '../models/refreshToken.model.js';
import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import jwt from 'jsonwebtoken';

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
    
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    
    if (req.user && req.user._id) {
      return next();
    }
    
    let decoded = verifyAccessToken(accessToken);
    
    if (!decoded && refreshToken) {
      const refreshDecoded = verifyRefreshToken(refreshToken);
      
      if (!refreshDecoded) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/patient/login');
      }
      
      const storedToken = await RefreshToken.findOne({
        token: refreshToken,
        userId: refreshDecoded.id
      });
      
      if (!storedToken) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/patient/login');
      }
      
      const newAccessToken = generateAccessToken({
        id: refreshDecoded.id,
        role: refreshDecoded.role
      });
      
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });
      
      decoded = refreshDecoded;
    }
    
    if (!decoded) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.redirect('/patient/login');
    }
    
    const patient = await Patient.findById(decoded.id).select('-password');
    
    if (!patient) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.redirect('/patient/login');
    }

    if (patient.isBlocked) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(403).render('error', {
        title: 'Account Blocked',
        message: 'Your account has been blocked. Please contact support.',
        reason: patient.blockedReason || 'Account violation'
      });
    }

    if (!patient.isActive) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(403).render('error', {
        title: 'Account Inactive',
        message: 'Your account has been deactivated.'
      });
    }
    
    req.user = patient;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
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
        message: 'Your account has been blocked. Please contact the administrator.'
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

// ============= CHECK AUTH (for login pages) =============
const checkAuth = (req, res, next) => {
  const accessToken = req.cookies.accessToken;
  const doctorToken = req.cookies.token;
  
  if (accessToken) {
    try {
      const decoded = verifyAccessToken(accessToken);
      if (decoded && decoded.role === 'patient') {
        return res.redirect('/patient/dashboard');
      }
    } catch (error) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
    }
  }
  
  if (doctorToken) {
    try {
      const decoded = jwt.verify(doctorToken, process.env.JWT_SECRET);
      if (decoded.role === 'doctor') {
        return res.redirect('/doctor/dashboard');
      }
    } catch (error) {
      res.clearCookie('token');
    }
  }
  
  next();
};

export { protect, protectDoctor, checkAuth };
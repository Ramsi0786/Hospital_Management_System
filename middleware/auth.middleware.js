import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken } from '../config/jwt.js';
import RefreshToken from '../models/refreshToken.model.js';
import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import crypto from 'crypto';

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

      if (storedToken.isUsed) {
        await RefreshToken.deleteMany({ family: storedToken.family });
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/patient/login');
      }

      storedToken.isUsed = true;
      await storedToken.save();

      const newAccessToken = generateAccessToken({
        id: refreshDecoded.id,
        role: refreshDecoded.role
      });

      const newRefreshToken = generateRefreshToken({
        id: refreshDecoded.id,
        role: refreshDecoded.role
      });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await RefreshToken.create({
        token: newRefreshToken,
        userId: refreshDecoded.id,
        userModel: 'Patient',
        family: storedToken.family, 
        expiresAt
      });

      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
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
    
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken && !refreshToken) {
      return res.redirect('/doctor/login');
    }

    let decoded = verifyAccessToken(accessToken);

    if (!decoded && refreshToken) {
      const refreshDecoded = verifyRefreshToken(refreshToken);

      if (!refreshDecoded) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/doctor/login');
      }

      const storedToken = await RefreshToken.findOne({
        token: refreshToken,
        userId: refreshDecoded.id
      });

      if (!storedToken) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/doctor/login');
      }

      if (storedToken.isUsed) {
        await RefreshToken.deleteMany({ family: storedToken.family });
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/doctor/login');
      }

      storedToken.isUsed = true;
      await storedToken.save();

      const newAccessToken = generateAccessToken({
        id: refreshDecoded.id,
        role: refreshDecoded.role
      });

      const newRefreshToken = generateRefreshToken({
        id: refreshDecoded.id,
        role: refreshDecoded.role
      });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await RefreshToken.create({
        token: newRefreshToken,
        userId: refreshDecoded.id,
        userModel: 'Doctor',
        family: storedToken.family, 
        expiresAt
      });

      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      decoded = refreshDecoded;
    }

    if (!decoded) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.redirect('/doctor/login');
    }

    if (!decoded.role || decoded.role !== 'doctor') {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        redirectUrl: '/doctor/login',
        redirectText: 'Go to Doctor Login'
      });
    }

    const doctor = await Doctor.findById(decoded.id).select('-password');

    if (!doctor) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.redirect('/doctor/login');
    }

    if (doctor.status === 'blocked') {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(403).render('error', {
        title: 'Account Blocked',
        message: 'Your account has been blocked. Please contact the administrator.'
      });
    }

    if (doctor.status === 'inactive') {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(403).render('error', {
        title: 'Account Inactive',
        message: 'Your account is inactive. Please contact the administrator.'
      });
    }

    req.user = doctor;
    res.locals.user = doctor;
    req.user.role = 'doctor';
    next();
  } catch (error) {
    console.error('Doctor auth error:', error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.redirect('/doctor/login');
  }
};

// ============= CHECK AUTH (for login pages) =============
const checkAuth = (req, res, next) => {
  const accessToken = req.cookies.accessToken;

  if (accessToken) {
    try {
      const decoded = verifyAccessToken(accessToken);
      if (decoded && decoded.role === 'patient') {
        return res.redirect('/patient/dashboard');
      }
      if (decoded && decoded.role === 'doctor') {
        return res.redirect('/doctor/dashboard');
      }
    } catch (error) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
    }
  }

  next();
};

export { protect, protectDoctor, checkAuth };
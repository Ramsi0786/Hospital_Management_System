import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';

const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

export const adminProtect = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    
    const token = req.cookies.adminToken;
    
    if (!token) {
      return res.redirect('/admin/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.id === 'superAdmin' && decoded.role === 'superadmin') {
      req.admin = {
        id: 'superAdmin',
        name: 'Super Admin',
        role: 'superadmin',
        isActive: true
      };
      return next();
    }
    
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

    req.admin = admin;
    next();
  } catch (error) {
    console.error('[Admin Protect] Error:', error.message);
    res.clearCookie('adminToken');
    return res.redirect('/admin/login');
  }
};

export const checkAdminAuth = (req, res, next) => {
  const token = req.cookies.adminToken;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin' || decoded.role === 'superadmin') {
        return res.redirect('/admin/dashboard');
      }
    } catch (error) {
      res.clearCookie('adminToken');
    }
  }
  
  next();
};
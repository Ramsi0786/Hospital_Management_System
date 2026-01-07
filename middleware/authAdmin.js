import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';

const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

const adminProtect = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    
    const token = req.cookies.token;

    if (!token) {
      return res.redirect('/admin/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.id === 'superAdmin' && decoded.role === 'superadmin') {
      req.admin = { id: 'superAdmin', role: 'superadmin' };
      return next();
    }

    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id).select('-password');
      if (!admin) {
        res.clearCookie('token');
        return res.redirect('/admin/login');
      }
      req.admin = admin;
      return next();
    }

    res.clearCookie('token');
    return res.redirect('/admin/login');

  } catch (error) {
    console.error('Admin auth error:', error);
    res.clearCookie('token');
    return res.redirect('/admin/login');
  }
};

export { adminProtect };

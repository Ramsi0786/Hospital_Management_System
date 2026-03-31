import { verifyAccessToken } from '../config/jwt.js';
import Patient from '../models/patient.model.js';

export const publicAuth = async (req, res, next) => {
  try {
      res.locals.currentPath = req.path;

    const token = req.cookies.accessToken;
    if (!token) return next();

    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'patient') return next();

    const patient = await Patient.findById(decoded.id).select('name email role profileImage');
    if (!patient || patient.isBlocked || !patient.isActive) return next();

    res.locals.currentUser = patient;
    res.locals.user = patient;
    next();
  } catch {
    next();
  }
};

import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken } from '../config/jwt.js';
import Patient from '../models/patient.model.js';
import RefreshToken from '../models/refreshToken.model.js';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
  maxAge
});

export const publicAuth = async (req, res, next) => {
  try {
    res.locals.currentPath = req.path;

    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken && !refreshToken) return next();

    let decoded = verifyAccessToken(accessToken);

    if (!decoded && refreshToken) {
      const refreshDecoded = verifyRefreshToken(refreshToken);
      if (!refreshDecoded) {
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
        return next();
      }

      const storedToken = await RefreshToken.findOne({
        token: refreshToken,
        userId: refreshDecoded.id
      });

      if (!storedToken || storedToken.isUsed) {
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
        return next();
      }

      storedToken.isUsed = true;
      await storedToken.save();

      const newAccessToken = generateAccessToken({ id: refreshDecoded.id, role: refreshDecoded.role });
      const newRefreshToken = generateRefreshToken({ id: refreshDecoded.id, role: refreshDecoded.role });

      await RefreshToken.create({
        token: newRefreshToken,
        userId: refreshDecoded.id,
        userModel: 'Patient',
        family: storedToken.family,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      res.cookie('accessToken', newAccessToken, cookieOptions(15 * 60 * 1000));
      res.cookie('refreshToken', newRefreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

      decoded = refreshDecoded;
    }

    if (!decoded || decoded.role !== 'patient') return next();

    const patient = await Patient.findById(decoded.id).select('name email role profileImage isBlocked isActive');
    if (!patient || patient.isBlocked || !patient.isActive) return next();

    res.locals.currentUser = patient;
    res.locals.user = patient;
    next();
  } catch (err) {
    console.error('PublicAuth error:', err.message);
    next();
  }
};
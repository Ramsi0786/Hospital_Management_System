import { generateAccessToken } from "../../config/jwt.js";
import Admin from "../../models/admin.model.js";
import bcrypt from "bcryptjs";
import { USER_ROLES, HTTP_STATUS, TIME } from "../../constants/index.js";
import logger from "../../utils/logger.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        errors: { general: "Email and Password Required" }
      });
    }

    if (
      email === process.env.MAIN_ADMIN_EMAIL &&
      password === process.env.MAIN_ADMIN_PASSWORD
    ) {
      const token = generateAccessToken({ 
        id: "superAdmin", 
        role: USER_ROLES.SUPER_ADMIN
      });

      res.cookie("adminToken", token, { 
        httpOnly: true,
        sameSite: "strict",
        maxAge: TIME.ADMIN_TOKEN_EXPIRY
      });

      logger.auth('Admin Login', 'superAdmin', true, 'Super Admin access');
      return res.status(HTTP_STATUS.OK).json({ redirect: "/admin/dashboard" });
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      logger.warn('Admin login attempt failed', 'Auth', { email, reason: 'Not found' });
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        errors: { email: "No admin account found" }
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      logger.warn('Admin login attempt failed', 'Auth', { email, reason: 'Invalid password' });
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        errors: { password: "Incorrect Password" }
      });
    }

    const token = generateAccessToken({ 
      id: admin._id, 
      role: USER_ROLES.ADMIN
    });

    res.cookie("adminToken", token, { 
      httpOnly: true,
      sameSite: "strict",
      maxAge: TIME.ADMIN_TOKEN_EXPIRY
    });

    logger.auth('Admin Login', admin._id.toString(), true, `Admin: ${admin.email}`);
    res.status(HTTP_STATUS.OK).json({ redirect: "/admin/dashboard" });

  } catch (err) {
    logger.error("Admin login error", "Auth", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      errors: { general: "Server error" } 
    });
  }
};

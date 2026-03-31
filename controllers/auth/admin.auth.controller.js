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

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

    if (!admin) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        errors: { email: "No admin account found" }
      });
    }

    if (!admin.isActive || admin.status === 'blocked') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        errors: { general: "Your account has been deactivated." }
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        errors: { password: "Incorrect Password" }
      });
    }

    const token = generateAccessToken({
      id:   admin._id,
      role: USER_ROLES.ADMIN
    });

    res.cookie("adminToken", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge:   TIME.ADMIN_TOKEN_EXPIRY
    });

    await Admin.findByIdAndUpdate(admin._id, { lastLogin: new Date() });

    logger.auth('Admin Login', admin._id.toString(), true, admin.email);
    return res.status(HTTP_STATUS.OK).json({ redirect: "/admin/dashboard" });

  } catch (err) {
    logger.error("Admin login error", "Auth", err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      errors: { general: "Server error" }
    });
  }
};
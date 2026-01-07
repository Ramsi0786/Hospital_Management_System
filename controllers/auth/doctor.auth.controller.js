import Doctor from "../../models/doctor.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../../config/jwt.js";

export const login = async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        errors: { general: "Email and password required" }
      });
    }

    const doctor = await Doctor.findOne({ email });
    
    if (!doctor) {
      return res.status(404).json({
        errors: { email: "No doctor account found" }
      });
    }

    if (doctor.status === 'blocked') {
      return res.status(403).json({
        errors: { general: "Your account has been blocked. Please contact the administrator." }
      });
    }

    if (doctor.status === 'inactive') {
      return res.status(403).json({
        errors: { general: "Your account is inactive. Please contact the administrator." }
      });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.status(400).json({
        errors: { password: "Incorrect password" }
      });
    }

    const token = generateToken({ id: doctor._id, role: "doctor" });

    const cookieOptions = {
      httpOnly: true,
      sameSite: "strict",
      maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    };

    res.cookie("token", token, cookieOptions);

    res.status(200).json({ redirect: "/doctor/dashboard" });
  } catch (err) {
    console.error("Doctor login error:", err);
    res.status(500).json({ errors: { general: "Server error" } });
  }
};
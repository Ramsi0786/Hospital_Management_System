import { generateToken } from "../../config/jwt.js";
import Admin from "../../models/admin.model.js";
import bcrypt from "bcryptjs";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { general: "Email and Password Required" }
      });
    }

    if (
      email === process.env.MAIN_ADMIN_EMAIL &&
      password === process.env.MAIN_ADMIN_PASSWORD
    ) {
      const token = generateToken({ id: "superAdmin", role: "superadmin" });

      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.status(200).json({ redirect: "/admin/dashboard" });
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({
        errors: { email: "No admin account found" }
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({
        errors: { password: "Incorrect Password" }
      });
    }

    const token = generateToken({ id: admin._id, role: "admin" });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({ redirect: "/admin/dashboard" });

  } catch (err) {
    console.error("Admin Login error:", err);
    res.status(500).json({ errors: { general: "Server error" } });
  }
};

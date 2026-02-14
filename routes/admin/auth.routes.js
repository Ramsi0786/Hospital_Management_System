import express from "express";
const router = express.Router();
import * as adminAuthController from "../../controllers/auth/admin.auth.controller.js";
import { checkAdminAuth } from "../../middleware/authAdmin.js";

router.route('/login')
  .get(checkAdminAuth, (req, res) => {
    res.render("admin/login", { title: "Admin Login - Healora" });
  })
  .post(adminAuthController.login);

router.route('/logout')
  .get((req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.clearCookie('adminToken', {
      httpOnly: true,
      sameSite: 'strict'
    });
    res.redirect('/admin/login');
  })
  .post((req, res) => {
    res.clearCookie('adminToken', {
      httpOnly: true,
      sameSite: 'strict'
    });
    res.json({ success: true });
  });

export default router;
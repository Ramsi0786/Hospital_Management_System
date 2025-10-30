const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");

// Example admin dashboard route
router.get("/dashboard", adminController.getDashboard);

// Add other admin-related routes

module.exports = router;

const Doctor = require("../models/doctor.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Doctor Dashboard (protected, example)
exports.getDashboard = (req, res) => {
  res.send(`Welcome Doctor! Your ID: ${req.user._id}`);
};

// Add other doctor controller functions as needed (register, login, profile, etc.)

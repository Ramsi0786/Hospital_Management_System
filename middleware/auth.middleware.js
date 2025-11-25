const jwt = require("jsonwebtoken");
const Patient = require("../models/patient.model");

exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.redirect("/patient/login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const patient = await Patient.findById(decoded.id).select("-password");

    if (!patient) {
      return res.redirect("/patient/login");
    }

    req.user = patient;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    return res.redirect("/patient/login");
  }
};

exports.checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const patient = await Patient.findById(decoded.id).select("-password");
      
      if (patient) {
        req.user = patient;
        res.locals.user = patient; 
      }
    }
  } catch (error) {
    
  }
  
  next();
};
const jwt = require("jsonwebtoken");
const Patient = require("../models/patient.model");

exports.protectPatient = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.redirect("/patient/login");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const patient = await Patient.findById(decoded.id).select("-password");

    if (!patient) return res.redirect("/patient/login");

    req.user = patient;
    next();
  } catch (err) {
    console.error("Auth Error:", err);
    res.redirect("/patient/login");
  }
};

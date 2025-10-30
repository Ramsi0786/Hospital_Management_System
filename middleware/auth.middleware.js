const jwt = require("jsonwebtoken");
const Patient = require("../models/patient.model");

const protect = async (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers["authorization"]?.split(" ")[1] ||
    req.query.token;

  if (!token) {
    return res.redirect("/patient/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await Patient.findById(decoded.id).select("-password");
    if (!req.user) return res.redirect("/patient/login");
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.redirect("/patient/login");
  }
};

module.exports = protect;

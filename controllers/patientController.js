const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Patient = require("../models/patient");

exports.showLogin = (req, res) => {
  res.render("patient/patient-login");
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const patient = await Patient.findOne({ email });
    if (!patient) {
      return res.status(400).render("patient/patient-login", { error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, patient.password);
    if (!isMatch) {
      return res.status(400).render("patient/patient-login", { error: "Invalid credentials" });
    }

    // create JWT
    const token = jwt.sign(
      { id: patient._id, role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // save token in cookie
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/patient/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.dashboard = (req, res) => {
  res.render("patient/dashboard", { patient: req.user });
};

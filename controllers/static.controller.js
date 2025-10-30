exports.landingPage = (req, res) => {
  res.render("landing_page", { title: "Healora - Smarter Healthcare, Simplified for Everyone" });
};

exports.loginPage = (req, res) => {
  res.render("redirect", { title: "Login - Healora" });
};

exports.patientLoginPage = (req, res) => {
  res.render("patient/patient-login", { title: "Patient Login - Healora" });
};

exports.patientSignupPage = (req, res) => {
  res.render("patient/patient-signup", { title: "Patient Signup - Healora" });
};

exports.aboutUsPage = (req, res) => {
  res.render("about-us", { title: "Healora - About Us" });
};

exports.doctorsPage = (req, res) => {
  res.render("doctors", { title: "Our Doctors" });
};

exports.servicesPage = (req, res) => {
  res.render("services", { title: "Our Services" });
};

exports.contactPage = (req, res) => {
  res.render("contact", { title: "Connect With Us" });
};

exports.departmentPage = (req, res) => {
  const dept = req.params.name;
  res.render(`departments/${dept}`);
};

exports.page404 = (req, res) => {
  res.status(404).render("404", { title: "Page Not Found - Healora" });
};

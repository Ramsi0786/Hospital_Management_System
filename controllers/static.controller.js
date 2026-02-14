import Doctor from "../models/doctor.model.js";

export const landingPage = async (req, res) => {
  try {

    const doctors = await Doctor.find()
      .select("name email specialization department phone");
    
    res.render("landing_page", { 
      title: "Healora - Smarter Healthcare, Simplified for Everyone",
      doctors: doctors
    });
  } catch (error) {
    console.error("Error loading landing page:", error);
    res.render("landing_page", { 
      title: "Healora - Smarter Healthcare, Simplified for Everyone",
      doctors: []
    });
  }
};

export const doctorsPage = async (req, res) => {
  try {
    const { department, search } = req.query;
    let query = {};

    if (department && department !== "all") {
      query.department = department;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } }
      ];
    }
    
    const doctors = await Doctor.find(query)
      .select("name email specialization department phone");
    
    const departments = await Doctor.distinct("department");
    
    res.render("doctors", { 
      title: "Our Doctors - Healora",
      doctors: doctors,
      departments: departments,
      selectedDepartment: department || "all",
      searchQuery: search || ""
    });
  } catch (error) {
    console.error("Error loading doctors page:", error);
    res.render("doctors", { 
      title: "Our Doctors - Healora",
      doctors: [],
      departments: [],
      selectedDepartment: "all",
      searchQuery: ""
    });
  }
};

export const doctorDetailPage = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id)
      .select("name email specialization department phone createdAt");
    
    if (!doctor) {
      return res.redirect("/doctors");
    }
    
    res.render("doctor-detail", {
      title: `Dr. ${doctor.name} - Healora`,
      doctor: doctor
    });
  } catch (error) {
    console.error("Error loading doctor detail:", error);
    res.redirect("/doctors");
  }
};

export const loginPage = (req, res) => {
  res.render("redirect", { title: "Login - Healora" });
};

export const patientLoginPage = (req, res) => {
  res.render("patient/patient-login", { 
    title: "Patient Login - Healora",
    error: null,
    success: null
  });
};

export const patientSignupPage = (req, res) => {
  res.render("patient/patient-signup", { title: "Patient Signup - Healora" });
};

export const patientOtpPage = (req, res) => {
  res.render("patient/verify-otp", { title: "Verify OTP - Healora" });
};

export const aboutUsPage = (req, res) => {
  res.render("about-us", { title: "Healora - About Us" });
};

export const servicesPage = (req, res) => {
  res.render("services", { title: "Our Services" });
};

export const contactPage = (req, res) => {
  res.render("contact", { title: "Connect With Us" });
};

export const departmentPage = (req, res) => {
  const dept = req.params.name;
  res.render(`departments/${dept}`);
};

export const page404 = (req, res) => {
  res.status(404).render("404", { title: "Page Not Found - Healora" });
};

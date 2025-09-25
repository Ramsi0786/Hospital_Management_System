// 1. Import required modules
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming requests
app.use(express.json()); // for API requests (JSON)
app.use(express.urlencoded({ extended: true })); // for form submissions

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

//========================= ROUTES =========================

// Landing Page
app.get('/', (req, res) => {
  res.render('landing_page', { 
    title: 'Healora - Smarter Healthcare, Simplified for Everyone' 
  });
});

// User Login (redirect page)
app.get('/login', (req, res) => {
  res.render('redirect', { title: 'Login - Healora' });
});

// About Us
app.get('/about-us', (req, res) => {
  res.render('about-us', { title: 'Healora - About Us' });
});

// Doctors Public Page
app.get('/doctors', (req, res) => {
  res.render('doctors', { title: 'Our Doctors' });
});

// Doctor login page
app.get('/doctor/doctor-login', (req, res) => {
  res.render('doctor-login', { title: 'Doctor Login - Healora' });
});



//========================= AUTH ROUTES (JWT Example) =========================

const doctorAuthRoutes = require("./routes/doctorAuthRoutes");
app.use("/auth", doctorAuthRoutes);

const patientAuthRoutes = require("./routes/patientAuth");
app.use("/patient", patientAuthRoutes);



// ========================= START SERVER =========================
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

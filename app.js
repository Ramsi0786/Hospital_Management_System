const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("./config/passport");

const patientAuthRoutes = require("./routes/patientAuth");
const oauthRoutes = require("./routes/oauthRoutes");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

mongoose.connect("mongodb+srv://Ramsiii:Ramsi%40786@cluster0.jwaoaen.mongodb.net/hms")
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));


//========================= ROUTES =========================



app.get('/', (req, res) => {
  res.render('landing_page', { 
    title: 'Healora - Smarter Healthcare, Simplified for Everyone' 
  });
});


app.get('/login', (req, res) => {
  res.render('redirect', { title: 'Login - Healora' });
});


app.get('/about-us', (req, res) => {
  res.render('about-us', { title: 'Healora - About Us' });
});


app.get('/doctors', (req, res) => {
  res.render('doctors', { title: 'Our Doctors' });
});

app.get('/services', (req, res) =>{
   res.render('services',{ title: 'our services'});
});

app.get('/contact', (req, res) => {
  res.render('contact',{ title: 'connect with us'});
});

app.get('/departments/:name', (req, res) => {
  const dept = req.params.name;
  res.render(`departments/${dept}`);
});

app.get('/doctor/doctor-login', (req, res) => {
  res.render('doctor-login', { title: 'Doctor Login - Healora' });
});

const doctorRoutes = require('./routes/doctorAuthRoutes');
app.use('/', doctorRoutes);


//========================= AUTH ROUTES (JWT Example) =========================

const doctorAuthRoutes = require("./routes/doctorAuthRoutes");
app.use("/auth", doctorAuthRoutes);

app.use("/patient", require("./routes/patientAuth"));


app.use("/auth", oauthRoutes);

// ========================= START SERVER =========================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

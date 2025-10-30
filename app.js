const express = require("express");
const path = require("path");
const dotenv = require("dotenv").config();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("./config/passport");
const connectDB = require("./config/db");

const patientRoutes = require("./routes/patient.routes");
const doctorRoutes = require("./routes/doctor.routes");
const adminRoutes = require("./routes/admin.routes");
const oauthRoutes = require("./routes/oauth.routes");
const staticRoutes = require("./routes/static.routes"); // NEW for static pages

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

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


app.use("/", staticRoutes);           
app.use("/auth", oauthRoutes);
app.use("/doctor", doctorRoutes);
app.use("/admin", adminRoutes);       
app.use("/patient", patientRoutes);




app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found - Healora" });
});

// ========================= START SERVER =========================
app.listen(PORT, () => {
  console.log('==========================================');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('==========================================');
});

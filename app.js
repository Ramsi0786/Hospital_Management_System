import 'dotenv/config'; 

import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import session from "express-session";
import { RedisStore } from "connect-redis";
import redisClient from "./config/redis.js";
import passport from "./config/passport.js";
import connectDB from "./config/db.js";

import patientRoutes from "./routes/patient.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import adminRoutes from "./routes/admin/routes.js";
import oauthRoutes from "./routes/oauth.routes.js";
import staticRoutes from "./routes/static.routes.js";
import { attachSettings } from './middleware/settings.middleware.js';
import { startAutoApproveJob } from './jobs/autoApproveLeave.js';


const app = express();
const PORT = process.env.PORT || 3000;

connectDB();
startAutoApproveJob();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());
app.use(attachSettings);
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600000
    }
  })
);
app.use(passport.initialize());

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static(path.join(process.cwd(), "public")));

app.use("/", staticRoutes);
app.use("/patient/auth", oauthRoutes);
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

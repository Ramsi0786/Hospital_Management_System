import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/admin.model.js';
import connectDB from '../config/db.js';

const seed = async () => {
  await connectDB();

  const email    = process.env.MAIN_ADMIN_EMAIL;
  const password = process.env.MAIN_ADMIN_PASSWORD;

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log('Super admin already exists.');
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);
  await Admin.create({
    name:     'Super Admin',
    email,
    password: hashed,
    role:     'super_admin',
    isActive: true,
    status:   'active'
  });

  console.log('Super admin created successfully.');
  process.exit(0);
};

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
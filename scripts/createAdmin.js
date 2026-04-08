const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

const createInitialAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const adminExists = await User.findOne({ role: 'ADMIN' });
    if (adminExists) {
      console.log("Admin already exists!");
      process.exit();
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('BricksAdmin2026!', salt);

    const admin = new User({
      fullName: "System Administrator",
      email: "digital.solutions@brickslimited.com",
      password: hashedPassword,
      role: "ADMIN",
      department: "IT"
    });

    await admin.save();
    console.log("✅ Super Admin Created: digital.solutions@brickslimited.com / BricksAdmin2026!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createInitialAdmin();
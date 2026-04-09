const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- REGISTER NEW USER (Internal use for now) ---
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department, role } = req.body;
    
    // Normalize email to prevent duplicates
    const cleanEmail = email.toLowerCase().trim();
    
    let user = await User.findOne({ email: cleanEmail });
    if (user) return res.status(400).json({ msg: "User already exists" });

    user = new User({ 
      name, 
      email: cleanEmail, 
      password, 
      department, 
      role 
    });
    
    await user.save();
    res.status(201).json({ msg: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Normalize email for search
    const cleanEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

    // PHASE 1: Persistent Login
    // Changed expiresIn to '30d' (30 days) so maritime staff stay logged in during long shifts
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        name: user.name, 
        dept: user.department 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } 
    );

    // Return user object so frontend can immediately set the Dashboard view
    res.json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        role: user.role, 
        dept: user.department 
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

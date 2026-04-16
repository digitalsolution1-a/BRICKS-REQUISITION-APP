const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * INTERNAL MIDDLEWARE: protect
 */
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) return res.status(401).json({ error: "USER NOT FOUND" });
      next();
    } catch (error) {
      res.status(401).json({ error: "SESSION EXPIRED" });
    }
  } else {
    res.status(401).json({ error: "NO TOKEN" });
  }
};

const isAdmin = (user) => user && user.role && user.role.toLowerCase() === 'admin';

// --- 1. FETCH ALL USERS ---
router.get('/', protect, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "ADMIN ONLY" });
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "FETCH FAILED" });
  }
});

// --- 2. REGISTER NEW PERSONNEL (Cleaned for Model Hashing) ---
router.post('/register', protect, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "UNAUTHORIZED" });

    const { name, email, password, role, dept } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: "MISSING REQUIRED DATA" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: "USER ALREADY EXISTS" });

    // IMPORTANT: We pass the PLAIN password here. 
    // The UserSchema.pre('save') hook in User.js will hash it for us.
    await User.create({
      name, 
      email, 
      password, 
      role: role || 'Staff',
      department: dept || 'Operations' // Using 'department' to match your Schema
    });

    res.status(201).json({ msg: "PERSONNEL PROVISIONED SUCCESSFULLY" });
  } catch (err) {
    console.error("PROVISIONING ERROR:", err.message);
    res.status(500).json({ error: `PROVISIONING FAILED: ${err.message}` });
  }
});

// --- 3. DELETE USER ---
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "UNAUTHORIZED" });
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "USER DECOMMISSIONED" });
  } catch (err) {
    res.status(500).json({ error: "DELETE FAILED" });
  }
});

module.exports = router;

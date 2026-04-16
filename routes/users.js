const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * INTERNAL MIDDLEWARE: protect
 * Defines session security locally to avoid pathing issues on Render.
 */
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ error: "USER NOT FOUND IN SYSTEM" });
      }
      
      next();
    } catch (error) {
      console.error("JWT AUTH ERROR:", error.message);
      res.status(401).json({ error: "SESSION EXPIRED OR INVALID" });
    }
  } else {
    res.status(401).json({ error: "NO AUTHORIZATION TOKEN DETECTED" });
  }
};

// Helper to check for Admin role safely
const isAdmin = (user) => user && user.role && user.role.toLowerCase() === 'admin';

// --- 1. FETCH ALL USERS ---
router.get('/', protect, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "UNAUTHORIZED: ADMIN ACCESS ONLY" });
    }
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err.message);
    res.status(500).json({ error: "SERVER ERROR FETCHING USERS" });
  }
});

// --- 2. REGISTER NEW PERSONNEL ---
router.post('/register', protect, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "UNAUTHORIZED: ONLY ADMINS CAN PROVISION" });
    }

    const { name, email, password, role, dept } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "MISSING REQUIRED DATA (NAME, EMAIL, PWD, ROLE)" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: "USER ALREADY EXISTS" });

    /**
     * NOTE: We are NOT hashing the password here.
     * The pre-save hook in models/User.js handles the hashing automatically.
     * Sending the plain password here prevents "Double Hashing" which causes login failure.
     */
    const newUser = await User.create({
      name, 
      email, 
      password, // Pass plain; Model hashes it
      role, 
      department: dept || 'Operations' // Matches the 'department' field in your Schema
    });

    res.status(201).json({ 
      msg: "PERSONNEL PROVISIONED SUCCESSFULLY",
      userId: newUser._id 
    });

  } catch (err) {
    console.error("PROVISIONING CRASH DETAILS:", err);
    res.status(500).json({ error: `PROVISIONING FAILED: ${err.message}` });
  }
});

// --- 3. DELETE USER ---
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "UNAUTHORIZED" });
    
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ error: "USER NOT FOUND" });

    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "USER DECOMMISSIONED" });
  } catch (err) {
    res.status(500).json({ error: "SERVER ERROR DURING DELETION" });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- 1. REGISTER NEW USER ---
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department, role } = req.body;
    
    // Normalize email to prevent duplicates and login mismatches
    const cleanEmail = email.toLowerCase().trim();
    
    let user = await User.findOne({ email: cleanEmail });
    if (user) return res.status(400).json({ msg: "Personnel already exists in system" });

    // Use provided role or default to 'Staff'
    // We trim and normalize to ensure 'Admin' doesn't have accidental spaces
    const assignedRole = role ? role.trim() : 'Staff';

    user = new User({ 
      name: name.trim(), 
      email: cleanEmail, 
      password, // Pass plain; Model hashes it
      department: department || 'Operations', 
      role: assignedRole
    });
    
    await user.save();
    res.status(201).json({ msg: "Personnel registered successfully" });
  } catch (err) {
    console.error("Registration Error:", err.message);
    res.status(500).json({ error: "Internal Server Error during registration" });
  }
});

// --- 2. LOGIN ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ msg: "Please provide all credentials" });
    }

    // Normalize email for searching
    const cleanEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

    // PHASE 1: Persistent Login (30 Days)
    // We include the role directly from the DB to the token
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

    // Return structured user data for frontend state management
    res.json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        role: user.role, 
        dept: user.department 
      }
    });
    
    console.log(`✅ Login Successful: ${user.email} as ${user.role}`);
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ error: "Internal Server Error during login" });
  }
});

// --- 3. RECOVERY: GET IDENTITY CONFIGURATION ---
// Validates email existence and instructs frontend to request the old password
router.post('/recovery/get-question', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email address required" });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    
    if (!user) {
      return res.status(404).json({ error: "No personnel identity found with this corporate email." });
    }

    // Inform frontend to prompt for old password verification
    res.status(200).json({ question: "Verify your current account security by entering your Old Password." });
  } catch (err) {
    console.error("Recovery Profile Fetch Error:", err.message);
    res.status(500).json({ error: "Internal Server Error fetching verification parameters" });
  }
});

// --- 4. RECOVERY: VERIFY AND WRITE NEW PASSWORD ---
// Safely matches the old password via bcrypt and updates it with the new hash
router.put('/recovery/reset', async (req, res) => {
  try {
    const { email, answer, newPassword } = req.body; // 'answer' represents old password from frontend field
    
    if (!email || !answer || !newPassword) {
      return res.status(400).json({ error: "All validation parameters are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ error: "Account lookup mismatch." });

    // Validate the incoming old password hash match
    const isMatch = await bcrypt.compare(answer, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Verification failed. Old password incorrect." });
    }

    // 🟢 FIXED: Assign the plain text password directly to the document object.
    // Bypassing manual bcrypt calls here prevents double-hashing. 
    // user.save() automatically fires your pre-save hook in User.js to encrypt it correctly.
    user.password = newPassword; 
    
    await user.save();
    res.status(200).json({ msg: "Security parameters updated successfully" });
    console.log(`🔒 Password changed securely for: ${user.email}`);
  } catch (err) {
    console.error("Password Reset Error:", err.message);
    res.status(500).json({ error: "Internal Server Error while changing security records" });
  }
});

module.exports = router;

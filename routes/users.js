const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware'); // Ensure this path is correct

// --- 1. FETCH ALL USERS (Admin Only) ---
// This handles the "User Manifest" table in your frontend
router.get('/', protect, async (req, res) => {
  try {
    // Security Check: Only 'Admin' role can see the full registry
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: "UNAUTHORIZED: ACCESS TO REGISTRY DENIED" });
    }

    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).json({ error: "SERVER ERROR FETCHING USERS" });
  }
});

// --- 2. REGISTER NEW PERSONNEL (Provisioning) ---
// This handles the "Deploy Account" button in your frontend
router.post('/register', protect, async (req, res) => {
  try {
    // Security Check: Only 'Admin' can provision new accounts
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: "UNAUTHORIZED: ONLY ADMINS CAN PROVISION ACCOUNTS" });
    }

    const { name, email, password, role, dept } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "MISSING REQUIRED PERSONNEL DATA" });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "PERSONNEL ALREADY EXISTS IN REGISTRY" });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      dept: dept || 'Operations'
    });

    res.status(201).json({
      msg: "PERSONNEL PROVISIONED SUCCESSFULLY",
      user: {
        id: newUser._id,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error("Registration Error:", err.message);
    res.status(500).json({ error: "SERVER ERROR DURING PROVISIONING" });
  }
});

// --- 3. DELETE USER (Optional Management) ---
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: "UNAUTHORIZED ACTION" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "USER NOT FOUND" });

    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "USER DECOMMISSIONED SUCCESSFULLY" });
  } catch (err) {
    res.status(500).json({ error: "SERVER ERROR DURING DELETION" });
  }
});

module.exports = router;

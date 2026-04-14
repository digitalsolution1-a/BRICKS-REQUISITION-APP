const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware');

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
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "MISSING REQUIRED DATA" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: "USER ALREADY EXISTS" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name, email, password: hashedPassword, role, dept: dept || 'Operations'
    });

    res.status(201).json({ msg: "PERSONNEL PROVISIONED SUCCESSFULLY" });
  } catch (err) {
    res.status(500).json({ error: "SERVER ERROR DURING PROVISIONING" });
  }
});

// --- 3. DELETE USER ---
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "UNAUTHORIZED" });
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "USER DECOMMISSIONED" });
  } catch (err) {
    res.status(500).json({ error: "SERVER ERROR" });
  }
});

module.exports = router;

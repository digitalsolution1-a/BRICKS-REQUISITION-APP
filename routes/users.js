// Fetch all users (Admin only)
router.get('/', protect, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: "Unauthorized access to registry" });
  }
  try {
    const users = await User.find({}).select('-password'); // Don't send passwords!
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching users" });
  }
});
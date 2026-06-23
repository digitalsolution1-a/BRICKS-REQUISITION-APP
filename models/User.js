const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String, required: true },
  // Roles: 'Staff', 'HOD', 'FC', 'MD', 'ACCOUNTS'
  role: { type: String, default: 'Staff' }, 
  signature: { type: String }, // Optional: URL to a digital signature image
}, { timestamps: true });

// Password hashing before saving
UserSchema.pre('save', async function (next) {
  // If the password field wasn't changed, skip hashing and move forward instantly
  if (!this.isModified('password')) return next();

  try {
    // Hash the password with a salt round factor of 10
    this.password = await bcrypt.hash(this.password, 10);
    
    // 🟢 FIXED: Explicitly call next() to let Mongoose proceed with saving the document
    next();
  } catch (error) {
    // Pass any unexpected errors to Mongoose error handling to prevent server lockups
    next(error);
  }
});

module.exports = mongoose.model('User', UserSchema);

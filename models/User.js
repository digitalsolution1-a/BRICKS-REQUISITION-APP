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
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', UserSchema);

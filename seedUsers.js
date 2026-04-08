require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Adjust this path to wherever your User model is located
const User = require('./models/User'); 

const usersToCreate = [
  { email: 'omotayo.ayansina@brickslimited.com', role: 'HOD', name: 'Omotayo Ayansina' },
  { email: 'jesse.nwaigwe@brickslimited.com', role: 'HOD', name: 'Jesse Nwaigwe' },
  { email: 'crewing@brickslimited.com', role: 'HOD', name: 'Crewing Dept' },
  { email: 'mayowa.segun@brickslimited.com', role: 'HOD', name: 'Mayowa Segun' },
  { email: 'digital.solutions@brickslimited.com', role: 'HOD', name: 'Digital Solutions' },
  { email: 'hauwa.garba@brickslimited.com', role: 'HOD', name: 'Hauwa Garba' },
  { email: 'jp.ino@brickslimited.com', role: 'HOD', name: 'JP Ino' },
  { email: 'emmanuel.maiguwa@brickslimited.com', role: 'Admin', name: 'Emmanuel Maiguwa' },
  { email: 'technical@brickslimited.com', role: 'Staff', name: 'Technical Dept' },
  { email: 'accounts@brickslimited.com', role: 'HOD', name: 'Accounts Dept' },
  { email: 'risikat.ibrahim@brickslimited.com', role: 'HOD', name: 'Risikat Ibrahim' },
  { email: 'operations@brickslimited.com', role: 'Staff', name: 'Operations Dept' },
  { email: 'training@brickslimited.com', role: 'Staff', name: 'Training Dept' },
  { email: 'mariah.buhari@brickslimited.com', role: 'Staff', name: 'Mariah Buhari' },
  { email: 'gloria.theophilus@brickslimited.com', role: 'HOD', name: 'Gloria Theophilus' },
  { email: 'procurement@brickslimited.com', role: 'Staff', name: 'Procurement Dept' }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("⚓ Connected to BRICKS DB for seeding...");

    for (const u of usersToCreate) {
      // Generate a unique password: Name + 2026! (e.g., Omotayo2026!)
      const plainPassword = `${u.name.split(' ')[0]}2026!`; 
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      await User.findOneAndUpdate(
        { email: u.email }, 
        { 
          name: u.name, 
          role: u.role, 
          password: hashedPassword 
        }, 
        { upsert: true, new: true }
      );
      console.log(`✅ Created/Updated: ${u.email} | PW: ${plainPassword}`);
    }

    console.log("🚢 All maritime personnel successfully registered.");
    process.exit();
  } catch (err) {
    console.error("❌ Seeding Error:", err);
    process.exit(1);
  }
};

seedDB();
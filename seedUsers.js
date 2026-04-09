require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Adjust this path to wherever your User model is located
const User = require('./models/User'); 

const usersToCreate = [
  // --- WORKFLOW CRITICAL ROLES ---
  { 
    email: 'emmanuel.maiguwa@brickslimited.com', 
    role: 'MD', 
    name: 'Emmanuel Maiguwa' 
  },
  { 
    email: 'segun.mayowa@brickslimited.com', 
    role: 'FC', 
    name: 'Segun Mayowa' 
  },
  { 
    email: 'accounts@brickslimited.com', 
    role: 'Accountant', 
    name: 'Accounts Dept' 
  },

  // --- HEADS OF DEPARTMENTS (HODs) ---
  { email: 'joshua.omotoso@brickslimited.com', role: 'HOD', name: 'Joshua Omotoso' },
  { email: 'omotayo.ayansina@brickslimited.com', role: 'HOD', name: 'Omotayo Ayansina' },
  { email: 'jesse.nwaigwe@brickslimited.com', role: 'HOD', name: 'Jesse Nwaigwe' },
  { email: 'crewing@brickslimited.com', role: 'HOD', name: 'Crewing Dept' },
  { email: 'mayowa.segun@brickslimited.com', role: 'HOD', name: 'Mayowa Segun' },
  { email: 'digital.solutions@brickslimited.com', role: 'HOD', name: 'Digital Solutions' },
  { email: 'hauwa.garba@brickslimited.com', role: 'HOD', name: 'Hauwa Garba' },
  { email: 'jp.ino@brickslimited.com', role: 'HOD', name: 'JP Ino' },
  { email: 'risikat.ibrahim@brickslimited.com', role: 'HOD', name: 'Risikat Ibrahim' },
  { email: 'gloria.theophilus@brickslimited.com', role: 'HOD', name: 'Gloria Theophilus' },

  // --- STAFF / OPERATIONS ---
  { email: 'technical@brickslimited.com', role: 'Staff', name: 'Technical Dept' },
  { email: 'operations@brickslimited.com', role: 'Staff', name: 'Operations Dept' },
  { email: 'training@brickslimited.com', role: 'Staff', name: 'Training Dept' },
  { email: 'mariah.buhari@brickslimited.com', role: 'Staff', name: 'Mariah Buhari' },
  { email: 'procurement@brickslimited.com', role: 'Staff', name: 'Procurement Dept' }
];

const seedDB = async () => {
  try {
    // Ensure MONGO_URI is in your .env file
    await mongoose.connect(process.env.MONGO_URI);
    console.log("⚓ Connected to BRICKS DB for seeding...");

    for (const u of usersToCreate) {
      // Generate a unique password based on the first name + 2026!
      // Example: Joshua -> Joshua2026!
      const firstName = u.name.split(' ')[0];
      const plainPassword = `${firstName}2026!`; 
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
      console.log(`✅ Role: ${u.role.padEnd(12)} | User: ${u.email.padEnd(35)} | PW: ${plainPassword}`);
    }

    console.log("\n🚢 All maritime personnel successfully registered. Joshua Omotoso added as HOD.");
    process.exit();
  } catch (err) {
    console.error("❌ Seeding Error:", err);
    process.exit(1);
  }
};

seedDB();

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Ensure this path correctly points to your User model
const User = require('./models/User'); 

const usersToCreate = [
  // --- SUPER ADMIN (System Control) ---
  { 
    email: 'digital.solutions@brickslimited.com', 
    role: 'Admin', 
    name: 'Digital Solutions',
    dept: 'IT'
  },

  // --- WORKFLOW CRITICAL ROLES ---
  { 
    email: 'emmanuel.maiguwa@brickslimited.com', 
    role: 'MD', 
    name: 'Emmanuel Maiguwa',
    dept: 'Executive'
  },
  { 
    email: 'segun.mayowa@brickslimited.com', 
    role: 'FC', 
    name: 'Segun Mayowa',
    dept: 'Finance'
  },
  { 
    email: 'accounts@brickslimited.com', 
    role: 'Accountant', 
    name: 'Accounts Dept',
    dept: 'Finance'
  },

  // --- HEADS OF DEPARTMENTS (HODs) ---
  { email: 'joshua.omotoso@brickslimited.com', role: 'HOD', name: 'Joshua Omotoso', dept: 'Operations' },
  { email: 'omotayo.ayansina@brickslimited.com', role: 'HOD', name: 'Omotayo Ayansina', dept: 'Admin' },
  { email: 'jesse.nwaigwe@brickslimited.com', role: 'HOD', name: 'Jesse Nwaigwe', dept: 'IT' },
  { email: 'crewing@brickslimited.com', role: 'HOD', name: 'Crewing Dept', dept: 'Crewing' },
  { email: 'mayowa.segun@brickslimited.com', role: 'HOD', name: 'Mayowa Segun', dept: 'Finance' },
  { email: 'hauwa.garba@brickslimited.com', role: 'HOD', name: 'Hauwa Garba', dept: 'Legal' },
  { email: 'jp.ino@brickslimited.com', role: 'HOD', name: 'JP Ino', dept: 'Operations' },
  { email: 'risikat.ibrahim@brickslimited.com', role: 'HOD', name: 'Risikat Ibrahim', dept: 'Admin' },
  { email: 'gloria.theophilus@brickslimited.com', role: 'HOD', name: 'Gloria Theophilus', dept: 'Admin' },

  // --- STAFF / OPERATIONS ---
  { email: 'technical@brickslimited.com', role: 'Staff', name: 'Technical Dept', dept: 'Technical' },
  { email: 'operations@brickslimited.com', role: 'Staff', name: 'Operations Dept', dept: 'Operations' },
  { email: 'training@brickslimited.com', role: 'Staff', name: 'Training Dept', dept: 'Training' },
  { email: 'mariah.buhari@brickslimited.com', role: 'Staff', name: 'Mariah Buhari', dept: 'Admin' },
  { email: 'procurement@brickslimited.com', role: 'Staff', name: 'Procurement Dept', dept: 'Procurement' }
];

const seedDB = async () => {
  try {
    // 1. Connection check
    if (!process.env.MONGO_URI) {
        console.error("❌ Error: MONGO_URI is not defined in .env");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("⚓ Connected to BRICKS DB for heavy-duty seeding...");

    for (const u of usersToCreate) {
      // Normalize email to prevent duplicates based on casing
      const cleanEmail = u.email.toLowerCase().trim();
      
      // Generate password: First Name + 2026!
      const firstName = u.name.split(' ')[0];
      const plainPassword = `${firstName}2026!`; 
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // 2. The Forced Update logic
      const result = await User.findOneAndUpdate(
        { email: cleanEmail }, 
        { 
          $set: { 
            name: u.name, 
            role: u.role, 
            department: u.dept || 'General',
            password: hashedPassword 
          } 
        }, 
        { upsert: true, new: true, runValidators: true }
      );

      console.log(`✅ ${result.role.padEnd(10)} | ${result.email.padEnd(35)} | PW: ${plainPassword}`);
    }

    console.log("\n🚢 DATABASE SYNCED: Roles and credentials have been strictly updated.");
    console.log("👉 Reminder: Log out and clear browser storage to see changes.");
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding Critical Failure:", err);
    process.exit(1);
  }
};

seedDB();

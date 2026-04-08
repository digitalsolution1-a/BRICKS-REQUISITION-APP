const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- 1. Middleware ---
// CRITICAL: We explicitly allow both localhost and the 127.0.0.1 IP 
// to match the Vite frontend request.
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    'http://localhost:3000' // Future-proofing for other dev tools
  ], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); 

// --- 2. Database Connection ---
const connectDB = async () => {
  console.log("⏳ Connecting to BRICKS Database...");
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ BRICKS Database Connected Successfully");
  } catch (err) {
    console.error("❌ Database Connection Error:");
    console.error(`Reason: ${err.message}`);
    console.log("💡 Check: IP Whitelist (0.0.0.0/0) and Credentials in .env");
  }
};

connectDB();

// --- 3. Request Logger ---
app.use((req, res, next) => {
  console.log(`📡 ${req.method} request to: ${req.url}`);
  // Log body for debugging submission issues (remove in production)
  if (req.method === 'POST') console.log('📦 Body:', req.body);
  next();
});

// --- 4. Route Registration ---
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/requisitions', require('./routes/requisition'));
} catch (error) {
  console.warn("⚠️ Route Loading Error: Check folder structure.");
}

// --- 5. Health Check ---
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
  res.status(200).json({
    status: "Active",
    portal: "BRICKS Requisition API",
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// --- 6. Global Error Handling ---
app.use((err, req, res, next) => {
  console.error("🚩 Server Error:", err.stack);
  res.status(500).json({ 
    error: "Internal Server Error", 
    details: err.message 
  });
});

// --- 7. Server Startup ---
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BRICKS Server running on http://localhost:${PORT}`);
  console.log(`🔗 Listening on all local interfaces (0.0.0.0:${PORT})`);
});
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- 1. Middleware ---
// Optimized for Cloud Deployment: Allows Local, Render, and Vercel domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://bricks-requisition-app-12.onrender.com', // Render Frontend
  /\.vercel\.app$/                                  // Any Vercel deployment
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("🚫 CORS Blocked Origin:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
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
    console.log("💡 Check: IP Whitelist (0.0.0.0/0) and Credentials in Render Environment");
  }
};

connectDB();

// --- 3. Request Logger ---
app.use((req, res, next) => {
  console.log(`📡 ${req.method} request to: ${req.url}`);
  if (process.env.NODE_ENV !== 'production' && req.method === 'POST') {
    console.log('📦 Body:', req.body);
  }
  next();
});

// --- 4. Route Registration ---
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/requisitions', require('./routes/requisition'));
} catch (error) {
  console.warn("⚠️ Route Loading Error: Check folder structure or missing route files.");
}

// --- 5. Health Check ---
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
  res.status(200).json({
    status: "Active",
    portal: "BRICKS Requisition API",
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- 6. Global Error Handling ---
app.use((err, req, res, next) => {
  console.error("🚩 Server Error:", err.stack);
  res.status(500).json({ 
    error: "Internal Server Error", 
    details: process.env.NODE_ENV === 'production' ? "Contact IT Support" : err.message 
  });
});

// --- 7. Server Startup ---
const PORT = process.env.PORT || 5000;
// We use 0.0.0.0 for Render/Heroku port binding
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BRICKS Server running on port ${PORT}`);
  console.log(`🔗 Production URL: https://bricks-requisition-app.onrender.com`);
});

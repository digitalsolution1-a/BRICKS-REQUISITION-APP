const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- 1. Middleware ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://bricks-requisition-app-12.onrender.com', // Render Frontend
  /\.vercel\.app$/                                   // Any Vercel deployment
];

app.use(cors({
  origin: function (origin, callback) {
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
  }
};

connectDB();

// --- 3. Request Logger ---
// Useful for debugging 404s - watch your terminal to see the incoming paths
app.use((req, res, next) => {
  console.log(`📡 ${req.method} request to: ${req.url}`);
  next();
});

// --- 4. Route Registration ---
try {
  // Auth Routes
  app.use('/api/auth', require('./routes/auth'));
  console.log("📑 Auth Routes Loaded");

  // Requisition Routes
  app.use('/api/requisitions', require('./routes/requisition'));
  console.log("📑 Requisition Routes Loaded");

  // User Management Routes
  // We register both versions to ensure frontend calls to /users OR /api/users both work
  const userManagementRoutes = require('./routes/user');
  app.use('/api/users', userManagementRoutes);
  app.use('/users', userManagementRoutes); 
  console.log("📑 User Management Routes Loaded (Primary & Alias)");

} catch (error) {
  console.error("⚠️ Route Loading Error:", error.message);
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
    details: process.env.NODE_ENV === 'production' ? "Contact IT Support" : err.message 
  });
});

// --- 7. Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BRICKS Server running on port ${PORT}`);
});

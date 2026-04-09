const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Requisition = require('../models/Requisition');
const sendEmail = require('../utils/mailer');

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- CLOUDINARY STORAGE ENGINE ---
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bricks_requisitions',
    allowed_formats: ['jpg', 'png', 'pdf'],
    resource_type: 'auto', 
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit
});

// 1. GET Pending Requisitions (Filtered by Role for Dashboard)
router.get('/pending/:role', async (req, res) => {
  const { role } = req.params;
  try {
    let query = { status: 'Pending' };

    // Role-specific stage filtering
    if (role === 'HOD') {
      query.currentStage = 'HOD';
    } else if (role === 'FC') {
      query.currentStage = 'FC';
    } else if (role === 'MD') {
      // MD sees standard MD items OR FC items for override capability
      query.currentStage = { $in: ['MD', 'FC'] };
    } else if (role === 'Accountant') {
      query.currentStage = 'ACCOUNTS';
    }

    const pendingRequests = await Requisition.find(query).sort({ createdAt: -1 });
    res.json(pendingRequests);
  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
    res.status(500).json({ error: "Could not retrieve pending requests" });
  }
});

// 2. GET User History (For Profile Page)
router.get('/user/:email', async (req, res) => {
  try {
    const history = await Requisition.find({ 
      requesterEmail: req.params.email 
    }).sort({ createdAt: -1 });
    
    res.json(history);
  } catch (err) {
    console.error("❌ History Fetch Error:", err.message);
    res.status(500).json({ error: "Could not retrieve user history" });
  }
});

// 3. Submit a New Requisition
router.post('/submit', upload.single('document'), async (req, res) => {
  try {
    const newReq = new Requisition({
      requestOption: req.body.requestOption || 'New',
      requesterName: req.body.requesterName,
      requesterEmail: req.body.requesterEmail,
      department: req.body.department,
      hodForApproval: req.body.hodForApproval,
      requestType: req.body.requestType || 'Internal Operation/Request',
      clientName: req.body.clientName === 'Others' ? req.body.otherClient : req.body.clientName,
      procurementType: req.body.procurementType,
      vendorName: req.body.vendorName === 'OTHERS' ? req.body.otherVendor : req.body.vendorName,
      currency: req.body.currency === 'OTHER' ? req.body.otherCurrency : req.body.currency, 
      amount: Number(req.body.amount),
      amountInWords: req.body.amountInWords,
      dueDate: req.body.dueDate,
      modeOfPayment: req.body.modeOfPayment,
      beneficiaryDetails: req.body.beneficiaryDetails || "N/A",
      requestNarrative: req.body.requestNarrative || "N/A",
      attachmentUrl: req.file ? req.file.path : null,
      attachmentName: req.file ? req.file.originalname : null,
      currentStage: 'HOD',
      status: 'Pending',
      createdAt: new Date()
    });

    const savedReq = await newReq.save();
    
    const submissionEmail = `
      <div style="font-family: sans-serif; border: 2px solid #A67C52; padding: 25px; border-radius: 20px; max-width: 600px;">
        <h2 style="color: #A67C52;">New Fleet Requisition</h2>
        <p>A new requisition has been submitted for your professional approval.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
        <p><strong>Requester:</strong> ${savedReq.requesterName} (${savedReq.department})</p>
        <p><strong>Total Amount:</strong> <span style="font-size: 18px; color: #A67C52; font-weight: bold;">${savedReq.currency} ${savedReq.amount.toLocaleString()}</span></p>
        <br/>
        <a href="https://bricks-requisition-app.vercel.app/dashboard" style="background: #A67C52; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 800; display: inline-block; font-size: 12px; text-transform: uppercase;">Review & Approve</a>
      </div>
    `;
    
    await sendEmail(savedReq.hodForApproval, "Action Required: Requisition Approval", submissionEmail);
    res.status(201).json({ msg: "Submitted Successfully", data: savedReq });
  } catch (err) {
    console.error("Submission Error:", err);
    res.status(400).json({ error: "Data Validation Error", details: err.message });
  }
});

// 4. Action Route (Approval/Decline/MD & Admin Override)
router.post('/action/:id', async (req, res) => {
  const { action, comment, actorRole, actorName, isOverride } = req.body; 
  
  try {
    const reqst = await Requisition.findById(req.params.id);
    if (!reqst) return res.status(404).json({ msg: "Requisition not found" });

    // --- HANDLE DECLINE ---
    if (action === 'Declined') {
      reqst.status = 'Declined';
      reqst.approvalHistory.push({ actorRole, actorName, action, comment, date: new Date() });
      await reqst.save();
      
      const declineEmail = `
        <div style="font-family: sans-serif; border: 2px solid #d32f2f; padding: 25px; border-radius: 20px;">
          <h2 style="color: #d32f2f;">Requisition Declined</h2>
          <p>Your request for <strong>${reqst.vendorName}</strong> has been declined.</p>
          <p><strong>Reason:</strong> ${comment || "No comment provided."}</p>
        </div>
      `;
      await sendEmail(reqst.requesterEmail, "Requisition Status: Declined", declineEmail);
      return res.json({ msg: "Requisition Declined" });
    }

    // --- OVERRIDE LOGIC (Admin or MD Bypassing FC) ---
    if (isOverride || (actorRole === 'MD' && reqst.currentStage === 'FC')) {
      const isMD = actorRole === 'MD';
      
      // Admin force-pays, MD force-sends to Accountant
      reqst.currentStage = isMD ? 'ACCOUNTS' : 'PAID';
      reqst.status = isMD ? 'Pending' : 'Paid';
      
      // Specifically capture MD instructions if provided during override
      if (isMD) reqst.mdInstructions = comment;

      reqst.approvalHistory.push({ 
        actorRole, 
        actorName, 
        action: isMD ? 'MD Override (FC Bypass)' : 'Admin Force Approve', 
        comment: `BYPASS OVERRIDE: ${comment}`, 
        date: new Date() 
      });

      await reqst.save();
      return res.json({ msg: isMD ? "MD Override Successful" : "Admin Override Successful" });
    }

    // --- STANDARD WORKFLOW PROGRESSION ---
    const workflow = ['HOD', 'FC', 'MD', 'ACCOUNTS', 'PAID'];
    const currentIndex = workflow.indexOf(reqst.currentStage);
    
    if (currentIndex !== -1 && currentIndex < workflow.length - 1) {
      reqst.currentStage = workflow[currentIndex + 1];
      
      // Save MD instructions specifically during the standard MD stage
      if (actorRole === 'MD') {
        reqst.mdInstructions = comment;
      }

      reqst.approvalHistory.push({ actorRole, actorName, action, comment, date: new Date() });
    }

    if (reqst.currentStage === 'PAID') {
      reqst.status = 'Paid';
    }

    await reqst.save();

    const progressEmail = `
      <div style="font-family: sans-serif; border: 2px solid #A67C52; padding: 25px; border-radius: 20px;">
        <h2 style="color: #A67C52;">Pipeline Update</h2>
        <p>Your requisition for <strong>${reqst.vendorName}</strong> has moved to <strong>${reqst.currentStage}</strong>.</p>
      </div>
    `;
    await sendEmail(reqst.requesterEmail, "Requisition Progress Update", progressEmail);

    res.json({ msg: `Approved! Now at ${reqst.currentStage}`, data: reqst });

  } catch (err) {
    console.error("❌ Action Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

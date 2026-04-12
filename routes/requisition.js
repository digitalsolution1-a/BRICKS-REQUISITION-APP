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
  limits: { fileSize: 10 * 1024 * 1024 } // Increased to 10MB for larger PDFs
});

// 1. GET Pending Requisitions (Filtered by Role & Email)
router.get('/pending/:role', async (req, res) => {
  const { role } = req.params;
  const userEmail = req.query.email;

  try {
    let query = { status: 'Pending' };

    if (role.toUpperCase() === 'HOD' && userEmail) {
      query.currentStage = 'HOD';
      query.hodForApproval = { $regex: new RegExp(`^${userEmail}$`, 'i') };
    } else if (role.toUpperCase() === 'FC') {
      query.currentStage = 'FC';
    } else if (role.toUpperCase() === 'MD') {
      query.currentStage = 'MD';
    } else if (role.toUpperCase() === 'ACCOUNTANT' || role.toUpperCase() === 'ACCOUNTS') {
      query.currentStage = 'ACCOUNTS';
    }

    const pendingRequests = await Requisition.find(query).sort({ createdAt: -1 });
    res.json(pendingRequests);
  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
    res.status(500).json({ error: "Could not retrieve pending requests" });
  }
});

// 2. GET Global History
router.get('/history', async (req, res) => {
  try {
    const history = await Requisition.find({ 
      $or: [
        { status: 'Paid' },
        { status: 'Declined' },
        { currentStage: 'PAID' }
      ]
    }).sort({ updatedAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Could not retrieve history" });
  }
});

// 3. GET User-Specific History
router.get('/user/:userId', async (req, res) => {
  try {
    const history = await Requisition.find({ 
      $or: [
        { requester: req.params.userId },
        { requesterEmail: req.query.email }
      ]
    }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Could not retrieve user history" });
  }
});

// 4. GET Single Requisition
router.get('/single/:id', async (req, res) => {
  try {
    const requisition = await Requisition.findById(req.params.id);
    if (!requisition) return res.status(404).json({ error: "Not found" });
    res.json(requisition);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Submit a New Requisition
router.post('/submit', upload.single('document'), async (req, res) => {
  try {
    const finalClient = req.body.clientName === 'Others' ? req.body.otherClient : req.body.clientName;
    const finalVendor = req.body.vendorName === 'OTHERS' ? req.body.otherVendor : req.body.vendorName;
    const finalCurrency = (req.body.currency === 'OTHER' || req.body.currency === 'Others') ? 'Others' : req.body.currency;

    const newReq = new Requisition({
      requestOption: req.body.requestOption || 'New',
      requester: req.body.requester, 
      requesterName: req.body.requesterName,
      requesterEmail: req.body.requesterEmail,
      department: req.body.department,
      hodForApproval: req.body.hodForApproval,
      requestType: req.body.requestType || 'Internal Operation/Request',
      procurementType: req.body.procurementType || 'Direct Procurement',
      clientName: finalClient || 'N/A',
      vendorName: finalVendor || 'N/A',
      otherClientDetails: req.body.otherClient,
      otherVendorName: req.body.otherVendor,
      currency: finalCurrency, 
      otherCurrency: req.body.otherCurrency,
      amount: Number(req.body.amount),
      amountInWords: req.body.amountInWords,
      dueDate: req.body.dueDate,
      modeOfPayment: req.body.modeOfPayment,
      beneficiaryDetails: req.body.beneficiaryDetails || "N/A",
      requestNarrative: req.body.requestNarrative || "N/A",
      // FIX: Ensure the full Cloudinary secure URL is captured
      attachmentUrl: req.file ? req.file.path : null,
      attachmentName: req.file ? req.file.originalname : null,
      supportingDocument: req.file ? req.file.path : null, // Mirror for safety
      cloudinaryId: req.file ? req.file.filename : null,
      currentStage: 'HOD',
      status: 'Pending'
    });

    const savedReq = await newReq.save();
    
    const submissionEmail = `
      <div style="font-family: sans-serif; border: 2px solid #A67C52; padding: 25px; border-radius: 20px; max-width: 600px;">
        <h2 style="color: #A67C52;">New Requisition Submission</h2>
        <p>A new requisition requires your approval.</p>
        <p><strong>Requester:</strong> ${savedReq.requesterName} (${savedReq.department})</p>
        <p><strong>Vendor:</strong> ${savedReq.vendorName}</p>
        <p><strong>Total Amount:</strong> <span style="font-size: 18px; color: #A67C52; font-weight: bold;">${savedReq.currency} ${savedReq.amount.toLocaleString()}</span></p>
        <br/>
        <a href="https://bricks-requisition-app.vercel.app/dashboard" style="background: #A67C52; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 800; display: inline-block;">Review & Approve</a>
      </div>
    `;
    
    await sendEmail(savedReq.hodForApproval, "Action Required: Requisition Approval", submissionEmail);
    res.status(201).json({ msg: "Submitted Successfully", data: savedReq });
  } catch (err) {
    console.error("Submission Error:", err);
    res.status(400).json({ error: "Data Validation Error", details: err.message });
  }
});

// 6. Action Route
router.post('/action/:id', async (req, res) => {
  const { action, comment, actorRole, actorName, isOverride } = req.body; 
  
  try {
    const reqst = await Requisition.findById(req.params.id);
    if (!reqst) return res.status(404).json({ msg: "Requisition not found" });

    if (action === 'Declined' || action === 'Rejected') {
      reqst.status = 'Declined';
      reqst.approvalHistory.push({ actorRole, actorName, action, comment });
      await reqst.save();
      
      const declineEmail = `<div style="padding: 20px;"><h2>Requisition Declined</h2><p><strong>Reason:</strong> ${comment}</p></div>`;
      await sendEmail(reqst.requesterEmail, "Requisition Status: Declined", declineEmail);
      return res.json({ msg: "Requisition Declined" });
    }

    const workflow = ['HOD', 'FC', 'MD', 'ACCOUNTS', 'PAID'];
    
    if (isOverride) {
       reqst.currentStage = actorRole === 'MD' ? 'ACCOUNTS' : 'PAID';
    } else {
       const currentIndex = workflow.indexOf(reqst.currentStage);
       if (currentIndex !== -1 && currentIndex < workflow.length - 1) {
         reqst.currentStage = workflow[currentIndex + 1];
       }
    }

    if (actorRole === 'MD') reqst.mdInstructions = comment;

    if (reqst.currentStage === 'PAID' || action === 'Paid') {
      reqst.status = 'Paid';
      reqst.currentStage = 'PAID';
      reqst.disbursementDate = new Date();
    }

    reqst.approvalHistory.push({ actorRole, actorName, action, comment });
    await reqst.save();

    res.json({ msg: `Action successful: ${action}`, data: reqst });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

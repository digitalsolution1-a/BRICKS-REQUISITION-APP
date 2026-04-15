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
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// 1. GET Pending Requisitions (Filtered by Role & Email)
router.get('/pending/:role', async (req, res) => {
  const { role } = req.params;
  const userEmail = req.query.email;

  try {
    let query = { status: 'Pending' };
    const roleUpper = role.toUpperCase();

    if (roleUpper === 'HOD' && userEmail) {
      query.currentStage = 'HOD';
      query.hodForApproval = { $regex: new RegExp(`^${userEmail}$`, 'i') };
    } else if (roleUpper === 'FC') {
      query.currentStage = 'FC';
    } else if (roleUpper === 'MD') {
      query.currentStage = 'MD';
    } else if (roleUpper === 'ACCOUNTANT' || roleUpper === 'ACCOUNTS') {
      query.currentStage = 'ACCOUNTS';
    }

    const pendingRequests = await Requisition.find(query).sort({ createdAt: -1 });
    res.json(pendingRequests);
  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
    res.status(500).json({ error: "Could not retrieve pending requests" });
  }
});

// 2. GET Role-Specific History (Dashboard History Tabs)
router.get('/history/:role', async (req, res) => {
  const { role } = req.params;
  try {
    // Finds items that are finalized (Paid/Declined) OR that this specific role has touched
    const history = await Requisition.find({
      $or: [
        { status: { $in: ['Paid', 'Declined'] } },
        { approvalHistory: { $elemMatch: { actorRole: role.toUpperCase() } } }
      ]
    }).sort({ updatedAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Could not retrieve history" });
  }
});

// 3. GET User-Specific History (For the Requester)
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

// 5. Submit a New Requisition (Matches Sections 1-3 of your Model)
router.post('/submit', upload.single('document'), async (req, res) => {
  try {
    const { 
      requestOption, requester, requesterName, requesterEmail, 
      department, hodForApproval, requestType, procurementType,
      clientName, vendorName, otherClient, otherVendor, 
      currency, otherCurrency, amount, amountInWords, 
      dueDate, modeOfPayment, beneficiaryDetails, requestNarrative 
    } = req.body;

    const newReq = new Requisition({
      requestOption: requestOption || 'New',
      requester, requesterName, requesterEmail, department, hodForApproval,
      requestType: requestType || 'Internal Operation/Request',
      procurementType: procurementType || 'Direct Procurement',
      clientName: clientName === 'Others' ? otherClient : clientName,
      vendorName: vendorName === 'OTHERS' ? otherVendor : vendorName,
      otherClientDetails: otherClient,
      otherVendorName: otherVendor,
      currency, otherCurrency,
      amount: Number(amount),
      amountInWords, dueDate, modeOfPayment,
      beneficiaryDetails: beneficiaryDetails || "N/A",
      requestNarrative: requestNarrative || "N/A",
      // File Handling
      attachmentUrl: req.file ? req.file.path : null,
      attachmentName: req.file ? req.file.originalname : null,
      supportingDocument: req.file ? req.file.path : null, 
      cloudinaryId: req.file ? req.file.filename : null,
      // Initial Stage
      currentStage: 'HOD',
      status: 'Pending'
    });

    const savedReq = await newReq.save();
    
    // Notification Email Logic
    const submissionEmail = `
      <div style="font-family: sans-serif; border: 2px solid #A67C52; padding: 25px; border-radius: 20px; max-width: 600px;">
        <h2 style="color: #A67C52;">New Requisition Submission</h2>
        <p>A new requisition requires your approval.</p>
        <p><strong>Requester:</strong> ${savedReq.requesterName}</p>
        <p><strong>Amount:</strong> ${savedReq.currency} ${savedReq.amount.toLocaleString()}</p>
        <br/>
        <a href="https://bricks-requisition-app.vercel.app/dashboard" style="background: #A67C52; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Review & Approve</a>
      </div>
    `;
    
    await sendEmail(savedReq.hodForApproval, "Action Required: Requisition Approval", submissionEmail);
    res.status(201).json({ msg: "Submitted Successfully", data: savedReq });
  } catch (err) {
    console.error("Submission Error:", err);
    res.status(400).json({ error: "Data Validation Error", details: err.message });
  }
});

// 6. Action Route (The Logic for HOD -> FC -> MD -> ACCOUNTS -> PAID)
router.post('/action/:id', async (req, res) => {
  const { action, comment, actorRole, actorName, isOverride, paymentReference } = req.body; 
  
  try {
    const reqst = await Requisition.findById(req.params.id);
    if (!reqst) return res.status(404).json({ msg: "Requisition not found" });

    // Handle Declines/Rejections
    if (action === 'Declined' || action === 'Rejected') {
      reqst.status = 'Declined';
      reqst.approvalHistory.push({ actorRole, actorName, action, comment });
      await reqst.save();
      
      const declineEmail = `<div style="padding: 20px; font-family: sans-serif;"><h2>Requisition Declined</h2><p><strong>Reason:</strong> ${comment}</p></div>`;
      await sendEmail(reqst.requesterEmail, "Requisition Status: Declined", declineEmail);
      return res.json({ msg: "Requisition Declined" });
    }

    // Workflow Stages: HOD -> FC -> MD -> ACCOUNTS -> PAID
    const workflow = ['HOD', 'FC', 'MD', 'ACCOUNTS', 'PAID'];
    
    // Check for MD Executive Override
    if (isOverride && actorRole.toUpperCase() === 'MD') {
       reqst.currentStage = 'ACCOUNTS';
    } else {
       const currentIndex = workflow.indexOf(reqst.currentStage);
       if (currentIndex !== -1 && currentIndex < workflow.length - 1) {
         reqst.currentStage = workflow[currentIndex + 1];
       }
    }

    // Save MD instructions to the specific field in Section 5
    if (actorRole.toUpperCase() === 'MD') {
        reqst.mdInstructions = comment || 'Final authorization granted.';
    }

    // Save Payment Reference if provided (from Accountant Dashboard)
    if (paymentReference) {
        reqst.paymentReference = paymentReference;
    }

    // Final Stage Check: If Accountant marks as 'Paid'
    if (reqst.currentStage === 'PAID' || action === 'Paid') {
      reqst.status = 'Paid';
      reqst.currentStage = 'PAID';
      reqst.disbursementDate = new Date();
    }

    // Update History (Section 6)
    reqst.approvalHistory.push({ 
        actorRole, 
        actorName, 
        action: action === 'Paid' ? 'Paid' : 'Approved', 
        comment 
    });

    await reqst.save();
    res.json({ msg: `Action successful: ${action}`, data: reqst });

  } catch (err) {
    console.error("Action Route Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

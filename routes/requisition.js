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

// 2. GET Role-Specific History
router.get('/history/:role', async (req, res) => {
  const { role } = req.params;
  try {
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

// 4. GET All Requisitions
router.get('/all', async (req, res) => {
  try {
    const allRequests = await Requisition.find({}).sort({ createdAt: -1 });
    res.json(allRequests);
  } catch (err) {
    console.error("❌ Global Fetch Error:", err.message);
    res.status(500).json({ error: "Could not retrieve global department records" });
  }
});

// 5. GET Single Requisition
router.get('/single/:id', async (req, res) => {
  try {
    const requisition = await Requisition.findById(req.params.id);
    if (!requisition) return res.status(404).json({ error: "Not found" });
    res.json(requisition);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 6. Submit a New Requisition
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
      attachmentUrl: req.file ? req.file.path : null,
      attachmentName: req.file ? req.file.originalname : null,
      supportingDocument: req.file ? req.file.path : null, 
      cloudinaryId: req.file ? req.file.filename : null,
      currentStage: 'HOD',
      status: 'Pending'
    });

    const savedReq = await newReq.save();
    
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

// 7. Action Route
router.post('/action/:id', async (req, res) => {
  const { action, comment, actorRole, actorName, isOverride, paymentReference } = req.body; 
  try {
    const reqst = await Requisition.findById(req.params.id);
    if (!reqst) return res.status(404).json({ msg: "Requisition not found" });

    if (actorRole.toUpperCase() === 'FC' && reqst.currentStage !== 'FC' && action !== 'Declined') {
      reqst.approvalHistory.push({ actorRole, actorName, action: 'Commented', comment: comment || 'FC viewed master record.' });
      await reqst.save();
      return res.json({ msg: "Log updated", data: reqst });
    }

    if (action === 'Declined' || action === 'Rejected') {
      reqst.status = 'Declined';
      reqst.approvalHistory.push({ actorRole, actorName, action, comment });
      await reqst.save();
      const declineEmail = `<div style="padding: 20px; font-family: sans-serif;"><h2>Requisition Declined</h2><p><strong>Reason:</strong> ${comment}</p></div>`;
      await sendEmail(reqst.requesterEmail, "Requisition Status: Declined", declineEmail);
      return res.json({ msg: "Requisition Declined" });
    }

    const workflow = ['HOD', 'FC', 'MD', 'ACCOUNTS', 'PAID'];
    if (isOverride && actorRole.toUpperCase() === 'MD') {
       reqst.currentStage = 'ACCOUNTS';
    } else {
       const currentIndex = workflow.indexOf(reqst.currentStage);
       if (currentIndex !== -1 && currentIndex < workflow.length - 1) {
          reqst.currentStage = workflow[currentIndex + 1];
       }
    }

    if (actorRole.toUpperCase() === 'MD') reqst.mdInstructions = comment || 'Final authorization granted.';
    if (paymentReference) reqst.paymentReference = paymentReference;
    if (reqst.currentStage === 'PAID' || action === 'Paid') {
      reqst.status = 'Paid';
      reqst.currentStage = 'PAID';
      reqst.disbursementDate = new Date();
    }

    reqst.approvalHistory.push({ actorRole, actorName, action: action === 'Paid' ? 'Paid' : 'Approved', comment });
    await reqst.save();
    res.json({ msg: `Action successful: ${action}`, data: reqst });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Resubmit Declined Requisition
router.put('/resubmit/:id', async (req, res) => {
  try {
    const reqst = await Requisition.findById(req.params.id);
    if (!reqst || reqst.status !== 'Declined') return res.status(400).json({ error: "Requisition not found or not in Declined status" });

    const { amount, requestNarrative, hodForApproval, clientName, vendorName, dueDate } = req.body;

    reqst.amount = amount || reqst.amount;
    reqst.requestNarrative = requestNarrative || reqst.requestNarrative;
    reqst.hodForApproval = hodForApproval || reqst.hodForApproval;
    reqst.clientName = clientName || reqst.clientName;
    reqst.vendorName = vendorName || reqst.vendorName;
    reqst.dueDate = dueDate || reqst.dueDate;
    
    reqst.status = 'Pending';
    reqst.currentStage = 'HOD';
    reqst.approvalHistory.push({
      actorRole: 'Requester',
      actorName: reqst.requesterName,
      action: 'Resubmitted',
      comment: 'Updated and resubmitted.'
    });

    await reqst.save();
    await sendEmail(reqst.hodForApproval, "Action Required: Resubmitted Requisition", "A declined request has been updated and requires your review.");
    res.json({ msg: "Requisition resubmitted successfully", data: reqst });
  } catch (err) {
    res.status(500).json({ error: "Resubmission failed" });
  }
});

module.exports = router;

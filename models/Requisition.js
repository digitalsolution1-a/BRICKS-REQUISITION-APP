const mongoose = require('mongoose');

const RequisitionSchema = new mongoose.Schema({
  // Section 1: Basic Info
  requestOption: { type: String, default: 'Fresh' }, 
  requester: { type: String, required: true }, 
  requesterEmail: { type: String, required: true },
  requesterName: { type: String, required: true },
  requestDate: { type: Date, default: Date.now },
  department: { type: String, required: true },
  hodForApproval: { type: String, required: true }, 

  // Section 2: Procurement Details
  requestType: { type: String, default: 'Internal' }, 
  clientName: { type: String }, 
  otherClientDetails: { type: String }, 
  procurementType: { type: String },
  vendorName: { type: String },
  otherVendorName: { type: String },

  // Section 3: Payment & Narrative
  modeOfPayment: { type: String },
  beneficiaryDetails: { type: String, required: true, default: 'N/A' },
  currency: { type: String, enum: ['USD', 'NGN', 'Naira', 'Others'], required: true, default: 'NGN' },
  otherCurrency: String,
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  requestNarrative: { type: String, required: true },

  // --- UPDATED FILE ATTACHMENT FIELDS ---
  attachmentUrl: { type: String },   // Path to the file on the server (e.g., /uploads/123-file.pdf)
  attachmentName: { type: String },  // Original name for display (e.g., invoice.pdf)
  supportingDocument: { type: String }, // Kept for backward compatibility if needed

  // Section 4: Workflow Tracking
  currentStage: { 
    type: String, 
    enum: ['HOD', 'FC', 'MD', 'ACCOUNTS', 'PAID'], 
    default: 'HOD' 
  },
  status: { type: String, enum: ['Pending', 'Approved', 'Declined', 'Paid'], default: 'Pending' },
  
  // Section 5: History
  approvalHistory: [{
    actorRole: String,
    actorName: String,
    action: String, 
    comment: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Requisition', RequisitionSchema);
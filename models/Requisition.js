const mongoose = require('mongoose');

const RequisitionSchema = new mongoose.Schema({
  // Section 1: Basic Info
  requestOption: { 
    type: String, 
    default: 'New' 
  }, 
  requester: { 
    type: String, 
    required: true 
  }, 
  requesterEmail: { 
    type: String, 
    required: true 
  },
  requesterName: { 
    type: String, 
    required: true 
  },
  requestDate: { 
    type: Date, 
    default: Date.now 
  },
  department: { 
    type: String, 
    required: true 
  },
  hodForApproval: { 
    type: String, 
    required: true 
  }, 

  // Section 2: Procurement Details
  requestType: { 
    type: String, 
    default: 'Internal Operation/Request' 
  }, 
  clientName: { 
    type: String, 
    default: 'N/A' 
  }, 
  otherClientDetails: { 
    type: String 
  }, 
  procurementType: { 
    type: String, 
    default: 'Direct Procurement' 
  },
  vendorName: { 
    type: String, 
    default: 'N/A' 
  },
  otherVendorName: { 
    type: String 
  },

  // Section 3: Payment & Narrative
  modeOfPayment: { 
    type: String, 
    default: 'Cash' 
  },
  beneficiaryDetails: { 
    type: String, 
    required: true, 
    default: 'N/A' 
  },
  currency: { 
    type: String, 
    enum: ['USD', 'NGN', 'Naira', 'Others'], 
    required: true, 
    default: 'NGN' 
  },
  otherCurrency: { 
    type: String 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  amountInWords: { 
    type: String, 
    required: true 
  }, // Fixed: Added to match frontend data
  dueDate: { 
    type: Date, 
    required: true 
  },
  requestNarrative: { 
    type: String, 
    required: true 
  },

  // --- FILE ATTACHMENT FIELDS ---
  attachmentUrl: { type: String },   
  attachmentName: { type: String },  
  supportingDocument: { type: String }, 

  // Section 4: Workflow Tracking
  currentStage: { 
    type: String, 
    enum: ['HOD', 'FC', 'MD', 'ACCOUNTS', 'PAID'], 
    default: 'HOD' 
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Declined', 'Paid'], 
    default: 'Pending' 
  },
  
  // Section 5: Specific Role Instructions
  mdInstructions: { 
    type: String, 
    default: '' 
  },

  // Section 6: History
  approvalHistory: [{
    actorRole: { type: String },
    actorName: { type: String },
    action: { type: String }, 
    comment: { type: String },
    timestamp: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true // Automatically creates createdAt and updatedAt
});

module.exports = mongoose.model('Requisition', RequisitionSchema);

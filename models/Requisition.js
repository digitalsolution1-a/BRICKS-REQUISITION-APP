// 2. UPDATED: GET History (Now includes requisitions that moved past a stage)
router.get('/history/:role', async (req, res) => {
  const { role } = req.params;
  try {
    // Show anything that is No Longer at their stage OR is finalized
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

// 6. UPDATED: Action Route (Enhanced for MD Override & Instruction saving)
router.post('/action/:id', async (req, res) => {
  const { action, comment, actorRole, actorName, isOverride } = req.body; 
  
  try {
    const reqst = await Requisition.findById(req.params.id);
    if (!reqst) return res.status(404).json({ msg: "Requisition not found" });

    // Handle Declines
    if (action === 'Declined' || action === 'Rejected') {
      reqst.status = 'Declined';
      reqst.approvalHistory.push({ actorRole, actorName, action, comment });
      await reqst.save();
      
      const declineEmail = `<div style="padding: 20px;"><h2>Requisition Declined</h2><p><strong>Reason:</strong> ${comment}</p></div>`;
      await sendEmail(reqst.requesterEmail, "Requisition Status: Declined", declineEmail);
      return res.json({ msg: "Requisition Declined" });
    }

    // Workflow Logic
    const workflow = ['HOD', 'FC', 'MD', 'ACCOUNTS', 'PAID'];
    
    if (isOverride) {
       // MD Override pushes it straight to Accounts
       reqst.currentStage = 'ACCOUNTS';
    } else {
       const currentIndex = workflow.indexOf(reqst.currentStage);
       if (currentIndex !== -1 && currentIndex < workflow.length - 1) {
         reqst.currentStage = workflow[currentIndex + 1];
       }
    }

    // Special: Capture MD instructions in the specific field
    if (actorRole === 'MD') {
        reqst.mdInstructions = comment;
    }

    // Final Stage Check
    if (reqst.currentStage === 'PAID' || action === 'Paid') {
      reqst.status = 'Paid';
      reqst.currentStage = 'PAID';
      reqst.disbursementDate = new Date();
    }

    // Record in History
    reqst.approvalHistory.push({ actorRole, actorName, action, comment });
    await reqst.save();

    res.json({ msg: `Action successful: ${action}`, data: reqst });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

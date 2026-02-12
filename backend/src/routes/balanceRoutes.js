const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const balanceController = require('../controllers/balanceController');
const { protect, authorize } = require('../middleware/auth');

// Validation
const validateTransfer = [
  body('receiverId').isMongoId(),
  body('amount').isFloat({ min: 1 }),
  body('description').optional().trim().escape()
];

const validateRecharge = [
  body('amount').isFloat({ min: 1 })
];

// Routes
router.get('/balance', protect, balanceController.getBalance);
router.get('/statement', protect, balanceController.getBalanceStatement);
router.get('/history', protect, balanceController.getTransferHistory);

router.post('/transfer', protect, validateTransfer, balanceController.transferBalance);
router.post('/recharge', protect, authorize('owner'), validateRecharge, balanceController.selfRecharge);

module.exports = router;
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Validation
const validateAdminCredit = [
  body('userId').isMongoId(),
  body('amount').isFloat({ min: 1 }),
  body('description').optional().trim().escape()
];

// Admin routes (only for admin and owner)
router.get('/users', protect, authorize('admin', 'owner'), adminController.getAllUsers);
router.get('/next-level', protect, authorize('admin', 'owner'), adminController.getAllNextLevelUsers);
router.get('/hierarchy/:userId', protect, authorize('admin', 'owner'), adminController.getUserDownlineHierarchy);
router.get('/summary', protect, authorize('admin', 'owner'), adminController.getBalanceSummary);

router.post('/credit', protect, authorize('admin', 'owner'), validateAdminCredit, adminController.adminCreditBalance);
router.put('/toggle-status/:userId', protect, authorize('admin', 'owner'), adminController.toggleUserStatus);

module.exports = router;
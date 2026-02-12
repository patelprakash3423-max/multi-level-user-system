const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Validation
const validateCreateUser = [
  body('username').trim().isLength({ min: 3 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

const validateChangePassword = [
  body('userId').isMongoId(),
  body('newPassword').isLength({ min: 6 })
];

// Routes
router.get('/downline', protect, userController.getDownline);
router.get('/downline/direct', protect, userController.getDirectDownline);
router.get('/profile', protect, userController.getUserProfile);
router.get('/search', protect, userController.searchInDownline);

router.post('/create', protect, validateCreateUser, userController.createNextLevelUser);
router.put('/change-password', protect, validateChangePassword, userController.changeNextLevelUserPassword);

module.exports = router;
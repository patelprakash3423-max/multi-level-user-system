const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const CaptchaService = require('../services/captchaService');
const { protect } = require('../middleware/auth');

// Validation
const validateRegistration = [
  body('username').trim().isLength({ min: 3 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('parentId').optional().isMongoId()
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('captchaText').notEmpty().trim(),
  body('sessionId').notEmpty().trim()
];

// Routes
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', protect, authController.getCurrentUser);

// CAPTCHA endpoint
// CAPTCHA endpoint
// CAPTCHA endpoint
router.get('/captcha', async (req, res) => {
  try {
    const captcha = await CaptchaService.createCaptcha();

    res.json({
      success: true,
      data: {
        sessionId: captcha.sessionId,

        // ✅ SEND SVG IMAGE NOT TEXT
        captchaImage: `data:image/svg+xml;base64,${Buffer.from(captcha.captchaImage).toString('base64')}`,

        expiresAt: captcha.expiresAt
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});



module.exports = router;
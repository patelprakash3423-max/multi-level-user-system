const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const CaptchaService = require('../services/captchaService');
const { validationResult } = require('express-validator');

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { username, email, password, parentId } = req.body;
      const { user } = req;

      // Check if user exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or username already exists'
        });
      }

      // Determine parent and level
      let parent = null;
      let level = 0;
      let role = 'user';

      if (parentId) {
        parent = await User.findById(parentId);
        if (!parent) {
          return res.status(404).json({
            success: false,
            message: 'Parent user not found'
          });
        }
        level = parent.level + 1;
      } else if (user && user.role === 'admin') {
        // Admin can create level 1 users without parent
        level = 1;
      } else if (user && user.role === 'owner') {
        // Owner can create admin
        role = 'admin';
      } else {
        // First user becomes owner
        const userCount = await User.countDocuments();
        if (userCount === 0) {
          role = 'owner';
        }
      }

      // Create new user
      const newUser = new User({
        username,
        email,
        password,
        role,
        parentId: parent ? parent._id : null,
        level,
        balance: 0
      });

      await newUser.save();

      // Update parent's downline count
      if (parent) {
        parent.downlineCount += 1;
        await parent.save();
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          level: newUser.level,
          parentId: newUser.parentId
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration'
      });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { email, password, captchaText, sessionId } = req.body;

      // Verify CAPTCHA
      const captchaResult = await CaptchaService.verifyCaptcha(sessionId, captchaText);
      if (!captchaResult.success) {
        return res.status(400).json({
          success: false,
          message: captchaResult.message
        });
      }

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Set cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            level: user.level,
            balance: user.balance,
            parentId: user.parentId
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login'
      });
    }
  },

  // Logout user
  logout: (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  },

  // Refresh token
  refreshToken: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'No refresh token provided'
        });
      }

      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const newAccessToken = generateAccessToken(user._id, user.role);
      
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  },

  // Get current user
  getCurrentUser: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select('-password')
        .populate('parentId', 'username email');
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};

module.exports = authController;
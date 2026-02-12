const User = require('../models/User');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const userController = {
  // Get user's downline (all levels)
  getDownline: async (req, res) => {
    try {
      const userId = req.user._id;
      const { level = null } = req.query;

      // Get all downline users recursively
      const getDownlineRecursive = async (parentId, currentLevel = 0) => {
        const users = await User.find({ parentId })
          .select('username email role level balance createdAt parentId downlineCount')
          .lean();

        const result = [];
        
        for (const user of users) {
          const userObj = {
            ...user,
            level: currentLevel + 1,
            children: []
          };

          // If we need specific level or all levels
          if (!level || currentLevel + 1 < level) {
            userObj.children = await getDownlineRecursive(user._id, currentLevel + 1);
          }

          result.push(userObj);
        }

        return result;
      };

      const downline = await getDownlineRecursive(userId);
      
      // Also get direct children count
      const directChildren = await User.find({ parentId: userId }).countDocuments();
      const totalDownline = await User.countDocuments({
        $or: [
          { parentId: userId },
          { 'parentId.parentId': userId }
        ]
      });

      res.json({
        success: true,
        data: {
          downline,
          stats: {
            directChildren,
            totalDownline
          }
        }
      });
    } catch (error) {
      console.error('Get downline error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Create next level user
  createNextLevelUser: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { username, email, password } = req.body;
      const parentId = req.user._id;
      const parentLevel = req.user.level;

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

      // Create new user at next level
      const newUser = new User({
        username,
        email,
        password,
        role: 'user',
        parentId,
        level: parentLevel + 1,
        balance: 0
      });

      await newUser.save();

      // Update parent's downline count
      await User.findByIdAndUpdate(parentId, {
        $inc: { downlineCount: 1 }
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          level: newUser.level,
          parentId: newUser.parentId
        }
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Change password of next level user
  changeNextLevelUserPassword: async (req, res) => {
    try {
      const { userId, newPassword } = req.body;
      const currentUserId = req.user._id;

      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if the user is in current user's next level
      if (user.parentId.toString() !== currentUserId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only change password for your direct downline users'
        });
      }

      // Update password
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Get user profile
  getUserProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select('-password')
        .populate('parentId', 'username email');
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Get direct next level users
  getDirectDownline: async (req, res) => {
    try {
      const users = await User.find({ parentId: req.user._id })
        .select('username email role level balance createdAt downlineCount')
        .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get direct downline error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Search in downline
  searchInDownline: async (req, res) => {
    try {
      const { search } = req.query;
      const currentUserId = req.user._id;

      // Get all downline user IDs (including nested)
      const getDownlineUserIds = async (parentId) => {
        const users = await User.find({ parentId }).select('_id');
        let userIds = users.map(user => user._id);
        
        for (const user of users) {
          const childIds = await getDownlineUserIds(user._id);
          userIds = [...userIds, ...childIds];
        }
        
        return userIds;
      };

      const downlineUserIds = await getDownlineUserIds(currentUserId);

      // Search in downline
      const searchQuery = {
        _id: { $in: downlineUserIds },
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };

      const users = await User.find(searchQuery)
        .select('username email role level balance parentId createdAt')
        .populate('parentId', 'username')
        .limit(50);

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Search downline error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};

module.exports = userController;
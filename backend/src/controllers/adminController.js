const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');

const adminController = {
  // Get all next level users (for admin)
  getAllNextLevelUsers: async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Get all level 1 users
      const users = await User.find({ level: 1 })
        .select('username email role level balance parentId createdAt downlineCount')
        .populate('parentId', 'username email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get next level users error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Get complete downline hierarchy of any user
  getUserDownlineHierarchy: async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const { userId } = req.params;

      // Get user
      const user = await User.findById(userId)
        .select('username email role level balance parentId')
        .populate('parentId', 'username email');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get complete downline recursively
      const getCompleteDownline = async (parentId) => {
        const users = await User.find({ parentId })
          .select('username email role level balance parentId downlineCount')
          .lean();

        const result = [];
        
        for (const user of users) {
          const userObj = {
            ...user,
            children: await getCompleteDownline(user._id)
          };
          result.push(userObj);
        }

        return result;
      };

      const downline = await getCompleteDownline(userId);

      res.json({
        success: true,
        data: {
          user,
          downline
        }
      });
    } catch (error) {
      console.error('Get user hierarchy error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Admin credit balance to any user
  adminCreditBalance: async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId, amount, description = 'Admin credit' } = req.body;

      // Start transaction session
      const session = await User.startSession();
      session.startTransaction();

      try {
        // Get receiver and their parent
        const receiver = await User.findById(userId).session(session);
        if (!receiver) {
          throw new Error('User not found');
        }

        const parent = await User.findById(receiver.parentId).session(session);
        if (!parent) {
          throw new Error('Parent user not found');
        }

        // Check parent's balance
        if (parent.balance < amount) {
          throw new Error('Parent has insufficient balance');
        }

        if (amount <= 0) {
          throw new Error('Amount must be greater than 0');
        }

        // Update balances
        const parentBalanceBefore = parent.balance;
        const receiverBalanceBefore = receiver.balance;

        parent.balance -= amount;
        receiver.balance += amount;

        await parent.save({ session });
        await receiver.save({ session });

        // Create transaction records
        const parentTransaction = new Transaction({
          sender: parent._id,
          receiver: receiver._id,
          amount,
          type: 'debit',
          description: `Admin transfer to ${receiver.username}: ${description}`,
          balanceBefore: parentBalanceBefore,
          balanceAfter: parent.balance,
          level: Math.abs(parent.level - receiver.level),
          metadata: { adminAction: true, adminId: req.user._id }
        });

        const receiverTransaction = new Transaction({
          sender: parent._id,
          receiver: receiver._id,
          amount,
          type: 'credit',
          description: `Admin credit: ${description}`,
          balanceBefore: receiverBalanceBefore,
          balanceAfter: receiver.balance,
          level: Math.abs(parent.level - receiver.level),
          metadata: { adminAction: true, adminId: req.user._id }
        });

        await parentTransaction.save({ session });
        await receiverTransaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.json({
          success: true,
          message: 'Balance credited successfully',
          data: {
            parent: {
              id: parent._id,
              username: parent.username,
              newBalance: parent.balance
            },
            receiver: {
              id: receiver._id,
              username: receiver.username,
              newBalance: receiver.balance
            },
            amount,
            description
          }
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Admin credit error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get balance summary across all users
  getBalanceSummary: async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Get total balance stats
      const balanceStats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$balance' },
            totalUsers: { $sum: 1 },
            avgBalance: { $avg: '$balance' },
            maxBalance: { $max: '$balance' },
            minBalance: { $min: '$balance' }
          }
        }
      ]);

      // Get balance by level
      const balanceByLevel = await User.aggregate([
        {
          $group: {
            _id: '$level',
            totalBalance: { $sum: '$balance' },
            userCount: { $sum: 1 },
            avgBalance: { $avg: '$balance' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get balance by role
      const balanceByRole = await User.aggregate([
        {
          $group: {
            _id: '$role',
            totalBalance: { $sum: '$balance' },
            userCount: { $sum: 1 },
            avgBalance: { $avg: '$balance' }
          }
        }
      ]);

      // Get recent transactions
      const recentTransactions = await Transaction.find()
        .populate('sender', 'username')
        .populate('receiver', 'username')
        .sort({ createdAt: -1 })
        .limit(10);

      // Get top users by balance
      const topUsers = await User.find()
        .select('username email role level balance')
        .sort({ balance: -1 })
        .limit(10);

      res.json({
        success: true,
        data: {
          summary: balanceStats[0] || {},
          byLevel: balanceByLevel,
          byRole: balanceByRole,
          recentTransactions,
          topUsers
        }
      });
    } catch (error) {
      console.error('Get balance summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Get all users with pagination
  getAllUsers: async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const { page = 1, limit = 20, search = '' } = req.query;
      const skip = (page - 1) * limit;

      const query = {};

      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const users = await User.find(query)
        .select('username email role level balance parentId createdAt isActive')
        .populate('parentId', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Toggle user active status
  toggleUserStatus: async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Cannot deactivate self
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      }

      // Cannot deactivate owner
      if (user.role === 'owner') {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate owner account'
        });
      }

      user.isActive = !user.isActive;
      await user.save();

      res.json({
        success: true,
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          userId: user._id,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};

module.exports = adminController;
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');

const balanceController = {
  // Get user balance
  getBalance: async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select('balance');
      
      res.json({
        success: true,
        data: {
          balance: user.balance
        }
      });
    } catch (error) {
      console.error('Get balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Get balance statement (transactions)
  getBalanceStatement: async (req, res) => {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 20, type } = req.query;
      const skip = (page - 1) * limit;

      const query = {
        $or: [{ sender: userId }, { receiver: userId }]
      };

      if (type) {
        query.type = type;
      }

      const transactions = await Transaction.find(query)
        .populate('sender', 'username email')
        .populate('receiver', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Transaction.countDocuments(query);

      // Calculate summary
      const summary = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          },
          summary
        }
      });
    } catch (error) {
      console.error('Get statement error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Transfer balance to next level user
  transferBalance: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { receiverId, amount, description = '' } = req.body;
      const senderId = req.user._id;

      // Start transaction session
      const session = await User.startSession();
      session.startTransaction();

      try {
        // Get sender and receiver
        const sender = await User.findById(senderId).session(session);
        const receiver = await User.findById(receiverId).session(session);

        if (!receiver) {
          throw new Error('Receiver not found');
        }

        // Check if receiver is in sender's next level
        if (receiver.parentId.toString() !== senderId.toString()) {
          throw new Error('You can only transfer balance to your direct downline users');
        }

        // Check sender's balance
        if (sender.balance < amount) {
          throw new Error('Insufficient balance');
        }

        // Validate amount
        if (amount <= 0) {
          throw new Error('Amount must be greater than 0');
        }

        // Update balances
        const senderBalanceBefore = sender.balance;
        const receiverBalanceBefore = receiver.balance;

        sender.balance -= amount;
        receiver.balance += amount;

        // Save users
        await sender.save({ session });
        await receiver.save({ session });

        // Create transaction records
        const senderTransaction = new Transaction({
          sender: senderId,
          receiver: receiverId,
          amount,
          type: 'debit',
          description: `Transfer to ${receiver.username}`,
          balanceBefore: senderBalanceBefore,
          balanceAfter: sender.balance,
          level: Math.abs(sender.level - receiver.level)
        });

        const receiverTransaction = new Transaction({
          sender: senderId,
          receiver: receiverId,
          amount,
          type: 'credit',
          description: `Transfer from ${sender.username}`,
          balanceBefore: receiverBalanceBefore,
          balanceAfter: receiver.balance,
          level: Math.abs(sender.level - receiver.level)
        });

        await senderTransaction.save({ session });
        await receiverTransaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.json({
          success: true,
          message: 'Balance transferred successfully',
          data: {
            sender: {
              id: sender._id,
              username: sender.username,
              newBalance: sender.balance
            },
            receiver: {
              id: receiver._id,
              username: receiver.username,
              newBalance: receiver.balance
            },
            amount
          }
        });
      } catch (error) {
        // Rollback transaction
        await session.abortTransaction();
        session.endSession();
        
        throw error;
      }
    } catch (error) {
      console.error('Transfer balance error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Self recharge (for owner)
  selfRecharge: async (req, res) => {
    try {
      const { amount } = req.body;
      const userId = req.user._id;

      // Only owner can self recharge
      if (req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only owner can recharge their own balance'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than 0'
        });
      }

      // Start session for transaction
      const session = await User.startSession();
      session.startTransaction();

      try {
        const user = await User.findById(userId).session(session);
        const balanceBefore = user.balance;

        user.balance += amount;
        await user.save({ session });

        // Create transaction record
        const transaction = new Transaction({
          sender: userId,
          receiver: userId,
          amount,
          type: 'recharge',
          description: 'Self recharge',
          balanceBefore,
          balanceAfter: user.balance,
          level: 0
        });

        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.json({
          success: true,
          message: 'Balance recharged successfully',
          data: {
            newBalance: user.balance,
            amount
          }
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      console.error('Self recharge error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // Get transfer history
  getTransferHistory: async (req, res) => {
    try {
      const userId = req.user._id;
      const { type = 'all' } = req.query;

      let query = {};

      if (type === 'sent') {
        query = { sender: userId, type: 'debit' };
      } else if (type === 'received') {
        query = { receiver: userId, type: 'credit' };
      } else {
        query = {
          $or: [
            { sender: userId, type: 'debit' },
            { receiver: userId, type: 'credit' }
          ]
        };
      }

      const transactions = await Transaction.find(query)
        .populate('sender', 'username email')
        .populate('receiver', 'username email')
        .sort({ createdAt: -1 })
        .limit(50);

      // Calculate totals
      const totals = await Transaction.aggregate([
        { $match: { $or: [{ sender: userId }, { receiver: userId }] } },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          transactions,
          totals
        }
      });
    } catch (error) {
      console.error('Get transfer history error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};

module.exports = balanceController;
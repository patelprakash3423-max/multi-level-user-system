const User = require('../models/User');

class HierarchyUtils {
  // Get all downline user IDs (recursive)
  static async getAllDownlineUserIds(parentId) {
    const getIdsRecursive = async (pid) => {
      const users = await User.find({ parentId: pid }).select('_id');
      let userIds = users.map(user => user._id);
      
      for (const user of users) {
        const childIds = await getIdsRecursive(user._id);
        userIds = [...userIds, ...childIds];
      }
      
      return userIds;
    };

    return await getIdsRecursive(parentId);
  }

  // Get downline tree structure
  static async getDownlineTree(parentId, maxDepth = null, currentDepth = 0) {
    if (maxDepth !== null && currentDepth >= maxDepth) {
      return [];
    }

    const users = await User.find({ parentId: parentId })
      .select('username email role level balance parentId downlineCount createdAt')
      .lean();

    const tree = [];
    
    for (const user of users) {
      const node = {
        ...user,
        children: await this.getDownlineTree(user._id, maxDepth, currentDepth + 1)
      };
      tree.push(node);
    }

    return tree;
  }

  // Check if a user is in another user's downline
  static async isInDownline(parentId, childId) {
    if (parentId.toString() === childId.toString()) {
      return true;
    }

    const getChildrenIds = async (pid) => {
      const users = await User.find({ parentId: pid }).select('_id');
      let ids = users.map(u => u._id);
      
      for (const user of users) {
        const childIds = await getChildrenIds(user._id);
        ids = [...ids, ...childIds];
      }
      
      return ids;
    };

    const downlineIds = await getChildrenIds(parentId);
    return downlineIds.some(id => id.toString() === childId.toString());
  }

  // Get user's level path (from root to user)
  static async getUserLevelPath(userId) {
    const path = [];
    
    const getUserPath = async (id) => {
      const user = await User.findById(id)
        .select('username email role level parentId')
        .populate('parentId', 'username');
      
      if (user) {
        path.unshift({
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          level: user.level
        });
        
        if (user.parentId) {
          await getUserPath(user.parentId._id);
        }
      }
    };
    
    await getUserPath(userId);
    return path;
  }

  // Get commission chain (users who get commission from a transaction)
  static async getCommissionChain(userId, depth = 5) {
    const chain = [];
    
    const getChain = async (id, currentDepth) => {
      if (currentDepth >= depth) return;
      
      const user = await User.findById(id)
        .select('username email role level parentId')
        .populate('parentId', 'username email role level');
      
      if (user && user.parentId) {
        chain.push({
          userId: user.parentId._id,
          username: user.parentId.username,
          level: user.parentId.level,
          commissionLevel: currentDepth + 1
        });
        
        await getChain(user.parentId._id, currentDepth + 1);
      }
    };
    
    await getChain(userId, 0);
    return chain;
  }

  // Get statistics for a user's downline
  static async getDownlineStats(userId) {
    const downlineIds = await this.getAllDownlineUserIds(userId);
    
    const stats = await User.aggregate([
      { $match: { _id: { $in: downlineIds } } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalBalance: { $sum: '$balance' },
          byLevel: {
            $push: {
              level: '$level',
              balance: '$balance'
            }
          }
        }
      },
      {
        $project: {
          totalUsers: 1,
          totalBalance: 1,
          levelStats: {
            $reduce: {
              input: '$byLevel',
              initialValue: [],
              in: {
                $let: {
                  vars: {
                    existing: {
                      $filter: {
                        input: '$$value',
                        as: 'stat',
                        cond: { $eq: ['$$stat.level', '$$this.level'] }
                      }
                    }
                  },
                  in: {
                    $cond: {
                      if: { $eq: [{ $size: '$$existing' }, 0] },
                      then: {
                        $concatArrays: [
                          '$$value',
                          [{
                            level: '$$this.level',
                            userCount: 1,
                            totalBalance: '$$this.balance'
                          }]
                        ]
                      },
                      else: {
                        $map: {
                          input: '$$value',
                          as: 'stat',
                          in: {
                            $cond: {
                              if: { $eq: ['$$stat.level', '$$this.level'] },
                              then: {
                                level: '$$stat.level',
                                userCount: { $add: ['$$stat.userCount', 1] },
                                totalBalance: { $add: ['$$stat.totalBalance', '$$this.balance'] }
                              },
                              else: '$$stat'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]);

    return stats[0] || { totalUsers: 0, totalBalance: 0, levelStats: [] };
  }

  // Get all ancestors (parents chain)
  static async getAncestors(userId) {
    const ancestors = [];
    
    const getParentChain = async (id) => {
      const user = await User.findById(id)
        .select('username email role level parentId')
        .populate('parentId', 'username email role level');
      
      if (user && user.parentId) {
        ancestors.push({
          id: user.parentId._id,
          username: user.parentId.username,
          email: user.parentId.email,
          role: user.parentId.role,
          level: user.parentId.level
        });
        
        await getParentChain(user.parentId._id);
      }
    };
    
    await getParentChain(userId);
    return ancestors;
  }
}

module.exports = HierarchyUtils;
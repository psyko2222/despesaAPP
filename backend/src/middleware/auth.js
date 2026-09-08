const jwt = require('jsonwebtoken');
const { db } = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware to check if user has access to shared data
function checkDataAccess(req, res, next) {
  const userId = req.user.id;
  const targetUserId = parseInt(req.params.userId || req.body.user_id || req.query.userId);

  // If no target user ID specified, use current user
  if (!targetUserId || isNaN(targetUserId) || targetUserId === userId) {
    req.dataUserId = userId;
    req.isSharedAccess = false;
    return next();
  }

  // Check if user has access to target user's data
  const share = db.prepare(`
    SELECT * FROM account_shares 
    WHERE (owner_id = ? AND shared_with_id = ? AND status = 'accepted')
       OR (owner_id = ? AND shared_with_id = ? AND status = 'accepted')
  `).get(userId, targetUserId, targetUserId, userId);

  if (!share) {
    return res.status(403).json({ error: 'No access to this data' });
  }

  // Determine permissions
  if (share.owner_id === userId) {
    // User is the owner, full access
    req.dataUserId = userId;
    req.isSharedAccess = false;
    req.permissions = { can_read: true, can_write: true, can_delete: true };
  } else {
    // User is accessing shared data
    req.dataUserId = targetUserId;
    req.isSharedAccess = true;
    req.permissions = {
      can_read: share.can_read === 1,
      can_write: share.can_write === 1,
      can_delete: share.can_delete === 1
    };
  }

  next();
}

// Middleware to check write permission
function requireWriteAccess(req, res, next) {
  if (req.isSharedAccess && !req.permissions.can_write) {
    return res.status(403).json({ error: 'Write access denied' });
  }
  next();
}

// Middleware to check delete permission
function requireDeleteAccess(req, res, next) {
  if (req.isSharedAccess && !req.permissions.can_delete) {
    return res.status(403).json({ error: 'Delete access denied' });
  }
  next();
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = {
  authenticateToken,
  generateToken,
  checkDataAccess,
  requireWriteAccess,
  requireDeleteAccess,
  requireAdmin
};

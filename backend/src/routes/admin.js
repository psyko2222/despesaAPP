const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all pending users
router.get('/users/pending', authenticateToken, requireAdmin, (req, res) => {
  try {
    const pendingUsers = db.prepare(`
      SELECT u.id, u.email, u.created_at, u.status, u.role,
             at.token as approval_token, at.expires_at
      FROM users u
      LEFT JOIN user_approval_tokens at ON u.id = at.user_id AND at.used = 0
      WHERE u.status = 'pending'
      ORDER BY u.created_at DESC
    `).all();

    res.json(pendingUsers);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: 'Failed to get pending users' });
  }
});

// Approve user
router.post('/users/:userId/approve', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;

    // Update user status
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('approved', userId);

    // Mark approval token as used if exists
    db.prepare('UPDATE user_approval_tokens SET used = 1 WHERE user_id = ?').run(userId);

    // Get user details
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);

    res.json({
      message: 'User approved successfully',
      user
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject user
router.post('/users/:userId/reject', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;

    // Update user status
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('rejected', userId);

    // Mark approval token as used if exists
    db.prepare('UPDATE user_approval_tokens SET used = 1 WHERE user_id = ?').run(userId);

    res.json({ message: 'User rejected successfully' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, status, role, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Promote user to admin
router.post('/users/:userId/promote', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;

    // Update user role to admin
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', userId);

    // Get user details
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(userId);

    res.json({
      message: 'User promoted to admin successfully',
      user
    });
  } catch (error) {
    console.error('Promote user error:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

// Demote admin to user
router.post('/users/:userId/demote', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent demoting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    // Check if this is the only admin
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot demote the only admin' });
    }

    // Update user role to user
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('user', userId);

    // Get user details
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(userId);

    res.json({
      message: 'Admin demoted to user successfully',
      user
    });
  } catch (error) {
    console.error('Demote user error:', error);
    res.status(500).json({ error: 'Failed to demote user' });
  }
});

// Delete user
router.delete('/users/:userId', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deleting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Check if this is the only admin
    const userToDelete = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (userToDelete && userToDelete.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only admin' });
      }
    }

    // Delete user (CASCADE will delete related data)
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deleted successfully',
      deletedUserId: userId
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Delete old expenses
router.delete('/expenses/cleanup', authenticateToken, (req, res) => {
  try {
    const { years } = req.query;

    if (!years || isNaN(years)) {
      return res.status(400).json({ error: 'Years parameter is required' });
    }

    const yearsNum = parseInt(years);
    if (yearsNum < 1 || yearsNum > 10) {
      return res.status(400).json({ error: 'Years must be between 1 and 10' });
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsNum);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Delete expenses older than cutoff date for current user
    const result = db.prepare(`
      DELETE FROM expenses
      WHERE user_id = ? AND debit_date < ?
    `).run(req.user.id, cutoffDateStr);

    res.json({
      message: `Deleted ${result.changes} expenses older than ${yearsNum} years`,
      deletedCount: result.changes,
      cutoffDate: cutoffDateStr
    });
  } catch (error) {
    console.error('Cleanup expenses error:', error);
    res.status(500).json({ error: 'Failed to cleanup expenses' });
  }
});

// Get expense cleanup statistics
router.get('/expenses/cleanup/stats', authenticateToken, (req, res) => {
  try {
    const { years } = req.query;

    if (!years || isNaN(years)) {
      return res.status(400).json({ error: 'Years parameter is required' });
    }

    const yearsNum = parseInt(years);
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsNum);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Count expenses that would be deleted
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_to_delete,
        SUM(amount_cents) / 100.0 as total_amount,
        MIN(debit_date) as oldest_date,
        MAX(debit_date) as newest_date
      FROM expenses
      WHERE user_id = ? AND debit_date < ?
    `).get(req.user.id, cutoffDateStr);

    res.json({
      years: yearsNum,
      cutoffDate: cutoffDateStr,
      stats: {
        totalToDelete: stats.total_to_delete || 0,
        totalAmount: stats.total_amount || 0,
        oldestDate: stats.oldest_date,
        newestDate: stats.newest_date
      }
    });
  } catch (error) {
    console.error('Get cleanup stats error:', error);
    res.status(500).json({ error: 'Failed to get cleanup statistics' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db, isPostgres, query, queryOne, run } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all pending users
router.get('/users/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('=== DEBUG: Fetching pending users ===');
    
    // First, let's check all users with their status
    const allUsersSql = 'SELECT id, email, status, role, created_at FROM users ORDER BY created_at DESC';
    const allUsersResult = await query(allUsersSql, []);
    const allUsers = isPostgres ? allUsersResult.rows : allUsersResult;
    console.log('=== DEBUG: All users ===', JSON.stringify(allUsers, null, 2));
    
    // Now get pending users
    const pendingUsersSql = `
      SELECT u.id, u.email, u.created_at, u.status, u.role,
             at.token as approval_token, at.expires_at
      FROM users u
      LEFT JOIN user_approval_tokens at ON u.id = at.user_id AND at.used = 0
      WHERE u.status = 'pending'
      ORDER BY u.created_at DESC
    `;
    const pendingUsersResult = await query(pendingUsersSql, []);
    const pendingUsers = isPostgres ? pendingUsersResult.rows : pendingUsersResult;
    console.log('=== DEBUG: Pending users ===', JSON.stringify(pendingUsers, null, 2));

    res.json(pendingUsers);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: 'Failed to get pending users' });
  }
});

// Approve user
router.post('/users/:userId/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Update user status
    const updateStatusSql = isPostgres
      ? 'UPDATE users SET status = $1 WHERE id = $2'
      : 'UPDATE users SET status = ? WHERE id = ?';
    await run(updateStatusSql, ['approved', userId]);

    // Mark approval token as used if exists
    const updateTokenSql = isPostgres
      ? 'UPDATE user_approval_tokens SET used = 1 WHERE user_id = $1'
      : 'UPDATE user_approval_tokens SET used = 1 WHERE user_id = ?';
    await run(updateTokenSql, [userId]);

    // Get user details
    const userSql = isPostgres
      ? 'SELECT id, email FROM users WHERE id = $1'
      : 'SELECT id, email FROM users WHERE id = ?';
    const user = await queryOne(userSql, [userId]);

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
router.post('/users/:userId/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Update user status
    const updateStatusSql = isPostgres
      ? 'UPDATE users SET status = $1 WHERE id = $2'
      : 'UPDATE users SET status = ? WHERE id = ?';
    await run(updateStatusSql, ['rejected', userId]);

    // Mark approval token as used if exists
    const updateTokenSql = isPostgres
      ? 'UPDATE user_approval_tokens SET used = 1 WHERE user_id = $1'
      : 'UPDATE user_approval_tokens SET used = 1 WHERE user_id = ?';
    await run(updateTokenSql, [userId]);

    res.json({ message: 'User rejected successfully' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sql = `
      SELECT u.id, u.email, u.status, u.role, u.created_at, u.last_login,
             CASE WHEN prr.id IS NOT NULL AND prr.status = 'pending' THEN 1 ELSE 0 END as has_pending_reset
      FROM users u
      LEFT JOIN password_reset_requests prr ON u.id = prr.user_id AND prr.status = 'pending'
      ORDER BY u.created_at DESC
    `;
    const usersResult = await query(sql, []);
    const users = isPostgres ? usersResult.rows : usersResult;

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Promote user to admin
router.post('/users/:userId/promote', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Update user role to admin
    const updateRoleSql = isPostgres
      ? 'UPDATE users SET role = $1 WHERE id = $2'
      : 'UPDATE users SET role = ? WHERE id = ?';
    await run(updateRoleSql, ['admin', userId]);

    // Get user details
    const userSql = isPostgres
      ? 'SELECT id, email, role FROM users WHERE id = $1'
      : 'SELECT id, email, role FROM users WHERE id = ?';
    const user = await queryOne(userSql, [userId]);

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
router.post('/users/:userId/demote', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent demoting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    // Check if this is the only admin
    const adminCountSql = isPostgres
      ? "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      : "SELECT COUNT(*) as count FROM users WHERE role = 'admin'";
    const adminCount = await queryOne(adminCountSql, []);
    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot demote the only admin' });
    }

    // Update user role to user
    const updateRoleSql = isPostgres
      ? 'UPDATE users SET role = $1 WHERE id = $2'
      : 'UPDATE users SET role = ? WHERE id = ?';
    await run(updateRoleSql, ['user', userId]);

    // Get user details
    const userSql = isPostgres
      ? 'SELECT id, email, role FROM users WHERE id = $1'
      : 'SELECT id, email, role FROM users WHERE id = ?';
    const user = await queryOne(userSql, [userId]);

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
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deleting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Check if this is the only admin
    const userSql = isPostgres
      ? 'SELECT role FROM users WHERE id = $1'
      : 'SELECT role FROM users WHERE id = ?';
    const userToDelete = await queryOne(userSql, [userId]);
    if (userToDelete && userToDelete.role === 'admin') {
      const adminCountSql = isPostgres
        ? "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
        : "SELECT COUNT(*) as count FROM users WHERE role = 'admin'";
      const adminCount = await queryOne(adminCountSql, []);
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only admin' });
      }
    }

    // Delete user (CASCADE will delete related data)
    const deleteSql = isPostgres
      ? 'DELETE FROM users WHERE id = $1'
      : 'DELETE FROM users WHERE id = ?';
    const result = await run(deleteSql, [userId]);

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
router.delete('/expenses/cleanup', authenticateToken, async (req, res) => {
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
    const deleteSql = isPostgres
      ? 'DELETE FROM expenses WHERE user_id = $1 AND debit_date < $2'
      : 'DELETE FROM expenses WHERE user_id = ? AND debit_date < ?';
    const result = await run(deleteSql, [req.user.id, cutoffDateStr]);

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
router.get('/expenses/cleanup/stats', authenticateToken, async (req, res) => {
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
    const statsSql = isPostgres
      ? `SELECT
        COUNT(*) as total_to_delete,
        SUM(amount_cents) / 100.0 as total_amount,
        MIN(debit_date) as oldest_date,
        MAX(debit_date) as newest_date
      FROM expenses
      WHERE user_id = $1 AND debit_date < $2`
      : `SELECT
        COUNT(*) as total_to_delete,
        SUM(amount_cents) / 100.0 as total_amount,
        MIN(debit_date) as oldest_date,
        MAX(debit_date) as newest_date
      FROM expenses
      WHERE user_id = ? AND debit_date < ?`;
    const stats = await queryOne(statsSql, [req.user.id, cutoffDateStr]);

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

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db, isPostgres, query, queryOne, run } = require('../models/database');

// Send share invitation
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const ownerId = req.user.id;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user is trying to share with themselves
    const ownerSql = isPostgres
      ? 'SELECT email FROM users WHERE id = $1'
      : 'SELECT email FROM users WHERE id = ?';
    const owner = await queryOne(ownerSql, [ownerId]);
    if (owner.email === email) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    // Find the user to share with
    const targetUserSql = isPostgres
      ? 'SELECT id, email FROM users WHERE email = $1'
      : 'SELECT id, email FROM users WHERE email = ?';
    const targetUser = await queryOne(targetUserSql, [email]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if share already exists
    const existingSql = isPostgres
      ? 'SELECT * FROM account_shares WHERE owner_id = $1 AND shared_with_id = $2'
      : 'SELECT * FROM account_shares WHERE owner_id = ? AND shared_with_id = ?';
    const existing = await queryOne(existingSql, [ownerId, targetUser.id]);

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Account already shared with this user' });
      } else if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Invitation already sent' });
      } else {
        // Rejected, can send new invitation
        const updateSql = isPostgres
          ? 'UPDATE account_shares SET status = $1, updated_at = $2 WHERE id = $3'
          : 'UPDATE account_shares SET status = ?, updated_at = ? WHERE id = ?';
        await run(updateSql, ['pending', new Date().toISOString(), existing.id]);
      }
    } else {
      // Create new share invitation
      const insertSql = isPostgres
        ? 'INSERT INTO account_shares (owner_id, shared_with_id, status, can_read, can_write, can_delete) VALUES ($1, $2, $3, $4, $5, $6)'
        : 'INSERT INTO account_shares (owner_id, shared_with_id, status, can_read, can_write, can_delete) VALUES (?, ?, ?, ?, ?, ?)';
      await run(insertSql, [ownerId, targetUser.id, 'pending', 1, 1, 1]);
    }

    res.json({ 
      message: 'Invitation sent successfully',
      email: targetUser.email
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Get pending invitations for current user
router.get('/invitations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = isPostgres
      ? `SELECT s.*, u.email as owner_email FROM account_shares s JOIN users u ON s.owner_id = u.id WHERE s.shared_with_id = $1 AND s.status = 'pending' ORDER BY s.created_at DESC`
      : `SELECT s.*, u.email as owner_email FROM account_shares s JOIN users u ON s.owner_id = u.id WHERE s.shared_with_id = ? AND s.status = 'pending' ORDER BY s.created_at DESC`;
    const invitations = await query(sql, [userId]);
    res.json(isPostgres ? invitations.rows : invitations);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// Accept invitation
router.post('/accept/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if invitation exists and belongs to user
    const invitationSql = isPostgres
      ? 'SELECT * FROM account_shares WHERE id = $1 AND shared_with_id = $2 AND status = $3'
      : 'SELECT * FROM account_shares WHERE id = ? AND shared_with_id = ? AND status = ?';
    const invitation = await queryOne(invitationSql, [id, userId, 'pending']);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Accept the invitation
    const updateSql = isPostgres
      ? 'UPDATE account_shares SET status = $1, updated_at = $2 WHERE id = $3'
      : 'UPDATE account_shares SET status = ?, updated_at = ? WHERE id = ?';
    await run(updateSql, ['accepted', new Date().toISOString(), id]);

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Reject invitation
router.post('/reject/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if invitation exists and belongs to user
    const invitationSql = isPostgres
      ? 'SELECT * FROM account_shares WHERE id = $1 AND shared_with_id = $2 AND status = $3'
      : 'SELECT * FROM account_shares WHERE id = ? AND shared_with_id = ? AND status = ?';
    const invitation = await queryOne(invitationSql, [id, userId, 'pending']);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Reject the invitation
    const updateSql = isPostgres
      ? 'UPDATE account_shares SET status = $1, updated_at = $2 WHERE id = $3'
      : 'UPDATE account_shares SET status = ?, updated_at = ? WHERE id = ?';
    await run(updateSql, ['rejected', new Date().toISOString(), id]);

    res.json({ message: 'Invitation rejected successfully' });
  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({ error: 'Failed to reject invitation' });
  }
});

// Get active shares (both sent and received)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get shares where user is owner
    const sentSql = isPostgres
      ? `SELECT s.*, u.email as shared_with_email FROM account_shares s JOIN users u ON s.shared_with_id = u.id WHERE s.owner_id = $1 AND s.status = 'accepted' ORDER BY s.created_at DESC`
      : `SELECT s.*, u.email as shared_with_email FROM account_shares s JOIN users u ON s.shared_with_id = u.id WHERE s.owner_id = ? AND s.status = 'accepted' ORDER BY s.created_at DESC`;
    const sentSharesResult = await query(sentSql, [userId]);
    const sentShares = isPostgres ? sentSharesResult.rows : sentSharesResult;

    // Get shares where user is recipient
    const receivedSql = isPostgres
      ? `SELECT s.*, u.email as owner_email FROM account_shares s JOIN users u ON s.owner_id = u.id WHERE s.shared_with_id = $1 AND s.status = 'accepted' ORDER BY s.created_at DESC`
      : `SELECT s.*, u.email as owner_email FROM account_shares s JOIN users u ON s.owner_id = u.id WHERE s.shared_with_id = ? AND s.status = 'accepted' ORDER BY s.created_at DESC`;
    const receivedSharesResult = await query(receivedSql, [userId]);
    const receivedShares = isPostgres ? receivedSharesResult.rows : receivedSharesResult;

    res.json({
      sent: sentShares,
      received: receivedShares
    });
  } catch (error) {
    console.error('Get active shares error:', error);
    res.status(500).json({ error: 'Failed to get active shares' });
  }
});

// Revoke share
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if share exists and user is owner
    const shareSql = isPostgres
      ? 'SELECT * FROM account_shares WHERE id = $1 AND owner_id = $2'
      : 'SELECT * FROM account_shares WHERE id = ? AND owner_id = ?';
    const share = await queryOne(shareSql, [id, userId]);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Delete the share
    const deleteSql = isPostgres
      ? 'DELETE FROM account_shares WHERE id = $1'
      : 'DELETE FROM account_shares WHERE id = ?';
    await run(deleteSql, [id]);

    res.json({ message: 'Share revoked successfully' });
  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// Leave share (for shared users)
router.delete('/leave/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if share exists and user is the recipient
    const shareSql = isPostgres
      ? 'SELECT * FROM account_shares WHERE id = $1 AND shared_with_id = $2'
      : 'SELECT * FROM account_shares WHERE id = ? AND shared_with_id = ?';
    const share = await queryOne(shareSql, [id, userId]);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Delete the share
    const deleteSql = isPostgres
      ? 'DELETE FROM account_shares WHERE id = $1'
      : 'DELETE FROM account_shares WHERE id = ?';
    await run(deleteSql, [id]);

    res.json({ message: 'Left share successfully' });
  } catch (error) {
    console.error('Leave share error:', error);
    res.status(500).json({ error: 'Failed to leave share' });
  }
});

// Update share permissions
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { can_read, can_write, can_delete } = req.body;

    // Check if share exists and user is owner
    const shareSql = isPostgres
      ? 'SELECT * FROM account_shares WHERE id = $1 AND owner_id = $2'
      : 'SELECT * FROM account_shares WHERE id = ? AND owner_id = ?';
    const share = await queryOne(shareSql, [id, userId]);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Update permissions
    const updateSql = isPostgres
      ? 'UPDATE account_shares SET can_read = $1, can_write = $2, can_delete = $3, updated_at = $4 WHERE id = $5'
      : 'UPDATE account_shares SET can_read = ?, can_write = ?, can_delete = ?, updated_at = ? WHERE id = ?';
    await run(updateSql, [
      can_read !== undefined ? (can_read ? 1 : 0) : share.can_read,
      can_write !== undefined ? (can_write ? 1 : 0) : share.can_write,
      can_delete !== undefined ? (can_delete ? 1 : 0) : share.can_delete,
      new Date().toISOString(),
      id
    ]);

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

module.exports = router;
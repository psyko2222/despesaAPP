const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../models/database');

// Send share invitation
router.post('/invite', authenticateToken, (req, res) => {
  try {
    const { email } = req.body;
    const ownerId = req.user.id;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user is trying to share with themselves
    const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(ownerId);
    if (owner.email === email) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    // Find the user to share with
    const targetUser = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if share already exists
    const existing = db.prepare(
      'SELECT * FROM account_shares WHERE owner_id = ? AND shared_with_id = ?'
    ).get(ownerId, targetUser.id);

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Account already shared with this user' });
      } else if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Invitation already sent' });
      } else {
        // Rejected, can send new invitation
        db.prepare(
          'UPDATE account_shares SET status = ?, updated_at = ? WHERE id = ?'
        ).run('pending', new Date().toISOString(), existing.id);
      }
    } else {
      // Create new share invitation
      db.prepare(`
        INSERT INTO account_shares (owner_id, shared_with_id, status, can_read, can_write, can_delete)
        VALUES (?, ?, 'pending', 1, 1, 1)
      `).run(ownerId, targetUser.id);
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
router.get('/invitations', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const invitations = db.prepare(`
      SELECT 
        s.*,
        u.email as owner_email
      FROM account_shares s
      JOIN users u ON s.owner_id = u.id
      WHERE s.shared_with_id = ? AND s.status = 'pending'
      ORDER BY s.created_at DESC
    `).all(userId);

    res.json(invitations);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// Accept invitation
router.post('/accept/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if invitation exists and belongs to user
    const invitation = db.prepare(
      'SELECT * FROM account_shares WHERE id = ? AND shared_with_id = ? AND status = ?'
    ).get(id, userId, 'pending');

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Accept the invitation
    db.prepare(
      'UPDATE account_shares SET status = ?, updated_at = ? WHERE id = ?'
    ).run('accepted', new Date().toISOString(), id);

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Reject invitation
router.post('/reject/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if invitation exists and belongs to user
    const invitation = db.prepare(
      'SELECT * FROM account_shares WHERE id = ? AND shared_with_id = ? AND status = ?'
    ).get(id, userId, 'pending');

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Reject the invitation
    db.prepare(
      'UPDATE account_shares SET status = ?, updated_at = ? WHERE id = ?'
    ).run('rejected', new Date().toISOString(), id);

    res.json({ message: 'Invitation rejected successfully' });
  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({ error: 'Failed to reject invitation' });
  }
});

// Get active shares (both sent and received)
router.get('/active', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Get shares where user is owner
    const sentShares = db.prepare(`
      SELECT 
        s.*,
        u.email as shared_with_email
      FROM account_shares s
      JOIN users u ON s.shared_with_id = u.id
      WHERE s.owner_id = ? AND s.status = 'accepted'
      ORDER BY s.created_at DESC
    `).all(userId);

    // Get shares where user is recipient
    const receivedShares = db.prepare(`
      SELECT 
        s.*,
        u.email as owner_email
      FROM account_shares s
      JOIN users u ON s.owner_id = u.id
      WHERE s.shared_with_id = ? AND s.status = 'accepted'
      ORDER BY s.created_at DESC
    `).all(userId);

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
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if share exists and user is owner
    const share = db.prepare(
      'SELECT * FROM account_shares WHERE id = ? AND owner_id = ?'
    ).get(id, userId);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Delete the share
    db.prepare('DELETE FROM account_shares WHERE id = ?').run(id);

    res.json({ message: 'Share revoked successfully' });
  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// Update share permissions
router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { can_read, can_write, can_delete } = req.body;

    // Check if share exists and user is owner
    const share = db.prepare(
      'SELECT * FROM account_shares WHERE id = ? AND owner_id = ?'
    ).get(id, userId);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Update permissions
    db.prepare(`
      UPDATE account_shares 
      SET can_read = ?, can_write = ?, can_delete = ?, updated_at = ?
      WHERE id = ?
    `).run(
      can_read !== undefined ? (can_read ? 1 : 0) : share.can_read,
      can_write !== undefined ? (can_write ? 1 : 0) : share.can_write,
      can_delete !== undefined ? (can_delete ? 1 : 0) : share.can_delete,
      new Date().toISOString(),
      id
    );

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../models/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { sendPasswordResetEmail, sendUserApprovalNotification } = require('../services/emailService');

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Check if this is the first user (make them admin and auto-approve)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const isFirstUser = userCount.count === 0;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user with pending status (unless first user)
    const status = isFirstUser ? 'approved' : 'pending';
    const role = isFirstUser ? 'admin' : 'user';

    const result = db.prepare(
      'INSERT INTO users (email, password, status, role) VALUES (?, ?, ?, ?)'
    ).run(email, hashedPassword, status, role);

    // Create default settings
    db.prepare(
      'INSERT INTO settings (user_id) VALUES (?)'
    ).run(result.lastInsertRowid);

    // If not first user, create approval token
    if (!isFirstUser) {
      const approvalToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      db.prepare(
        'INSERT INTO user_approval_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
      ).run(result.lastInsertRowid, approvalToken, expiresAt);

      // Get admin emails to notify
      const admins = db.prepare('SELECT email FROM users WHERE role = ? AND status = ?').all('admin', 'approved');
      const adminEmails = admins.map(a => a.email);

      // Send notification emails to admins
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      if (adminEmails.length > 0) {
        try {
          await sendUserApprovalNotification(adminEmails, email, approvalToken, frontendUrl);
          console.log(`Approval notification sent to ${adminEmails.length} admins`);
        } catch (emailError) {
          console.error('Failed to send approval notification:', emailError);
          // Continue with registration even if email fails
        }
      }

      return res.status(201).json({
        message: 'Registration successful. Your account is pending approval.',
        requiresApproval: true,
        approvalToken,
        admins: adminEmails
      });
    }

    const token = generateToken({ id: result.lastInsertRowid, email });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.lastInsertRowid, email, role },
      requiresApproval: false
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is approved
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Account is pending approval or has been rejected' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id);

    const token = generateToken({ id: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, created_at, last_login, role, status FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Approve user via token (for admin approval via email link)
router.post('/approve/:token', (req, res) => {
  try {
    const { token } = req.params;

    // Find valid approval token
    const approvalToken = db.prepare(
      'SELECT * FROM user_approval_tokens WHERE token = ? AND used = 0 AND expires_at > ?'
    ).get(token, new Date().toISOString());

    if (!approvalToken) {
      return res.status(400).json({ error: 'Invalid or expired approval token' });
    }

    // Approve user
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('approved', approvalToken.user_id);

    // Mark token as used
    db.prepare('UPDATE user_approval_tokens SET used = 1 WHERE id = ?').run(approvalToken.id);

    // Get user details
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(approvalToken.user_id);

    res.json({
      message: 'User approved successfully',
      user
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If the email exists, a reset link will be sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour

    // Delete any existing tokens for this user
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    // Insert new token
    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, resetToken, expiresAt);

    // Send email with reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const emailResult = await sendPasswordResetEmail(user.email, resetToken, frontendUrl);

    res.json({
      message: 'Password reset link generated',
      emailSent: emailResult.success,
      email: user.email
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to generate reset link' });
  }
});

// Reset password with token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find valid reset token
    const resetToken = db.prepare(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?'
    ).get(token, new Date().toISOString());

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, resetToken.user_id);

    // Mark token as used
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;

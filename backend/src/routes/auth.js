const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../models/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { sendPasswordResetEmail, sendUserApprovalNotification } = require('../services/emailService');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Register
router.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Já existe uma conta com este email' });
    }

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const isFirstUser = userCount.count === 0;
    const status = isFirstUser ? 'approved' : 'pending';
    const role = isFirstUser ? 'admin' : 'user';
    const hashedPassword = await bcrypt.hash(password, 10);

    const created = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO users (email, password, status, role) VALUES (?, ?, ?, ?)'
      ).run(email, hashedPassword, status, role);

      const userId = result.lastInsertRowid;
      db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);

      let approvalToken = null;
      if (!isFirstUser) {
        approvalToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        db.prepare(
          'INSERT INTO user_approval_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
        ).run(userId, approvalToken, expiresAt);
      }

      return { userId, approvalToken };
    })();

    if (!isFirstUser) {
      const admins = db.prepare('SELECT email FROM users WHERE role = ? AND status = ?').all('admin', 'approved');
      const adminEmails = admins.map((a) => a.email);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      if (adminEmails.length > 0 && created.approvalToken) {
        try {
          await sendUserApprovalNotification(adminEmails, email, created.approvalToken, frontendUrl);
        } catch (emailError) {
          console.error('Failed to send approval notification:', emailError);
        }
      }

      return res.status(201).json({
        message: 'Conta criada. Fica pendente de aprovação.',
        requiresApproval: true,
      });
    }

    res.status(201).json({
      message: 'Conta criada com sucesso.',
      requiresApproval: false,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Não foi possível criar a conta' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password são obrigatórios' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou password incorrectos' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'A conta está pendente de aprovação' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou password incorrectos' });
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
    res.status(500).json({ error: 'Não foi possível iniciar sessão' });
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
      return res.status(400).json({ error: 'Link de aprovação inválido ou expirado' });
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
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ error: 'O email é obrigatório' });
    }

    const genericMessage = 'Se existir uma conta com este email, enviámos um link de recuperação.';
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.json({ message: genericMessage, emailSent: true });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, resetToken, expiresAt);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const emailResult = await sendPasswordResetEmail(user.email, resetToken, frontendUrl);

    if (!emailResult.success) {
      console.error('Password reset email was not sent:', emailResult.message);
      return res.status(503).json({
        error: 'Não foi possível enviar o email de recuperação. Tente mais tarde ou contacte o administrador.',
      });
    }

    res.json({ message: genericMessage, emailSent: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Não foi possível gerar o link de recuperação' });
  }
});

// Reset password with token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });
    }

    // Find valid reset token
    const resetToken = db.prepare(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?'
    ).get(token, new Date().toISOString());

    if (!resetToken) {
      return res.status(400).json({ error: 'Link de recuperação inválido ou expirado' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, resetToken.user_id);

    // Mark token as used
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

    res.json({ message: 'Password redefinida com sucesso' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Não foi possível redefinir a password' });
  }
});

module.exports = router;

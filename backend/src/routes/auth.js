const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, isPostgres, query, queryOne, run, transaction } = require('../models/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { sendPasswordResetEmail, sendUserApprovalNotification, isEmailConfigured } = require('../services/emailService');
const { logError } = require('../services/logger');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt started');
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    console.log('Email:', email);

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email e password são obrigatórios' });
    }

    if (password.length < 6) {
      console.log('Password too short');
      return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });
    }

    console.log('Checking for existing user...');
    const existingUser = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      console.log('User already exists:', existingUser);
      return res.status(409).json({ error: 'Já existe uma conta com este email' });
    }

    console.log('Counting users...');
    const userCount = await queryOne('SELECT COUNT(*) as count FROM users');
    console.log('User count:', userCount);
    const isFirstUser = userCount.count === 0;
    const status = isFirstUser ? 'approved' : 'pending';
    const role = isFirstUser ? 'admin' : 'user';
    console.log('User will be:', { status, role, isFirstUser });
    
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Starting transaction...');
    const created = await transaction(async (client) => {
      console.log('Inserting user...');
      const insertQuery = isPostgres 
        ? 'INSERT INTO users (email, password, status, role) VALUES ($1, $2, $3, $4) RETURNING id'
        : 'INSERT INTO users (email, password, status, role) VALUES (?, ?, ?, ?)';
      
      let userId;
      if (isPostgres) {
        const result = await client.query(insertQuery, [email, hashedPassword, status, role]);
        userId = result.rows[0].id;
      } else {
        const result = await run(insertQuery, [email, hashedPassword, status, role]);
        userId = result.lastInsertRowid;
      }

      console.log('User inserted, ID:', userId);
      
      console.log('Inserting settings...');
      const settingsQuery = isPostgres
        ? 'INSERT INTO settings (user_id) VALUES ($1)'
        : 'INSERT INTO settings (user_id) VALUES (?)';
      
      if (isPostgres) {
        await client.query(settingsQuery, [userId]);
      } else {
        await run(settingsQuery, [userId]);
      }

      let approvalToken = null;
      if (!isFirstUser) {
        console.log('Creating approval token...');
        approvalToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        
        const tokenQuery = isPostgres
          ? 'INSERT INTO user_approval_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)'
          : 'INSERT INTO user_approval_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
        
        if (isPostgres) {
          await client.query(tokenQuery, [userId, approvalToken, expiresAt]);
        } else {
          await run(tokenQuery, [userId, approvalToken, expiresAt]);
        }
      }

      return { userId, approvalToken };
    });

    console.log('Transaction completed, user ID:', created.userId);

    if (!isFirstUser) {
      console.log('Getting admins for notification...');
      const adminsQuery = isPostgres
        ? 'SELECT email FROM users WHERE role = $1 AND status = $2'
        : 'SELECT email FROM users WHERE role = ? AND status = ?';
      const adminsResult = await query(adminsQuery, ['admin', 'approved']);
      const admins = isPostgres ? adminsResult.rows : adminsResult;
      const adminEmails = admins.map((a) => a.email);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      console.log('Admins found:', adminEmails);

      if (adminEmails.length > 0 && created.approvalToken) {
        // Check if email is configured before trying to send
        if (isEmailConfigured()) {
          // Send email notification in background - don't block registration
          sendUserApprovalNotification(adminEmails, email, created.approvalToken, frontendUrl)
            .catch((emailError) => {
              console.error('Failed to send approval notification:', emailError);
              logError({
                level: 'warning',
                message: 'Failed to send user approval notification',
                details: { error: emailError.message, newUserEmail: email, adminEmails },
                route: '/auth/register',
                method: 'POST'
              });
            });
        } else {
          console.warn('User approval notification not sent - email service not configured');
          logError({
            level: 'warning',
            message: 'User approval notification not sent - email service not configured',
            details: { newUserEmail: email, adminEmails },
            route: '/auth/register',
            method: 'POST'
          });
        }
      }

      console.log('Returning pending approval response');
      return res.status(201).json({
        message: 'Conta criada. Fica pendente de aprovação.',
        requiresApproval: true,
      });
    }

    console.log('Returning success response');
    res.status(201).json({
      message: 'Conta criada com sucesso.',
      requiresApproval: false,
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error stack:', error.stack);
    logError({
      level: 'error',
      message: 'Registration failed',
      details: { error: error.message, stack: error.stack },
      route: '/auth/register',
      method: 'POST'
    });
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

    const userQuery = isPostgres
      ? 'SELECT * FROM users WHERE email = $1'
      : 'SELECT * FROM users WHERE email = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [email])).rows[0]
      : db.prepare(userQuery).get(email);
    
    console.log('=== DEBUG: Login attempt for email ===', email);
    console.log('=== DEBUG: User found ===', user ? { id: user.id, email: user.email, status: user.status, role: user.role } : 'No user found');
    
    if (!user) {
      return res.status(401).json({ error: 'Email ou password incorrectos' });
    }

    if (user.status !== 'approved') {
      console.log('=== DEBUG: User not approved, status ===', user.status);
      return res.status(403).json({ error: 'A conta está pendente de aprovação' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou password incorrectos' });
    }

    // Update last login
    const updateQuery = isPostgres
      ? 'UPDATE users SET last_login = $1 WHERE id = $2'
      : 'UPDATE users SET last_login = ? WHERE id = ?';
    
    if (isPostgres) {
      await db.query(updateQuery, [new Date().toISOString(), user.id]);
    } else {
      db.prepare(updateQuery).run(new Date().toISOString(), user.id);
    }

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
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userQuery = isPostgres
      ? 'SELECT id, email, created_at, last_login, role, status FROM users WHERE id = $1'
      : 'SELECT id, email, created_at, last_login, role, status FROM users WHERE id = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [req.user.id])).rows[0]
      : db.prepare(userQuery).get(req.user.id);

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
router.post('/approve/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find valid approval token
    const tokenQuery = isPostgres
      ? 'SELECT * FROM user_approval_tokens WHERE token = $1 AND used = 0 AND expires_at > $2'
      : 'SELECT * FROM user_approval_tokens WHERE token = ? AND used = 0 AND expires_at > ?';
    const approvalToken = isPostgres
      ? (await db.query(tokenQuery, [token, new Date().toISOString()])).rows[0]
      : db.prepare(tokenQuery).get(token, new Date().toISOString());

    if (!approvalToken) {
      return res.status(400).json({ error: 'Link de aprovação inválido ou expirado' });
    }

    // Approve user
    const updateQuery = isPostgres
      ? 'UPDATE users SET status = $1 WHERE id = $2'
      : 'UPDATE users SET status = ? WHERE id = ?';
    if (isPostgres) {
      await db.query(updateQuery, ['approved', approvalToken.user_id]);
    } else {
      db.prepare(updateQuery).run('approved', approvalToken.user_id);
    }

    // Mark token as used
    const tokenUpdateQuery = isPostgres
      ? 'UPDATE user_approval_tokens SET used = 1 WHERE id = $1'
      : 'UPDATE user_approval_tokens SET used = 1 WHERE id = ?';
    if (isPostgres) {
      await db.query(tokenUpdateQuery, [approvalToken.id]);
    } else {
      db.prepare(tokenUpdateQuery).run(approvalToken.id);
    }

    // Get user details
    const userQuery = isPostgres
      ? 'SELECT id, email FROM users WHERE id = $1'
      : 'SELECT id, email FROM users WHERE id = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [approvalToken.user_id])).rows[0]
      : db.prepare(userQuery).get(approvalToken.user_id);

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

    // Check if email is configured
    if (!isEmailConfigured()) {
      console.warn('Password reset requested but email service is not configured');
      return res.status(503).json({ 
        error: 'Serviço de email não configurado. Contacte o administrador.',
        emailNotConfigured: true
      });
    }

    const genericMessage = 'Se existir uma conta com este email, enviámos um link de recuperação.';
    const userQuery = isPostgres
      ? 'SELECT id, email FROM users WHERE email = $1'
      : 'SELECT id, email FROM users WHERE email = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [email])).rows[0]
      : db.prepare(userQuery).get(email);
    
    if (!user) {
      return res.json({ message: genericMessage, emailSent: true });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

    const deleteQuery = isPostgres
      ? 'DELETE FROM password_reset_tokens WHERE user_id = $1'
      : 'DELETE FROM password_reset_tokens WHERE user_id = ?';
    const insertQuery = isPostgres
      ? 'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)'
      : 'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
    
    if (isPostgres) {
      await db.query(deleteQuery, [user.id]);
      await db.query(insertQuery, [user.id, resetToken, expiresAt]);
    } else {
      db.prepare(deleteQuery).run(user.id);
      db.prepare(insertQuery).run(user.id, resetToken, expiresAt);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Send email in background - don't block the response
    sendPasswordResetEmail(user.email, resetToken, frontendUrl)
      .then((emailResult) => {
        if (!emailResult.success) {
          console.error('Password reset email was not sent:', emailResult.message);
          logError({
            level: 'warning',
            message: 'Password reset email was not sent',
            details: { result: emailResult },
            userId: user.id,
            route: '/auth/forgot-password',
            method: 'POST'
          });
        }
      })
      .catch((emailError) => {
        console.error('Failed to send password reset email:', emailError);
        logError({
          level: 'error',
          message: 'Failed to send password reset email',
          details: { error: emailError.message },
          userId: user.id,
          route: '/auth/forgot-password',
          method: 'POST'
        });
      });

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
    const tokenQuery = isPostgres
      ? 'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = 0 AND expires_at > $2'
      : 'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?';
    const resetToken = isPostgres
      ? (await db.query(tokenQuery, [token, new Date().toISOString()])).rows[0]
      : db.prepare(tokenQuery).get(token, new Date().toISOString());

    if (!resetToken) {
      return res.status(400).json({ error: 'Link de recuperação inválido ou expirado' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const updateQuery = isPostgres
      ? 'UPDATE users SET password = $1 WHERE id = $2'
      : 'UPDATE users SET password = ? WHERE id = ?';
    if (isPostgres) {
      await db.query(updateQuery, [hashedPassword, resetToken.user_id]);
    } else {
      db.prepare(updateQuery).run(hashedPassword, resetToken.user_id);
    }

    // Mark token as used
    const tokenUpdateQuery = isPostgres
      ? 'UPDATE password_reset_tokens SET used = 1 WHERE id = $1'
      : 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?';
    if (isPostgres) {
      await db.query(tokenUpdateQuery, [resetToken.id]);
    } else {
      db.prepare(tokenUpdateQuery).run(resetToken.id);
    }

    res.json({ message: 'Password redefinida com sucesso' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Não foi possível redefinir a password' });
  }
});

module.exports = router;

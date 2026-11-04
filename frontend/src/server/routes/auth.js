const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, isPostgres, query, queryOne, run, transaction } = require('../models/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { 
  sendPasswordResetEmail, 
  sendUserApprovalNotification, 
  sendUserRegistrationPendingNotification,
  sendUserApprovedConfirmation,
  sendPasswordResetRequestNotification,
  sendPasswordResetApprovedNotification,
  isEmailConfigured 
} = require('../services/emailService');
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
    const count = parseInt(userCount?.count || '0', 10);
    const isFirstUser = count === 0;
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
        ? "SELECT email FROM users WHERE role IN ('admin', 'admin_private') AND status = $1"
        : "SELECT email FROM users WHERE role IN ('admin', 'admin_private') AND status = ?";
      const adminsResult = await query(adminsQuery, ['approved']);
      const admins = isPostgres ? adminsResult.rows : adminsResult;
      let adminEmails = (admins || []).map((a) => a.email);

      // Se existir a variável ADMIN_EMAIL na Vercel, inclui também
      if (process.env.ADMIN_EMAIL) {
        adminEmails.push(process.env.ADMIN_EMAIL);
      }
      // Salvaguarda: se nenhum admin for encontrado, envia para o email de notificações
      if (adminEmails.length === 0) {
        adminEmails.push(process.env.SMTP_USER || 'despesasnotificacao@gmail.com');
      }
      // Limpar duplicados e espaços
      adminEmails = [...new Set(adminEmails.map(e => String(e).trim().toLowerCase()).filter(Boolean))];

      const frontendUrl = process.env.FRONTEND_URL || 'https://despesa-app.vercel.app';
      console.log('Admins to notify:', adminEmails);

      if (isEmailConfigured()) {
        // 1. Notificar os administradores de que existe um novo registo e contas para aprovar
        if (adminEmails.length > 0 && created.approvalToken) {
          sendUserApprovalNotification(adminEmails, email, created.approvalToken, frontendUrl)
            .catch((emailError) => {
              console.error('Failed to send approval notification to admins:', emailError);
            });
        }
        // 2. Enviar email de cortesia ao novo utilizador informando que a conta está suspensa a aguardar aceitação
        sendUserRegistrationPendingNotification(email, frontendUrl)
          .catch((emailError) => {
            console.error('Failed to send pending notification to user:', emailError);
          });
      }

      console.log('Returning pending approval response');
      return res.status(201).json({
        message: 'Conta criada com sucesso! Por segurança, a conta fica suspensa até aceitação pelo administrador. Verifique o seu email e a pasta de lixo/spam.',
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
    const { password, rememberMe } = req.body;

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
      return res.status(403).json({ error: 'A conta encontra-se suspensa a aguardar aceitação pelo administrador. Verifique o seu email (e a pasta de lixo/spam).' });
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

    // Auto-promover luiszambujo@hotmail.com a admin_private se necessário
    if (user.email.toLowerCase() === 'luiszambujo@hotmail.com') {
      user.role = 'admin_private';
      try {
        const roleUpdateSql = isPostgres
          ? "UPDATE users SET role = 'admin_private' WHERE id = $1"
          : "UPDATE users SET role = 'admin_private' WHERE id = ?";
        await run(roleUpdateSql, [user.id]);
      } catch (roleErr) {
        console.warn('Could not update role in DB during login:', roleErr.message);
      }
    }

    const token = generateToken({ id: user.id, email: user.email }, rememberMe);

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
    let user = isPostgres
      ? (await db.query(userQuery, [req.user.id])).rows[0]
      : db.prepare(userQuery).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Auto-promover luiszambujo@hotmail.com a admin_private se necessário
    if (user.email.toLowerCase() === 'luiszambujo@hotmail.com') {
      user.role = 'admin_private';
      try {
        const roleUpdateSql = isPostgres
          ? "UPDATE users SET role = 'admin_private' WHERE id = $1"
          : "UPDATE users SET role = 'admin_private' WHERE id = ?";
        await run(roleUpdateSql, [user.id]);
      } catch (roleErr) {
        console.warn('Could not update role in DB during /me:', roleErr.message);
      }
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

    if (isEmailConfigured() && user?.email) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://despesa-app.vercel.app';
      sendUserApprovedConfirmation(user.email, frontendUrl).catch(e => console.error('Erro ao enviar email de aprovacao:', e));
    }

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

    const userQuery = isPostgres
      ? 'SELECT id, email FROM users WHERE email = $1'
      : 'SELECT id, email FROM users WHERE email = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [email])).rows[0]
      : db.prepare(userQuery).get(email);

    if (!user) {
      return res.json({ message: 'Se existir uma conta com este email, enviámos o link de recuperação.' });
    }

    // Gerar token seguro para redefinição (válido por 1 hora)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const tokenQuery = isPostgres
      ? 'INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES ($1, $2, $3, 0)'
      : 'INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)';
    if (isPostgres) {
      await db.query(tokenQuery, [user.id, resetToken, expiresAt]);
    } else {
      db.prepare(tokenQuery).run(user.id, resetToken, expiresAt);
    }

    // Registar também em password_reset_requests para compatibilidade
    const insertQuery = isPostgres
      ? 'INSERT INTO password_reset_requests (user_id, status) VALUES ($1, $2)'
      : 'INSERT INTO password_reset_requests (user_id, status) VALUES (?, ?)';
    if (isPostgres) {
      await db.query(insertQuery, [user.id, 'approved']);
    } else {
      db.prepare(insertQuery).run(user.id, 'approved');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://despesa-app.vercel.app';

    if (isEmailConfigured()) {
      const emailResult = await sendPasswordResetEmail(user.email, resetToken, frontendUrl);
      if (emailResult && !emailResult.success) {
        console.error('Erro ao enviar email de reset de password:', emailResult.error);
        return res.json({ 
          message: 'Pedido registado, mas ocorreu um erro no envio de email. Pode contactar o administrador.' 
        });
      }
      return res.json({ 
        message: 'Enviámos um link para redefinir a sua password. Por favor verifique o seu email (e a pasta de lixo/spam)!' 
      });
    } else {
      return res.json({ 
        message: 'Aguarde a aprovação do administrador para redefinir a password.' 
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Não foi possível processar o pedido de reset' });
  }
});


// Get password reset requests (admin only)
router.get('/password-reset-requests', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userQuery = isPostgres
      ? 'SELECT role FROM users WHERE id = $1'
      : 'SELECT role FROM users WHERE id = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [req.user.id])).rows[0]
      : db.prepare(userQuery).get(req.user.id);

    if (!user || (user.role !== 'admin' && user.role !== 'admin_private')) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem ver pedidos de reset.' });
    }

    // Get pending password reset requests with user info
    const requestsQuery = isPostgres
      ? `SELECT prr.id, prr.user_id, prr.status, prr.requested_at, prr.processed_at, prr.processed_by,
          u.email, u.role as user_role
          FROM password_reset_requests prr
          JOIN users u ON prr.user_id = u.id
          WHERE prr.status = 'pending'
          ORDER BY prr.requested_at DESC`
      : `SELECT prr.id, prr.user_id, prr.status, prr.requested_at, prr.processed_at, prr.processed_by,
          u.email, u.role as user_role
          FROM password_reset_requests prr
          JOIN users u ON prr.user_id = u.id
          WHERE prr.status = 'pending'
          ORDER BY prr.requested_at DESC`;

    const requests = isPostgres
      ? (await db.query(requestsQuery)).rows
      : db.prepare(requestsQuery).all();

    res.json(requests);
  } catch (error) {
    console.error('Get password reset requests error:', error);
    res.status(500).json({ error: 'Não foi possível obter os pedidos de reset' });
  }
});

// Approve password reset request (admin only)
router.post('/password-reset-requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    // Check if user is admin
    const userQuery = isPostgres
      ? 'SELECT role FROM users WHERE id = $1'
      : 'SELECT role FROM users WHERE id = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [req.user.id])).rows[0]
      : db.prepare(userQuery).get(req.user.id);

    if (!user || (user.role !== 'admin' && user.role !== 'admin_private')) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem aprovar pedidos.' });
    }

    // Get the reset request
    const requestQuery = isPostgres
      ? 'SELECT * FROM password_reset_requests WHERE id = $1 AND status = $2'
      : 'SELECT * FROM password_reset_requests WHERE id = ? AND status = ?';
    const resetRequest = isPostgres
      ? (await db.query(requestQuery, [requestId, 'pending'])).rows[0]
      : db.prepare(requestQuery).get(requestId, 'pending');

    if (!resetRequest) {
      return res.status(404).json({ error: 'Pedido não encontrado ou já processado' });
    }

    // Update request status to approved
    const updateQuery = isPostgres
      ? 'UPDATE password_reset_requests SET status = $1, processed_at = $2, processed_by = $3 WHERE id = $4'
      : 'UPDATE password_reset_requests SET status = ?, processed_at = ?, processed_by = ? WHERE id = ?';
    if (isPostgres) {
      await db.query(updateQuery, ['approved', new Date().toISOString(), req.user.id, requestId]);
    } else {
      db.prepare(updateQuery).run('approved', new Date().toISOString(), req.user.id, requestId);
    }

    if (isEmailConfigured()) {
      const targetUserQuery = isPostgres
        ? 'SELECT email FROM users WHERE id = $1'
        : 'SELECT email FROM users WHERE id = ?';
      queryOne(targetUserQuery, [resetRequest.user_id]).then(targetUser => {
        if (targetUser?.email) {
          const frontendUrl = process.env.FRONTEND_URL || 'https://despesa-app.vercel.app';
          sendPasswordResetApprovedNotification(targetUser.email, frontendUrl).catch(e => console.error('Erro ao notificar utilizador de reset aprovado:', e));
        }
      }).catch(e => console.error('Erro ao procurar utilizador do reset aprovado:', e));
    }

    res.json({ message: 'Pedido de reset aprovado com sucesso' });
  } catch (error) {
    console.error('Approve password reset request error:', error);
    res.status(500).json({ error: 'Não foi possível aprovar o pedido' });
  }
});

// Reject password reset request (admin only)
router.post('/password-reset-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    // Check if user is admin
    const userQuery = isPostgres
      ? 'SELECT role FROM users WHERE id = $1'
      : 'SELECT role FROM users WHERE id = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [req.user.id])).rows[0]
      : db.prepare(userQuery).get(req.user.id);

    if (!user || (user.role !== 'admin' && user.role !== 'admin_private')) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem rejeitar pedidos.' });
    }

    // Get the reset request
    const requestQuery = isPostgres
      ? 'SELECT * FROM password_reset_requests WHERE id = $1 AND status = $2'
      : 'SELECT * FROM password_reset_requests WHERE id = ? AND status = ?';
    const resetRequest = isPostgres
      ? (await db.query(requestQuery, [requestId, 'pending'])).rows[0]
      : db.prepare(requestQuery).get(requestId, 'pending');

    if (!resetRequest) {
      return res.status(404).json({ error: 'Pedido não encontrado ou já processado' });
    }

    // Update request status to rejected
    const updateQuery = isPostgres
      ? 'UPDATE password_reset_requests SET status = $1, processed_at = $2, processed_by = $3 WHERE id = $4'
      : 'UPDATE password_reset_requests SET status = ?, processed_at = ?, processed_by = ? WHERE id = ?';
    if (isPostgres) {
      await db.query(updateQuery, ['rejected', new Date().toISOString(), req.user.id, requestId]);
    } else {
      db.prepare(updateQuery).run('rejected', new Date().toISOString(), req.user.id, requestId);
    }

    res.json({ message: 'Pedido de reset rejeitado com sucesso' });
  } catch (error) {
    console.error('Reject password reset request error:', error);
    res.status(500).json({ error: 'Não foi possível rejeitar o pedido' });
  }
});

// Reset password with token from email link
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token é obrigatório' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });
    }

    const tokenQuery = isPostgres
      ? 'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = 0'
      : 'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0';
    const resetTokenRecord = isPostgres
      ? (await db.query(tokenQuery, [token])).rows[0]
      : db.prepare(tokenQuery).get(token);

    if (!resetTokenRecord) {
      return res.status(400).json({ error: 'Token de recuperação inválido ou já utilizado' });
    }

    if (new Date(resetTokenRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'O link de recuperação expirou. Por favor solicite um novo.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatePasswordQuery = isPostgres
      ? 'UPDATE users SET password = $1 WHERE id = $2'
      : 'UPDATE users SET password = ? WHERE id = ?';
    if (isPostgres) {
      await db.query(updatePasswordQuery, [hashedPassword, resetTokenRecord.user_id]);
    } else {
      db.prepare(updatePasswordQuery).run(hashedPassword, resetTokenRecord.user_id);
    }

    const markUsedQuery = isPostgres
      ? 'UPDATE password_reset_tokens SET used = 1 WHERE id = $1'
      : 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?';
    if (isPostgres) {
      await db.query(markUsedQuery, [resetTokenRecord.id]);
    } else {
      db.prepare(markUsedQuery).run(resetTokenRecord.id);
    }

    res.json({ message: 'Password redefinida com sucesso! Já pode iniciar sessão.' });
  } catch (error) {
    console.error('Reset password with token error:', error);
    res.status(500).json({ error: 'Não foi possível redefinir a password' });
  }
});

// Reset password with email or token
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword, confirmPassword, token } = req.body;

    // Se vier com token
    if (token) {
      if (!newPassword) {
        return res.status(400).json({ error: 'A nova password é obrigatória' });
      }
      if (confirmPassword && newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'As passwords não coincidem' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });
      }

      const tokenQuery = isPostgres
        ? 'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = 0'
        : 'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0';
      const resetTokenRecord = isPostgres
        ? (await db.query(tokenQuery, [token])).rows[0]
        : db.prepare(tokenQuery).get(token);

      if (!resetTokenRecord) {
        return res.status(400).json({ error: 'Token de recuperação inválido ou já utilizado' });
      }

      if (new Date(resetTokenRecord.expires_at) < new Date()) {
        return res.status(400).json({ error: 'O link de recuperação expirou. Por favor solicite um novo.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updateQuery = isPostgres
        ? 'UPDATE users SET password = $1 WHERE id = $2'
        : 'UPDATE users SET password = ? WHERE id = ?';
      if (isPostgres) {
        await db.query(updateQuery, [hashedPassword, resetTokenRecord.user_id]);
      } else {
        db.prepare(updateQuery).run(hashedPassword, resetTokenRecord.user_id);
      }

      const markUsedQuery = isPostgres
        ? 'UPDATE password_reset_tokens SET used = 1 WHERE id = $1'
        : 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?';
      if (isPostgres) {
        await db.query(markUsedQuery, [resetTokenRecord.id]);
      } else {
        db.prepare(markUsedQuery).run(resetTokenRecord.id);
      }

      return res.json({ message: 'Password redefinida com sucesso! Já pode iniciar sessão.' });
    }

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Email, nova password e confirmação são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'As passwords não coincidem' });
    }

    const normalizedEmail = normalizeEmail(email);

    const userQuery = isPostgres
      ? 'SELECT id FROM users WHERE email = $1'
      : 'SELECT id FROM users WHERE email = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [normalizedEmail])).rows[0]
      : db.prepare(userQuery).get(normalizedEmail);

    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    // Verificar se existe um pedido aprovado
    const requestQuery = isPostgres
      ? 'SELECT * FROM password_reset_requests WHERE user_id = $1 AND status = $2 ORDER BY requested_at DESC LIMIT 1'
      : 'SELECT * FROM password_reset_requests WHERE user_id = ? AND status = ? ORDER BY requested_at DESC LIMIT 1';
    const resetRequest = isPostgres
      ? (await db.query(requestQuery, [user.id, 'approved'])).rows[0]
      : db.prepare(requestQuery).get(user.id, 'approved');

    if (!resetRequest) {
      return res.status(400).json({ error: 'Não existe um pedido de reset aprovado para este utilizador.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = isPostgres
      ? 'UPDATE users SET password = $1 WHERE id = $2'
      : 'UPDATE users SET password = ? WHERE id = ?';
    if (isPostgres) {
      await db.query(updateQuery, [hashedPassword, user.id]);
    } else {
      db.prepare(updateQuery).run(hashedPassword, user.id);
    }

    res.json({ message: 'Password redefinida com sucesso! Já pode iniciar sessão.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Não foi possível redefinir a password' });
  }
});

// Change password (authenticated)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Password atual e nova password são obrigatórias' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova password deve ter pelo menos 6 caracteres' });
    }

    // Get user with password
    const userQuery = isPostgres
      ? 'SELECT * FROM users WHERE id = $1'
      : 'SELECT * FROM users WHERE id = ?';
    const user = isPostgres
      ? (await db.query(userQuery, [req.user.id])).rows[0]
      : db.prepare(userQuery).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Password atual incorrecta' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const updateQuery = isPostgres
      ? 'UPDATE users SET password = $1 WHERE id = $2'
      : 'UPDATE users SET password = ? WHERE id = ?';
    if (isPostgres) {
      await db.query(updateQuery, [hashedPassword, req.user.id]);
    } else {
      db.prepare(updateQuery).run(hashedPassword, req.user.id);
    }

    res.json({ message: 'Password alterada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Não foi possível alterar a password' });
  }
});

module.exports = router;

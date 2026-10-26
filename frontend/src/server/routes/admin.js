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
    const rawUsers = isPostgres ? usersResult.rows : usersResult;
    const isCallerPrivateAdmin = req.user?.role === 'admin_private';
    const users = rawUsers.map(u => {
      if (!isCallerPrivateAdmin && u.role === 'admin_private') {
        return { ...u, role: 'admin' };
      }
      return u;
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Change user role (user, admin, admin_private)
router.post('/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'admin_private'].includes(role)) {
      return res.status(400).json({ error: 'Função inválida' });
    }

    const userSql = isPostgres
      ? 'SELECT id, email, role FROM users WHERE id = $1'
      : 'SELECT id, email, role FROM users WHERE id = ?';
    const targetUser = await queryOne(userSql, [userId]);

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    // Only admin_private can assign or remove admin_private
    if ((role === 'admin_private' || targetUser.role === 'admin_private') && req.user.role !== 'admin_private') {
      return res.status(403).json({ error: 'Apenas um Administrador com Privado pode gerir esta função' });
    }

    // Prevent removing admin rights if this is the only admin
    if (role === 'user' && (targetUser.role === 'admin' || targetUser.role === 'admin_private')) {
      if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'Não pode despromover o seu próprio utilizador' });
      }
      const adminCountSql = isPostgres
        ? "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'admin_private')"
        : "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'admin_private')";
      const adminCount = await queryOne(adminCountSql, []);
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Não é possível despromover o único administrador' });
      }
    }

    const updateRoleSql = isPostgres
      ? 'UPDATE users SET role = $1 WHERE id = $2'
      : 'UPDATE users SET role = ? WHERE id = ?';
    await run(updateRoleSql, [role, userId]);

    const updatedUser = await queryOne(userSql, [userId]);
    if (req.user.role !== 'admin_private' && updatedUser.role === 'admin_private') {
      updatedUser.role = 'admin';
    }

    res.json({
      message: 'Função atualizada com sucesso',
      user: updatedUser
    });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ error: 'Falha ao atualizar função do utilizador' });
  }
});

// Promote user to admin
router.post('/users/:userId/promote', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const userSql = isPostgres
      ? 'SELECT id, email, role FROM users WHERE id = $1'
      : 'SELECT id, email, role FROM users WHERE id = ?';
    const targetUser = await queryOne(userSql, [userId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user role to admin
    const updateRoleSql = isPostgres
      ? 'UPDATE users SET role = $1 WHERE id = $2'
      : 'UPDATE users SET role = ? WHERE id = ?';
    await run(updateRoleSql, ['admin', userId]);

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

    const userSql = isPostgres
      ? 'SELECT id, email, role FROM users WHERE id = $1'
      : 'SELECT id, email, role FROM users WHERE id = ?';
    const targetUser = await queryOne(userSql, [userId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role === 'admin_private' && req.user.role !== 'admin_private') {
      return res.status(403).json({ error: 'Apenas um Administrador com Privado pode alterar este utilizador' });
    }

    // Check if this is the only admin
    const adminCountSql = isPostgres
      ? "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'admin_private')"
      : "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'admin_private')";
    const adminCount = await queryOne(adminCountSql, []);
    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot demote the only admin' });
    }

    // Update user role to user
    const updateRoleSql = isPostgres
      ? 'UPDATE users SET role = $1 WHERE id = $2'
      : 'UPDATE users SET role = ? WHERE id = ?';
    await run(updateRoleSql, ['user', userId]);

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

    // Check if this is an admin or admin_private
    const userSql = isPostgres
      ? 'SELECT role FROM users WHERE id = $1'
      : 'SELECT role FROM users WHERE id = ?';
    const userToDelete = await queryOne(userSql, [userId]);
    if (userToDelete && userToDelete.role === 'admin_private' && req.user.role !== 'admin_private') {
      return res.status(403).json({ error: 'Apenas um Administrador com Privado pode eliminar este utilizador' });
    }
    if (userToDelete && (userToDelete.role === 'admin' || userToDelete.role === 'admin_private')) {
      const adminCountSql = isPostgres
        ? "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'admin_private')"
        : "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'admin_private')";
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

// Helper to resolve Google Refresh Token (from user, admin, or any user who connected Drive)
async function resolveGoogleRefreshToken(userId) {
  try {
    const parsedId = parseInt(userId, 10);
    const userSql = isPostgres
      ? 'SELECT google_refresh_token FROM users WHERE id = $1'
      : 'SELECT google_refresh_token FROM users WHERE id = ?';
    let userRes = await queryOne(userSql, [isNaN(parsedId) ? userId : parsedId]);
    let refreshToken = userRes?.google_refresh_token;

    if (refreshToken && refreshToken.trim()) {
      return refreshToken.trim();
    }

    // Fallback 1: Admin user with refresh token
    const adminTokenSql = isPostgres
      ? "SELECT google_refresh_token FROM users WHERE google_refresh_token IS NOT NULL AND TRIM(google_refresh_token) != '' AND (role = 'admin' OR role = 'admin_private') ORDER BY id ASC LIMIT 1"
      : "SELECT google_refresh_token FROM users WHERE google_refresh_token IS NOT NULL AND TRIM(google_refresh_token) != '' AND (role = 'admin' OR role = 'admin_private') ORDER BY id ASC LIMIT 1";
    const adminRes = await queryOne(adminTokenSql, []);
    if (adminRes?.google_refresh_token && adminRes.google_refresh_token.trim()) {
      return adminRes.google_refresh_token.trim();
    }

    // Fallback 2: Any user in the system with refresh token
    const anyUserSql = isPostgres
      ? "SELECT google_refresh_token FROM users WHERE google_refresh_token IS NOT NULL AND TRIM(google_refresh_token) != '' ORDER BY id ASC LIMIT 1"
      : "SELECT google_refresh_token FROM users WHERE google_refresh_token IS NOT NULL AND TRIM(google_refresh_token) != '' ORDER BY id ASC LIMIT 1";
    const anyUserRes = await queryOne(anyUserSql, []);
    if (anyUserRes?.google_refresh_token && anyUserRes.google_refresh_token.trim()) {
      return anyUserRes.google_refresh_token.trim();
    }
  } catch (err) {
    console.warn('Erro ao resolver token do Google Drive:', err.message);
  }
  return null;
}

// Delete old expenses with automatic backup to Google Drive
router.delete('/expenses/cleanup', authenticateToken, async (req, res) => {
  try {
    const { years } = req.query;

    if (!years || isNaN(Number(years))) {
      return res.status(400).json({ error: 'Parâmetro de anos é obrigatório' });
    }

    const yearsNum = parseFloat(years);
    if (isNaN(yearsNum) || yearsNum < 0.5 || yearsNum > 10) {
      return res.status(400).json({ error: 'Período deve ser entre 6 meses (0.5) e 10 anos' });
    }

    // Calcular data limite com base nos meses para permitir anos fracionários (ex: 1.5 = 18 meses)
    const monthsNum = Math.round(yearsNum * 12);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsNum);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 1. Obter os registos que vão ser apagados antes de qualquer eliminação
    const selectSql = isPostgres
      ? 'SELECT * FROM expenses WHERE user_id = $1 AND debit_date < $2 ORDER BY debit_date ASC'
      : 'SELECT * FROM expenses WHERE user_id = ? AND debit_date < ? ORDER BY debit_date ASC';
    const expensesResult = await query(selectSql, [req.user.id, cutoffDateStr]);
    const expensesToDelete = isPostgres ? expensesResult.rows : expensesResult;

    let backupFileName = null;
    let driveBackupSuccess = false;
    let driveFileId = null;
    let driveError = null;

    if (expensesToDelete && expensesToDelete.length > 0) {
      // Determinar a data de início (mais antiga) e data de fim (mais recente) dos dados eliminados
      const rawStart = expensesToDelete[0].debit_date;
      const rawEnd = expensesToDelete[expensesToDelete.length - 1].debit_date;
      const startStr = typeof rawStart === 'string' ? rawStart.split('T')[0] : new Date(rawStart).toISOString().split('T')[0];
      const endStr = typeof rawEnd === 'string' ? rawEnd.split('T')[0] : new Date(rawEnd).toISOString().split('T')[0];

      // Nome do ficheiro conforme pedido: deleted com data de fim e data de inicio
      backupFileName = `deleted_inicio_${startStr}_fim_${endStr}.json`;

      // Obter settings do utilizador para contexto completo
      const settingsSql = isPostgres
        ? 'SELECT * FROM settings WHERE user_id = $1'
        : 'SELECT * FROM settings WHERE user_id = ?';
      const userSettings = await queryOne(settingsSql, [req.user.id]);

      const backupData = JSON.stringify({
        format_version: 1,
        type: 'deleted_expenses_cleanup',
        cleanup_years: yearsNum,
        start_date: startStr,
        end_date: endStr,
        exported_at: new Date().toISOString(),
        user_id: req.user.id,
        deleted_count: expensesToDelete.length,
        expenses: expensesToDelete,
        settings: userSettings
      }, null, 2);

      // Obter token de forma robusta
      const refreshToken = await resolveGoogleRefreshToken(req.user.id);

      if (refreshToken) {
        try {
          const { uploadBackup } = require('../services/googleDriveService');
          driveFileId = await uploadBackup(refreshToken, backupData, backupFileName, 'eliminados');
          driveBackupSuccess = true;
          console.log(`Backup automático de eliminados gravado no Google Drive: ${backupFileName} (ID: ${driveFileId})`);
        } catch (gErr) {
          console.error('Erro ao enviar backup automático para o Google Drive:', gErr);
          driveError = gErr.message;
        }
      } else {
        console.warn('Google Drive não está associado. O backup automático para o Drive não pôde ser enviado.');
      }
    }

    // 2. Apagar os registos antigos da base de dados
    const deleteSql = isPostgres
      ? 'DELETE FROM expenses WHERE user_id = $1 AND debit_date < $2'
      : 'DELETE FROM expenses WHERE user_id = ? AND debit_date < ?';
    const result = await run(deleteSql, [req.user.id, cutoffDateStr]);

    res.json({
      message: `Foram apagados ${result.changes} registos anteriores a ${cutoffDateStr}`,
      deletedCount: result.changes,
      cutoffDate: cutoffDateStr,
      fileName: backupFileName,
      driveBackup: driveBackupSuccess,
      driveFileId: driveFileId,
      driveError: driveError
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

    if (!years || isNaN(Number(years))) {
      return res.status(400).json({ error: 'Years parameter is required' });
    }

    const yearsNum = parseFloat(years);
    if (isNaN(yearsNum) || yearsNum < 0.5 || yearsNum > 10) {
      return res.status(400).json({ error: 'Período deve ser entre 6 meses (0.5) e 10 anos' });
    }
    const monthsNum = Math.round(yearsNum * 12);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsNum);
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

// ==========================================
// CONSULTA DE BACKUPS (APENAS LEITURA / ADMIN)
// ==========================================

// Listar backups disponíveis no Google Drive (eliminados, semanais, mensais)
router.get('/backups/google', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const refreshToken = await resolveGoogleRefreshToken(req.user.id);

    if (!refreshToken) {
      return res.json({ connected: false, files: [] });
    }

    const { listBackups } = require('../services/googleDriveService');
    const files = await listBackups(refreshToken);
    res.json({ connected: true, files });
  } catch (error) {
    console.error('Erro ao listar backups do Google Drive:', error);
    res.status(500).json({ error: 'Falha ao listar backups do Google Drive: ' + error.message, connected: true });
  }
});

// Descarregar conteúdo de um backup do Google Drive para visualização (Apenas Leitura)
router.get('/backups/google/:fileId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).json({ error: 'ID do ficheiro é obrigatório' });
    }

    const refreshToken = await resolveGoogleRefreshToken(req.user.id);

    if (!refreshToken) {
      return res.status(400).json({ error: 'Google Drive não está associado.' });
    }

    const { downloadBackup } = require('../services/googleDriveService');
    const backupContent = await downloadBackup(refreshToken, fileId);

    res.json({ success: true, backup: backupContent });
  } catch (error) {
    console.error('Erro ao descarregar backup do Google Drive:', error);
    res.status(500).json({ error: 'Falha ao descarregar backup para visualização: ' + error.message });
  }
});

// Obter snapshot da base de dados atual de um utilizador para visualização (Apenas Leitura)
router.get('/backups/user-current/:targetUserId?', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.targetUserId || req.query.targetUserId || req.user.id, 10);
    const isPrivateAdmin = req.user?.role === 'admin_private';

    const expensesSql = isPostgres
      ? `SELECT * FROM expenses WHERE user_id = $1 ${isPrivateAdmin ? '' : 'AND (is_private = 0 OR is_private IS NULL)'} ORDER BY debit_date DESC`
      : `SELECT * FROM expenses WHERE user_id = ? ${isPrivateAdmin ? '' : 'AND (is_private = 0 OR is_private IS NULL)'} ORDER BY debit_date DESC`;
    const expensesResult = await query(expensesSql, [targetUserId]);
    const expenses = isPostgres ? expensesResult.rows : expensesResult;

    const settingsSql = isPostgres
      ? 'SELECT * FROM settings WHERE user_id = $1'
      : 'SELECT * FROM settings WHERE user_id = ?';
    const settings = await queryOne(settingsSql, [targetUserId]);

    const userSql = isPostgres
      ? 'SELECT id, email, role, status FROM users WHERE id = $1'
      : 'SELECT id, email, role, status FROM users WHERE id = ?';
    const targetUser = await queryOne(userSql, [targetUserId]);

    res.json({
      success: true,
      backup: {
        format_version: 1,
        type: 'current_system_snapshot',
        exported_at: new Date().toISOString(),
        user_id: targetUserId,
        user_email: targetUser?.email,
        expenses: expenses || [],
        settings: settings || {}
      }
    });
  } catch (error) {
    console.error('Erro ao obter snapshot de utilizador:', error);
    res.status(500).json({ error: 'Falha ao obter dados para visualização' });
  }
});

module.exports = router;

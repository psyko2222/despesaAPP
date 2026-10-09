const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAuthUrl, getTokens } = require('../services/googleDriveService');
const { query } = require('../models/database');

// 1. Gera URL de autenticacao
router.get('/url', authenticateToken, (req, res) => {
  try {
    const url = getAuthUrl(req.user.id.toString());
    res.json({ url });
  } catch (error) {
    console.error('Erro ao gerar URL Google', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// 2. Callback que a Google chama com o codigo
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect('/?google_error=' + encodeURIComponent(error));
    }
    
    if (!code || !state) {
      return res.redirect('/?google_error=missing_params');
    }
    
    const userId = parseInt(state, 10);
    if (isNaN(userId)) {
      return res.redirect('/?google_error=invalid_state');
    }

    const tokens = await getTokens(code);
    
    if (tokens.refresh_token) {
      try {
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token VARCHAR(255)');
      } catch (e) {}
      
      try {
        await query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS drive_backup_enabled INTEGER DEFAULT 0');
      } catch (e) {}

      await query('UPDATE users SET google_refresh_token = $1 WHERE id = $2', [tokens.refresh_token, userId]);
      
      await query(`
        INSERT INTO settings (user_id, drive_backup_enabled) 
        VALUES ($1, 1)
        ON CONFLICT (user_id) DO UPDATE 
        SET drive_backup_enabled = 1
      `, [userId]);
      
      return res.redirect('/?google_success=1');
    } else {
      return res.redirect('/?google_error=no_refresh_token');
    }
    
  } catch (err) {
    console.error('Erro no callback Google', err);
    res.redirect('/?google_error=internal_error');
  }
});

// 3. Desligar conta (remover token)
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE users SET google_refresh_token = NULL WHERE id = $1', [req.user.id]);
    await query('UPDATE settings SET drive_backup_enabled = 0 WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Desligado com sucesso' });
  } catch (err) {
    console.error('Erro ao desligar', err);
    res.status(500).json({ error: 'Erro ao desligar' });
  }
});

// 4. Manual Backup
router.post('/manual-backup', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    
    if (!['semanal', 'mensal'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de backup invalido.' });
    }

    const { queryOne, isPostgres } = require('../models/database');
    const { uploadBackup, rotateBackups } = require('../services/googleDriveService');

    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = isPostgres ? userResult.rows[0] : userResult[0];

    if (!user || !user.google_refresh_token) {
      return res.status(400).json({ error: 'Google Drive nao esta associado.' });
    }

    const expensesSql = isPostgres
      ? 'SELECT * FROM expenses WHERE user_id = $1 ORDER BY id'
      : 'SELECT * FROM expenses WHERE user_id = ? ORDER BY id';
    const expensesResult = await query(expensesSql, [req.user.id]);
    const userExpenses = isPostgres ? (expensesResult.rows || expensesResult) : expensesResult;

    const settingsSql = isPostgres
      ? 'SELECT * FROM settings WHERE user_id = $1'
      : 'SELECT * FROM settings WHERE user_id = ?';
    const userSettings = await queryOne(settingsSql, [req.user.id]);

    const lisbonDate = new Date();
    const backupData = JSON.stringify({
      format_version: 1,
      exported_at: lisbonDate.toISOString(),
      user_id: req.user.id,
      expenses: userExpenses,
      settings: userSettings
    }, null, 2);

    const dateStr = lisbonDate.toISOString().split('T')[0];
    const fileName = `backup_${type}_${dateStr}.json`;

    await uploadBackup(user.google_refresh_token, backupData, fileName, type);

    if (type === 'semanal') {
      await rotateBackups(user.google_refresh_token, 'semanal', 2);
    }

    res.json({ success: true, message: `Backup ${type} gravado com sucesso no Google Drive.` });
  } catch (err) {
    console.error('Erro no backup manual:', err);
    res.status(500).json({ error: 'Falha ao executar backup manual no Google Drive.' });
  }
});

module.exports = router;


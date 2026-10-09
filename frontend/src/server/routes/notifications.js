const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query, isPostgres } = require('../models/database');

// Obter notificaçoes do utilizador (max 50)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sql = isPostgres 
      ? 'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50'
      : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
    const result = await query(sql, [req.user.id]);
    const notifications = isPostgres ? (result.rows || result) : result;
    res.json({ notifications: notifications || [] });
  } catch (err) {
    console.error('Erro ao obter notificacoes:', err);
    res.status(500).json({ error: 'Erro ao obter notificacoes' });
  }
});

// Marcar notificaçoes como lidas
router.post('/mark-read', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body; // array of IDs
    if (!ids || !ids.length) {
      // mark all as read
      const sql = isPostgres 
        ? 'UPDATE notifications SET is_read = 1 WHERE user_id = $1'
        : 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
      await query(sql, [req.user.id]);
    } else {
      // in production we should use IN clause, but for simplicity let's loop
      for (const id of ids) {
        const sql = isPostgres 
          ? 'UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2'
          : 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?';
        await query(sql, [id, req.user.id]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao marcar como lido:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Limpar notificaçoes antigas (opcional)
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const sql = isPostgres 
      ? 'DELETE FROM notifications WHERE user_id = $1'
      : 'DELETE FROM notifications WHERE user_id = ?';
    await query(sql, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;


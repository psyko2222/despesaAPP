const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAuthUrl, getTokens } = require('../services/googleDriveService');
const { query } = require('../models/database');

// 1. Gera URL de autenticação
router.get('/url', authenticateToken, (req, res) => {
  try {
    // Passamos o user ID no state para sabermos quem está a autenticar
    const url = getAuthUrl(req.user.id.toString());
    res.json({ url });
  } catch (error) {
    console.error('Erro ao gerar URL Google', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// 2. Callback que a Google chama com o código
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
      // Guardar na base de dados
      // Precisamos garantir que a coluna existe
      try {
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token VARCHAR(255)');
      } catch (e) {
        // Se a base de dados não for Postgres ou se não tiver permissão, ignora o erro
      }
      
      try {
        await query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS drive_backup_enabled INTEGER DEFAULT 0');
      } catch (e) {}

      await query('UPDATE users SET google_refresh_token = $1 WHERE id = $2', [tokens.refresh_token, userId]);
      
      // Ativa o backup automaticamente
      await query(`
        INSERT INTO settings (user_id, drive_backup_enabled) 
        VALUES ($1, 1)
        ON CONFLICT (user_id) DO UPDATE 
        SET drive_backup_enabled = 1
      `, [userId]);
      
      return res.redirect('/?google_success=1');
    } else {
      // Se a Google não enviar o refresh_token (já tinha dado permissão antes)
      // Tem de revogar permissões e tentar de novo, mas vamos só avisar.
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

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db, isPostgres, query, queryOne, run } = require('../models/database');
const webPushService = require('../services/webPushService');

// Obter a chave pública VAPID (para o browser poder criar a subscrição)
router.get('/public-key', (req, res) => {
  res.json({
    publicKey: webPushService.getPublicKey(),
    isConfigured: webPushService.isConfigured()
  });
});

// Guardar subscrição de um dispositivo/browser do utilizador
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint, keys, userAgent } = req.body;
    const userId = req.user.id;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Dados de subscrição inválidos (endpoint e keys obrigatórios)' });
    }

    const ua = userAgent || req.headers['user-agent'] || null;

    if (isPostgres) {
      const sql = `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (endpoint) 
        DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, user_agent = $5, created_at = CURRENT_TIMESTAMP
      `;
      await db.query(sql, [userId, endpoint, keys.p256dh, keys.auth, ua]);
    } else {
      const sql = `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (endpoint) 
        DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, created_at = CURRENT_TIMESTAMP
      `;
      await run(sql, [userId, endpoint, keys.p256dh, keys.auth, ua]);
    }

    console.log(`Push subscription registered for user ${userId}`);
    res.json({ success: true, message: 'Dispositivo registado para notificações' });
  } catch (error) {
    console.error('Save push subscription error:', error);
    res.status(500).json({ error: 'Falha ao guardar subscrição de notificações' });
  }
});

// Remover subscrição de um dispositivo
router.delete('/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.id;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint é obrigatório' });
    }

    const sql = isPostgres
      ? 'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2'
      : 'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?';
    
    await run(sql, [endpoint, userId]);

    console.log(`Push subscription removed for user ${userId}`);
    res.json({ success: true, message: 'Dispositivo removido com sucesso' });
  } catch (error) {
    console.error('Unsubscribe push error:', error);
    res.status(500).json({ error: 'Falha ao remover subscrição' });
  }
});

// Enviar notificação de teste imediata para todos os dispositivos do utilizador
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = isPostgres
      ? 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1'
      : 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?';
    
    const subsResult = await query(sql, [userId]);
    const subscriptions = isPostgres ? subsResult.rows : subsResult;

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(400).json({ 
        error: 'Nenhum dispositivo registado para este utilizador. Ative as notificações nas Definições primeiro.' 
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscriptions) {
      const result = await webPushService.sendPushNotification(sub, {
        title: '🔔 Despesas - Notificação de Teste',
        body: 'As notificações estão ativas e a funcionar perfeitamente neste dispositivo!',
        icon: '/icon-192.png',
        url: '/'
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        // Se a subscrição expirou (ex: utilizador limpou dados do browser), remove da BD
        if (result.isExpired) {
          const deleteSql = isPostgres
            ? 'DELETE FROM push_subscriptions WHERE id = $1'
            : 'DELETE FROM push_subscriptions WHERE id = ?';
          await run(deleteSql, [sub.id]);
          console.log(`Cleaned up expired subscription ID ${sub.id}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Teste enviado: ${sentCount} recebido(s), ${failedCount} falhado(s)`,
      sentCount,
      failedCount
    });
  } catch (error) {
    console.error('Push test error:', error);
    res.status(500).json({ error: 'Falha ao enviar notificação de teste' });
  }
});

// Estado das subscrições do utilizador atual
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = isPostgres
      ? 'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = $1'
      : 'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?';
    
    const result = await queryOne(sql, [userId]);
    const count = parseInt(result.count || 0);

    res.json({
      configured: webPushService.isConfigured(),
      deviceCount: count,
      hasActiveSubscription: count > 0
    });
  } catch (error) {
    console.error('Push status error:', error);
    res.status(500).json({ error: 'Falha ao verificar estado das notificações' });
  }
});

module.exports = router;

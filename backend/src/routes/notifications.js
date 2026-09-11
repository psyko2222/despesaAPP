const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db, isPostgres, queryOne, run } = require('../models/database');
const { isConfigured, validateToken, sendPushNotification } = require('../services/notificationService');
const { triggerReminderForUser } = require('../services/reminderService');

// Register FCM token
router.post('/register-token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    // Validate the token with Firebase
    if (isConfigured()) {
      const isValid = await validateToken(token);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid FCM token' });
      }
    }

    // Update user's FCM token in database
    const sql = isPostgres
      ? 'UPDATE users SET fcm_token = $1 WHERE id = $2'
      : 'UPDATE users SET fcm_token = ? WHERE id = ?';
    
    await run(sql, [token, userId]);

    console.log(`FCM token registered for user ${userId}`);
    res.json({ success: true, message: 'FCM token registered successfully' });
  } catch (error) {
    console.error('Register FCM token error:', error);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
});

// Get notification configuration status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const firebaseConfigured = isConfigured();
    
    res.json({
      firebaseConfigured,
      pushEnabled: firebaseConfigured
    });
  } catch (error) {
    console.error('Notification status error:', error);
    res.status(500).json({ error: 'Failed to get notification status' });
  }
});

// Remove FCM token
router.delete('/remove-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = isPostgres
      ? 'UPDATE users SET fcm_token = NULL WHERE id = $1'
      : 'UPDATE users SET fcm_token = NULL WHERE id = ?';
    
    await run(sql, [userId]);

    console.log(`FCM token removed for user ${userId}`);
    res.json({ success: true, message: 'FCM token removed successfully' });
  } catch (error) {
    console.error('Remove FCM token error:', error);
    res.status(500).json({ error: 'Failed to remove FCM token' });
  }
});

// Test notification endpoint
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's FCM token
    const userSql = isPostgres
      ? 'SELECT fcm_token FROM users WHERE id = $1'
      : 'SELECT fcm_token FROM users WHERE id = ?';
    
    const userResult = await queryOne(userSql, [userId]);
    
    if (!userResult || !userResult.fcm_token) {
      return res.status(400).json({ error: 'No FCM token registered for this user' });
    }
    
    if (!isConfigured()) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }
    
    // Send test notification
    const result = await sendPushNotification(userResult.fcm_token, {
      title: 'Notificação de Teste',
      body: 'Esta é uma notificação de teste do DespesaAPP',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });
    
    if (result.success) {
      res.json({ success: true, message: 'Test notification sent successfully' });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Trigger reminder manually (for testing)
router.post('/trigger-reminder', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await triggerReminderForUser(userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Trigger reminder error:', error);
    res.status(500).json({ error: 'Failed to trigger reminder' });
  }
});

module.exports = router;
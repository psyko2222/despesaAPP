const express = require('express');
const router = express.Router();
const { authenticateToken, checkDataAccess, requireWriteAccess } = require('../middleware/auth');
const { db } = require('../models/database');

// Get user settings
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    
    if (!settings) {
      // Create default settings if not exist
      db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
      const newSettings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
      return res.json(newSettings);
    }

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings
router.put('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const {
      notifications_enabled,
      debit_notifications_enabled,
      debit_reminder_days,
      debit_reminder_hour,
      debit_reminder_minute,
      variable_reminder_enabled,
      variable_reminder_day,
      variable_reminder_hour,
      variable_reminder_minute,
      variable_snooze_minutes,
      tolerance,
      stats_window_months,
      terms_accepted_version,
      terms_accepted_at,
      auto_cleanup_years
    } = req.body;

    db.prepare(`
      UPDATE settings SET
        notifications_enabled = ?,
        debit_notifications_enabled = ?,
        debit_reminder_days = ?,
        debit_reminder_hour = ?,
        debit_reminder_minute = ?,
        variable_reminder_enabled = ?,
        variable_reminder_day = ?,
        variable_reminder_hour = ?,
        variable_reminder_minute = ?,
        variable_snooze_minutes = ?,
        tolerance = ?,
        stats_window_months = ?,
        terms_accepted_version = ?,
        terms_accepted_at = ?,
        auto_cleanup_years = ?
      WHERE user_id = ?
    `).run(
      notifications_enabled !== undefined ? (notifications_enabled ? 1 : 0) : undefined,
      debit_notifications_enabled !== undefined ? (debit_notifications_enabled ? 1 : 0) : undefined,
      debit_reminder_days,
      debit_reminder_hour,
      debit_reminder_minute,
      variable_reminder_enabled !== undefined ? (variable_reminder_enabled ? 1 : 0) : undefined,
      variable_reminder_day,
      variable_reminder_hour,
      variable_reminder_minute,
      variable_snooze_minutes,
      tolerance,
      stats_window_months,
      terms_accepted_version,
      terms_accepted_at,
      auto_cleanup_years !== undefined ? auto_cleanup_years : undefined,
      userId
    );

    const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    res.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Update specific setting
router.patch('/:key', authenticateToken, (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.user.id;

    // Validate key
    const validKeys = [
      'notifications_enabled', 'debit_notifications_enabled', 'debit_reminder_days',
      'debit_reminder_hour', 'debit_reminder_minute', 'variable_reminder_enabled',
      'variable_reminder_day', 'variable_reminder_hour', 'variable_reminder_minute',
      'variable_snooze_minutes', 'tolerance', 'stats_window_months',
      'terms_accepted_version', 'terms_accepted_at', 'auto_cleanup_years'
    ];

    if (!validKeys.includes(key)) {
      return res.status(400).json({ error: 'Invalid setting key' });
    }

    db.prepare(`UPDATE settings SET ${key} = ? WHERE user_id = ?`).run(value, userId);

    const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    res.json(settings);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;

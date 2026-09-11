const express = require('express');
const router = express.Router();
const { authenticateToken, checkDataAccess, requireWriteAccess, requireAdmin } = require('../middleware/auth');
const { db, isPostgres, queryOne, run } = require('../models/database');
const { isEmailConfigured } = require('../services/emailService');

// Check email configuration (admin only)
router.get('/email-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const emailConfigured = isEmailConfigured();
    const config = {
      configured: emailConfigured,
      sendgrid: Boolean(process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.includes('your-')),
      smtp: Boolean(process.env.SMTP_HOST && !process.env.SMTP_HOST.includes('your-')),
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    };
    
    res.json(config);
  } catch (error) {
    console.error('Email config check error:', error);
    res.status(500).json({ error: 'Failed to check email configuration' });
  }
});

// Get user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = isPostgres
      ? 'SELECT * FROM settings WHERE user_id = $1'
      : 'SELECT * FROM settings WHERE user_id = ?';
    const settings = await queryOne(sql, [userId]);
    
    if (!settings) {
      // Create default settings if not exist
      const insertSql = isPostgres
        ? 'INSERT INTO settings (user_id) VALUES ($1)'
        : 'INSERT INTO settings (user_id) VALUES (?)';
      await run(insertSql, [userId]);
      const newSettings = await queryOne(sql, [userId]);
      return res.json(newSettings);
    }

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Update settings request for user:', userId);
    console.log('Request body:', req.body);

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
      auto_cleanup_years,
      stats_comparison,
      variable_reminder_time,
      variable_reminder_scheduled
    } = req.body;

    // Build dynamic update query to handle undefined values
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (notifications_enabled !== undefined) {
      updates.push(isPostgres ? `notifications_enabled = $${paramIndex++}` : `notifications_enabled = ?`);
      params.push(notifications_enabled ? 1 : 0);
    }
    if (debit_notifications_enabled !== undefined) {
      updates.push(isPostgres ? `debit_notifications_enabled = $${paramIndex++}` : `debit_notifications_enabled = ?`);
      params.push(debit_notifications_enabled ? 1 : 0);
    }
    if (debit_reminder_days !== undefined) {
      updates.push(isPostgres ? `debit_reminder_days = $${paramIndex++}` : `debit_reminder_days = ?`);
      params.push(debit_reminder_days);
    }
    if (debit_reminder_hour !== undefined) {
      updates.push(isPostgres ? `debit_reminder_hour = $${paramIndex++}` : `debit_reminder_hour = ?`);
      params.push(debit_reminder_hour);
    }
    if (debit_reminder_minute !== undefined) {
      updates.push(isPostgres ? `debit_reminder_minute = $${paramIndex++}` : `debit_reminder_minute = ?`);
      params.push(debit_reminder_minute);
    }
    if (variable_reminder_enabled !== undefined) {
      updates.push(isPostgres ? `variable_reminder_enabled = $${paramIndex++}` : `variable_reminder_enabled = ?`);
      params.push(variable_reminder_enabled ? 1 : 0);
    }
    if (variable_reminder_day !== undefined) {
      updates.push(isPostgres ? `variable_reminder_day = $${paramIndex++}` : `variable_reminder_day = ?`);
      params.push(variable_reminder_day);
    }
    if (variable_reminder_hour !== undefined) {
      updates.push(isPostgres ? `variable_reminder_hour = $${paramIndex++}` : `variable_reminder_hour = ?`);
      params.push(variable_reminder_hour);
    }
    if (variable_reminder_minute !== undefined) {
      updates.push(isPostgres ? `variable_reminder_minute = $${paramIndex++}` : `variable_reminder_minute = ?`);
      params.push(variable_reminder_minute);
    }
    if (variable_snooze_minutes !== undefined) {
      updates.push(isPostgres ? `variable_snooze_minutes = $${paramIndex++}` : `variable_snooze_minutes = ?`);
      params.push(variable_snooze_minutes);
    }
    if (tolerance !== undefined) {
      updates.push(isPostgres ? `tolerance = $${paramIndex++}` : `tolerance = ?`);
      params.push(tolerance);
    }
    if (stats_window_months !== undefined) {
      updates.push(isPostgres ? `stats_window_months = $${paramIndex++}` : `stats_window_months = ?`);
      params.push(stats_window_months);
    }
    if (terms_accepted_version !== undefined) {
      updates.push(isPostgres ? `terms_accepted_version = $${paramIndex++}` : `terms_accepted_version = ?`);
      params.push(terms_accepted_version);
    }
    if (terms_accepted_at !== undefined) {
      updates.push(isPostgres ? `terms_accepted_at = $${paramIndex++}` : `terms_accepted_at = ?`);
      params.push(terms_accepted_at);
    }
    if (auto_cleanup_years !== undefined) {
      updates.push(isPostgres ? `auto_cleanup_years = $${paramIndex++}` : `auto_cleanup_years = ?`);
      params.push(auto_cleanup_years);
    }
    if (stats_comparison !== undefined) {
      updates.push(isPostgres ? `stats_comparison = $${paramIndex++}` : `stats_comparison = ?`);
      params.push(stats_comparison);
    }
    if (variable_reminder_time !== undefined) {
      updates.push(isPostgres ? `variable_reminder_time = $${paramIndex++}` : `variable_reminder_time = ?`);
      params.push(variable_reminder_time);
    }
    if (variable_reminder_scheduled !== undefined) {
      updates.push(isPostgres ? `variable_reminder_scheduled = $${paramIndex++}` : `variable_reminder_scheduled = ?`);
      params.push(variable_reminder_scheduled);
    }

    console.log('Updates to apply:', updates);
    console.log('Parameters:', params);

    if (updates.length === 0) {
      // No fields to update, just return current settings
      const sql = isPostgres
        ? 'SELECT * FROM settings WHERE user_id = $1'
        : 'SELECT * FROM settings WHERE user_id = ?';
      const settings = await queryOne(sql, [userId]);
      return res.json(settings);
    }

    updates.push(isPostgres ? `user_id = $${paramIndex++}` : `user_id = ?`);
    params.push(userId);

    const updateSql = `UPDATE settings SET ${updates.join(', ')}`;
    console.log('Update SQL:', updateSql);
    
    await run(updateSql, params);

    const sql = isPostgres
      ? 'SELECT * FROM settings WHERE user_id = $1'
      : 'SELECT * FROM settings WHERE user_id = ?';
    const settings = await queryOne(sql, [userId]);
    res.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update settings', details: error.message });
  }
});

// Update specific setting
router.patch('/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.user.id;

    // Validate key to prevent SQL injection
    const validKeys = [
      'notifications_enabled', 'debit_notifications_enabled', 'debit_reminder_days',
      'debit_reminder_hour', 'debit_reminder_minute', 'variable_reminder_enabled',
      'variable_reminder_day', 'variable_reminder_hour', 'variable_reminder_minute',
      'variable_snooze_minutes', 'tolerance', 'stats_window_months',
      'terms_accepted_version', 'terms_accepted_at', 'auto_cleanup_years',
      'stats_comparison', 'variable_reminder_time', 'variable_reminder_scheduled'
    ];

    if (!validKeys.includes(key)) {
      return res.status(400).json({ error: 'Invalid setting key' });
    }

    // Build the update query safely using the validated key
    const updateSql = isPostgres
      ? `UPDATE settings SET ${key} = $1 WHERE user_id = $2`
      : `UPDATE settings SET ${key} = ? WHERE user_id = ?`;
    await run(updateSql, [value, userId]);

    const sql = isPostgres
      ? 'SELECT * FROM settings WHERE user_id = $1'
      : 'SELECT * FROM settings WHERE user_id = ?';
    const settings = await queryOne(sql, [userId]);
    res.json(settings);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;

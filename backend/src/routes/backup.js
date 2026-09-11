const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db, isPostgres, normalizedRecurrenceMonths, currentFinancialPeriodMonth, query, queryOne, run, transaction } = require('../models/database');

// Export all user data (expenses + settings)
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get expenses
    const expensesSql = isPostgres
      ? 'SELECT * FROM expenses WHERE user_id = $1 ORDER BY id'
      : 'SELECT * FROM expenses WHERE user_id = ? ORDER BY id';
    const expensesResult = await query(expensesSql, [userId]);
    const expenses = isPostgres ? expensesResult.rows : expensesResult;

    // Get settings
    const settingsSql = isPostgres
      ? 'SELECT * FROM settings WHERE user_id = $1'
      : 'SELECT * FROM settings WHERE user_id = ?';
    const settings = await queryOne(settingsSql, [userId]);

    const backup = {
      format_version: 1,
      exported_at: new Date().toISOString(),
      user_id: userId,
      expenses: expenses,
      settings: settings
    };

    res.json(backup);
  } catch (error) {
    console.error('Export backup error:', error);
    res.status(500).json({ error: 'Failed to export backup' });
  }
});

// Import backup data
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { format_version, expenses, settings } = req.body;

    // Support both Android format (format_version) and web format
    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }

    // Log import for debugging
    console.log('Importing backup:', {
      format_version: format_version,
      expenses_count: expenses.length,
      has_settings: !!settings
    });

    // Start transaction
    await transaction(async (client) => {
      // Delete existing expenses
      const deleteExpensesSql = isPostgres
        ? 'DELETE FROM expenses WHERE user_id = $1'
        : 'DELETE FROM expenses WHERE user_id = ?';
      if (isPostgres) {
        await client.query(deleteExpensesSql, [userId]);
      } else {
        await run(deleteExpensesSql, [userId]);
      }

      // Import expenses (handle both Android and web formats)
      for (const expense of expenses) {
        // Handle Android format (amount_cents) vs web format (amount_cents)
        const amountCents = expense.amount_cents || (expense.amount ? Math.round(expense.amount * 100) : 0);
        
        // Handle Android format (paid as 0/1) vs web format (paid as boolean)
        const paid = typeof expense.paid === 'boolean' ? (expense.paid ? 1 : 0) : expense.paid;
        
        // Handle Android format (recurring as 0/1) vs web format (recurring as boolean)
        const recurring = typeof expense.recurring === 'boolean' ? (expense.recurring ? 1 : 0) : expense.recurring;
        
        // Handle Android format (fixed_amount as 0/1) vs web format (fixed_amount as boolean)
        const fixedAmount = typeof expense.fixed_amount === 'boolean' ? (expense.fixed_amount ? 1 : 0) : (expense.fixed_amount || 1);
        
        // Handle Android format (active_series as 0/1) vs web format (active_series as boolean)
        const activeSeries = typeof expense.active_series === 'boolean' ? (expense.active_series ? 1 : 0) : (expense.active_series || 1);

        const insertExpenseSql = isPostgres
          ? 'INSERT INTO expenses (user_id, series_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, active_series, recurrence_months, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)'
          : 'INSERT INTO expenses (user_id, series_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, active_series, recurrence_months, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        
        const expenseParams = [
          userId,
          expense.series_id || null,
          expense.description,
          amountCents,
          expense.debit_date,
          paid,
          recurring,
          fixedAmount,
          expense.original_day || new Date(expense.debit_date).getDate(),
          activeSeries,
          expense.recurrence_months || 1,
          expense.created_at || new Date().toISOString(),
          expense.updated_at || new Date().toISOString()
        ];

        if (isPostgres) {
          await client.query(insertExpenseSql, expenseParams);
        } else {
          await run(insertExpenseSql, expenseParams);
        }
      }

      // Import settings if provided (handle Android format)
      if (settings) {
        // Handle Android format settings
        const debitReminderDays = settings.debit_reminder_days || Math.floor((settings.hours || 24) / 24);
        const notificationsEnabled = settings.notifications_enabled !== undefined ? 
          (typeof settings.notifications_enabled === 'boolean' ? (settings.notifications_enabled ? 1 : 0) : settings.notifications_enabled) : 1;
        const debitNotificationsEnabled = settings.debit_notifications_enabled !== undefined ?
          (typeof settings.debit_notifications_enabled === 'boolean' ? (settings.debit_notifications_enabled ? 1 : 0) : settings.debit_notifications_enabled) : 1;
        const variableReminderEnabled = settings.variable_reminder_enabled !== undefined ?
          (typeof settings.variable_reminder_enabled === 'boolean' ? (settings.variable_reminder_enabled ? 1 : 0) : settings.variable_reminder_enabled) : 0;

        const updateSettingsSql = isPostgres
          ? `UPDATE settings SET
            notifications_enabled = $1,
            debit_notifications_enabled = $2,
            debit_reminder_days = $3,
            debit_reminder_hour = $4,
            debit_reminder_minute = $5,
            variable_reminder_enabled = $6,
            variable_reminder_day = $7,
            variable_reminder_hour = $8,
            variable_reminder_minute = $9,
            variable_snooze_minutes = $10,
            tolerance = $11,
            stats_window_months = $12,
            stats_comparison = $13,
            variable_reminder_time = $14,
            variable_reminder_scheduled = $15,
            terms_accepted_version = $16,
            terms_accepted_at = $17
          WHERE user_id = $18`
          : `UPDATE settings SET
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
            stats_comparison = ?,
            variable_reminder_time = ?,
            variable_reminder_scheduled = ?,
            terms_accepted_version = ?,
            terms_accepted_at = ?
          WHERE user_id = ?`;
        
        const settingsParams = [
          notificationsEnabled,
          debitNotificationsEnabled,
          debitReminderDays,
          settings.debit_reminder_hour || 9,
          settings.debit_reminder_minute || 0,
          variableReminderEnabled,
          settings.variable_reminder_day || 21,
          settings.variable_reminder_hour || 9,
          settings.variable_reminder_minute || 0,
          settings.variable_snooze_minutes || 1440,
          settings.tolerance || 2.0,
          settings.stats_window_months || 3,
          settings.stats_comparison || 'WINDOW_AVERAGE',
          settings.variable_reminder_time || 0,
          (typeof settings.variable_reminder_scheduled === 'boolean' ? (settings.variable_reminder_scheduled ? 1 : 0) : (settings.variable_reminder_scheduled || 0)),
          settings.terms_accepted_version || 0,
          settings.terms_accepted_at || null,
          userId
        ];

        if (isPostgres) {
          await client.query(updateSettingsSql, settingsParams);
        } else {
          await run(updateSettingsSql, settingsParams);
        }
      }
    });

    // Ensure future occurrences after import
    const horizon = currentFinancialPeriodMonth();
    const horizonDate = new Date(horizon);
    horizonDate.setMonth(horizonDate.getMonth() + 18);
    
    const recurringSql = isPostgres
      ? 'SELECT * FROM expenses WHERE user_id = $1 AND recurring = 1 AND active_series = 1 AND id = series_id'
      : 'SELECT * FROM expenses WHERE user_id = ? AND recurring = 1 AND active_series = 1 AND id = series_id';
    const recurringExpensesResult = await query(recurringSql, [userId]);
    const recurringExpenses = isPostgres ? recurringExpensesResult.rows : recurringExpensesResult;

    for (const root of recurringExpenses) {
      const seriesId = root.series_id || root.id;
      
      const latestSql = isPostgres
        ? 'SELECT * FROM expenses WHERE series_id = $1 AND user_id = $2 ORDER BY debit_date DESC LIMIT 1'
        : 'SELECT * FROM expenses WHERE series_id = ? AND user_id = ? ORDER BY debit_date DESC LIMIT 1';
      const latest = await queryOne(latestSql, [seriesId, userId]) || root;

      const latestDate = new Date(latest.debit_date);
      if (latestDate > horizonDate) continue;

      const interval = normalizedRecurrenceMonths(latest.recurrence_months);
      let nextDate = new Date(latestDate);
      nextDate.setMonth(nextDate.getMonth() + interval);

      while (nextDate <= horizonDate) {
        const monthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        let day = Math.min(latest.original_day, lastDay);
        let adjustedDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), day);
        
        // Skip weekends
        while (adjustedDate.getDay() === 0 || adjustedDate.getDay() === 6) {
          adjustedDate.setDate(adjustedDate.getDate() + 1);
        }

        const existingSql = isPostgres
          ? 'SELECT id FROM expenses WHERE series_id = $1 AND debit_date = $2'
          : 'SELECT id FROM expenses WHERE series_id = ? AND debit_date = ?';
        const existing = await queryOne(existingSql, [seriesId, adjustedDate.toISOString().split('T')[0]]);

        if (!existing) {
          // Android rules:
          // - If fixed_amount is true, copy the amount
          // - If fixed_amount is false, set amount to 0
          // - paid is always set to 0 (not paid) for new occurrences
          const amountCents = latest.fixed_amount ? latest.amount_cents : 0;

          const insertSql = isPostgres
            ? 'INSERT INTO expenses (user_id, series_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, recurrence_months) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'
            : 'INSERT INTO expenses (user_id, series_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, recurrence_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
          await run(insertSql, [
            userId,
            seriesId,
            latest.description,
            amountCents,
            adjustedDate.toISOString().split('T')[0],
            0, // Always start as not paid (Android behavior)
            1,
            latest.fixed_amount ? 1 : 0,
            latest.original_day,
            latest.recurrence_months
          ]);
        }

        nextDate.setMonth(nextDate.getMonth() + interval);
      }
    }

    res.json({ message: 'Backup imported successfully' });
  } catch (error) {
    console.error('Import backup error:', error);
    res.status(500).json({ error: 'Failed to import backup' });
  }
});

module.exports = router;

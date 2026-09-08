const express = require('express');
const router = express.Router();
const { authenticateToken, checkDataAccess, requireWriteAccess, requireDeleteAccess } = require('../middleware/auth');
const { db, financialPeriod, currentFinancialPeriodMonth, adjustedDebitDate, normalizedRecurrenceMonths } = require('../models/database');

// Get expenses for a specific month
router.get('/month/:month', authenticateToken, checkDataAccess, (req, res) => {
  try {
    const { month } = req.params;
    const userId = req.dataUserId;
    const period = financialPeriod(month);

    const expenses = db.prepare(`
      SELECT * FROM expenses 
      WHERE user_id = ? AND debit_date BETWEEN ? AND ?
      ORDER BY debit_date, description
    `).all(userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]);

    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to get expenses' });
  }
});

// Get recurring expenses
router.get('/recurring', authenticateToken, checkDataAccess, (req, res) => {
  try {
    const userId = req.dataUserId;
    const currentMonth = currentFinancialPeriodMonth();
    const period = financialPeriod(currentMonth);

    // Get all recurring expenses within the current financial period (21-20)
    const expenses = db.prepare(`
      SELECT * FROM expenses
      WHERE user_id = ? AND recurring = 1 AND debit_date BETWEEN ? AND ?
      ORDER BY debit_date ASC
    `).all(userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]);

    // Group by series and select the most relevant expense
    const groupedExpenses = [];
    const seenSeries = new Set();

    expenses.forEach(expense => {
      const seriesId = expense.series_id || expense.id;
      if (!seenSeries.has(seriesId)) {
        seenSeries.add(seriesId);
        groupedExpenses.push(expense);
      }
    });

    // Sort: unpaid expenses first (by date), then paid expenses (by date desc)
    groupedExpenses.sort((a, b) => {
      if (a.paid === 0 && b.paid === 1) return -1;
      if (a.paid === 1 && b.paid === 0) return 1;
      if (a.paid === 0 && b.paid === 0) {
        return new Date(a.debit_date) - new Date(b.debit_date);
      }
      return new Date(b.debit_date) - new Date(a.debit_date);
    });

    res.json(groupedExpenses);
  } catch (error) {
    console.error('Get recurring expenses error:', error);
    res.status(500).json({ error: 'Failed to get recurring expenses' });
  }
});

// Get upcoming expenses
router.get('/upcoming', authenticateToken, checkDataAccess, (req, res) => {
  try {
    const userId = req.dataUserId;
    const today = new Date().toISOString().split('T')[0];

    const expenses = db.prepare(`
      SELECT * FROM expenses 
      WHERE user_id = ? AND debit_date >= ?
      ORDER BY debit_date, description
    `).all(userId, today);

    res.json(expenses);
  } catch (error) {
    console.error('Get upcoming expenses error:', error);
    res.status(500).json({ error: 'Failed to get upcoming expenses' });
  }
});

// Get expense by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const expense = db.prepare(`
      SELECT * FROM expenses 
      WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to get expense' });
  }
});

// Get series expenses
router.get('/series/:seriesId', authenticateToken, checkDataAccess, (req, res) => {
  try {
    const { seriesId } = req.params;
    const userId = req.dataUserId;

    const expenses = db.prepare(`
      SELECT * FROM expenses 
      WHERE series_id = ? AND user_id = ?
      ORDER BY debit_date
    `).all(seriesId, userId);

    res.json(expenses);
  } catch (error) {
    console.error('Get series expenses error:', error);
    res.status(500).json({ error: 'Failed to get series expenses' });
  }
});

// Create expense
router.post('/', authenticateToken, checkDataAccess, requireWriteAccess, (req, res) => {
  try {
    const userId = req.dataUserId;
    const {
      description,
      amountCents,
      amount_cents,
      debitDate,
      debit_date,
      paid = false,
      recurring = false,
      fixedAmount,
      fixed_amount,
      originalDay,
      original_day,
      recurrenceMonths = 1,
      recurrence_months
    } = req.body;

    // Handle both naming conventions (camelCase and snake_case)
    const finalAmountCents = amountCents !== undefined ? amountCents : amount_cents;
    const finalDebitDate = debitDate !== undefined ? debitDate : debit_date;

    // Avalia corretamente se 'fixedAmount' ou 'fixed_amount' é explicitamente verdadeiro (booleano, 1 ou string "true")
    const rawFixedAmount = fixedAmount !== undefined ? fixedAmount : fixed_amount;
    const finalFixedAmount = (rawFixedAmount === true || rawFixedAmount === 1 || rawFixedAmount === 'true');

    const finalOriginalDay = originalDay !== undefined ? originalDay : original_day;
    const finalRecurrenceMonths = recurrenceMonths !== undefined ? recurrenceMonths : recurrence_months;

    if (!description || !finalDebitDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedMonths = normalizedRecurrenceMonths(finalRecurrenceMonths);
    const day = finalOriginalDay || new Date(finalDebitDate).getDate();

    const result = db.prepare(`
      INSERT INTO expenses (
        user_id, description, amount_cents, debit_date, paid,
        recurring, fixed_amount, original_day, recurrence_months
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      description,
      Math.round(finalAmountCents),
      finalDebitDate,
      paid ? 1 : 0,
      recurring ? 1 : 0,
      finalFixedAmount ? 1 : 0,
      day,
      normalizedMonths
    );

    // If recurring, set series_id and generate future occurrences
    if (recurring) {
      const expenseId = result.lastInsertRowid;
      db.prepare('UPDATE expenses SET series_id = id WHERE id = ?').run(expenseId);

      // Generate future occurrences with Android rules
      const today = new Date();
      const horizon = new Date();
      horizon.setMonth(horizon.getMonth() + 18); // 18 months ahead from today

      let nextDate = new Date(finalDebitDate);

      // Skip past occurrences, start from current or future
      while (nextDate < today) {
        nextDate.setMonth(nextDate.getMonth() + normalizedMonths);
      }

      // Generate future occurrences up to horizon
      while (nextDate <= horizon) {
        const monthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        const adjustedDate = adjustedDebitDate(monthStr, day);

        const existing = db.prepare(`
          SELECT id FROM expenses
          WHERE series_id = ? AND debit_date = ?
        `).get(expenseId, adjustedDate);

        if (!existing) {
          // Android rules:
          // - If fixed_amount is true, copy the amount
          // - If fixed_amount is false, set amount to 0
          // - paid is always set to 0 (not paid) for new occurrences
          const amountCents = finalFixedAmount ? finalAmountCents : 0;

          db.prepare(`
            INSERT INTO expenses (
              user_id, series_id, description, amount_cents, debit_date,
              paid, recurring, fixed_amount, original_day, recurrence_months
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            expenseId,
            description,
            amountCents,
            adjustedDate,
            0, // Always start as not paid (Android behavior)
            1,
            finalFixedAmount ? 1 : 0,
            day,
            normalizedMonths
          );
        }

        nextDate.setMonth(nextDate.getMonth() + normalizedMonths);
      }
    }

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
router.put('/:id', authenticateToken, checkDataAccess, requireWriteAccess, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.dataUserId;
    const {
      description,
      amountCents,
      amount_cents,
      debitDate,
      debit_date,
      paid,
      recurring,
      fixedAmount,
      fixed_amount,
      originalDay,
      original_day,
      recurrenceMonths,
      recurrence_months
    } = req.body;

    // Handle both naming conventions (camelCase and snake_case)
    const finalAmountCents = amountCents !== undefined ? amountCents : amount_cents;
    const finalDebitDate = debitDate !== undefined ? debitDate : debit_date;
    const finalFixedAmount = fixedAmount !== undefined ? fixedAmount : fixed_amount;
    const finalOriginalDay = originalDay !== undefined ? originalDay : original_day;
    const finalRecurrenceMonths = recurrenceMonths !== undefined ? recurrenceMonths : recurrence_months;

    // Check if expense belongs to user
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Validate required fields
    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (!finalDebitDate) {
      return res.status(400).json({ error: 'Debit date is required' });
    }

    // Handle empty amount for variable expenses
    let finalAmount = finalAmountCents;
    if (finalAmountCents === undefined || finalAmountCents === null || finalAmountCents === '') {
      finalAmount = 0;
    }

    const normalizedMonths = normalizedRecurrenceMonths(finalRecurrenceMonths);
    const day = finalOriginalDay || new Date(finalDebitDate).getDate();

    // If this is a recurring expense, update only this occurrence and future ones
    if (existing.recurring === 1 && existing.series_id) {
      // Update this specific occurrence
      db.prepare(`
        UPDATE expenses SET
          description = ?,
          amount_cents = ?,
          debit_date = ?,
          paid = ?,
          recurring = ?,
          fixed_amount = ?,
          original_day = ?,
          recurrence_months = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(
        description,
        Math.round(finalAmount),
        finalDebitDate,
        paid ? 1 : 0,
        recurring ? 1 : 0,
        finalFixedAmount ? 1 : 0,
        day,
        normalizedMonths,
        id,
        userId
      );

      // Update future occurrences (not past ones)
      db.prepare(`
        UPDATE expenses SET
          description = ?,
          amount_cents = ?,
          fixed_amount = ?,
          original_day = ?,
          recurrence_months = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE series_id = ? AND user_id = ? AND debit_date > ?
      `).run(
        description,
        Math.round(finalAmount),
        finalFixedAmount ? 1 : 0,
        day,
        normalizedMonths,
        existing.series_id,
        userId,
        existing.debit_date
      );
    } else {
      // Non-recurring expense, just update this one
      db.prepare(`
        UPDATE expenses SET
          description = ?,
          amount_cents = ?,
          debit_date = ?,
          paid = ?,
          recurring = ?,
          fixed_amount = ?,
          original_day = ?,
          recurrence_months = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(
        description,
        Math.round(finalAmount),
        finalDebitDate,
        paid ? 1 : 0,
        recurring ? 1 : 0,
        finalFixedAmount ? 1 : 0,
        day,
        normalizedMonths,
        id,
        userId
      );
    }

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Update paid status
router.patch('/:id/paid', authenticateToken, checkDataAccess, requireWriteAccess, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.dataUserId;
    const { paid } = req.body;

    db.prepare('UPDATE expenses SET paid = ? WHERE id = ? AND user_id = ?')
      .run(paid ? 1 : 0, id, userId);

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(expense);
  } catch (error) {
    console.error('Update paid status error:', error);
    res.status(500).json({ error: 'Failed to update paid status' });
  }
});

// Delete expense
router.delete('/:id', authenticateToken, checkDataAccess, requireDeleteAccess, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.dataUserId;
    const { wholeSeries = false } = req.query;

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(id, userId);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (wholeSeries === 'true' && expense.series_id) {
      // Delete whole series (past and future)
      db.prepare('UPDATE expenses SET active_series = 0 WHERE series_id = ?').run(expense.series_id);
      db.prepare('DELETE FROM expenses WHERE series_id = ?').run(expense.series_id);
    } else if (expense.recurring === 1 && expense.series_id) {
      // Delete this occurrence and future ones only (Android behavior)
      // First, delete this specific occurrence
      db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(id, userId);

      // Then delete future occurrences
      db.prepare('DELETE FROM expenses WHERE series_id = ? AND user_id = ? AND debit_date > ?')
        .run(expense.series_id, userId, expense.debit_date);

      // If this was the root of the series, find a new root or deactivate the series
      const remaining = db.prepare('SELECT COUNT(*) as count FROM expenses WHERE series_id = ?').get(expense.series_id);
      if (remaining.count === 0) {
        // No more occurrences, series is complete
      } else {
        // Check if we deleted the root (id == series_id)
        if (expense.id === expense.series_id) {
          // Find the next occurrence as the new root
          const nextRoot = db.prepare('SELECT id FROM expenses WHERE series_id = ? ORDER BY debit_date ASC LIMIT 1')
            .get(expense.series_id);
          if (nextRoot) {
            // Update all remaining occurrences to point to the new root
            db.prepare('UPDATE expenses SET series_id = ? WHERE series_id = ?')
              .run(nextRoot.id, expense.series_id);
          }
        }
      }
    } else {
      // Delete single non-recurring expense
      db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(id, userId);
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Ensure future occurrences
router.post('/ensure-future', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { monthsAhead = 18 } = req.body;

    const today = new Date();
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + monthsAhead);

    const recurringExpenses = db.prepare(`
      SELECT * FROM expenses 
      WHERE user_id = ? AND recurring = 1 AND active_series = 1 AND id = series_id
    `).all(userId);

    recurringExpenses.forEach(root => {
      const seriesId = root.series_id || root.id;

      const latest = db.prepare(`
        SELECT * FROM expenses 
        WHERE series_id = ? AND user_id = ?
        ORDER BY debit_date DESC
        LIMIT 1
      `).get(seriesId, userId) || root;

      const latestDate = new Date(latest.debit_date);
      if (latestDate > horizon) return;

      const interval = normalizedRecurrenceMonths(latest.recurrence_months);
      let nextDate = new Date(latestDate);

      // Skip past occurrences, start from current or future
      while (nextDate < today) {
        nextDate.setMonth(nextDate.getMonth() + interval);
      }

      while (nextDate <= horizon) {
        const monthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        const adjustedDate = adjustedDebitDate(monthStr, latest.original_day);

        const existing = db.prepare(`
          SELECT id FROM expenses
          WHERE series_id = ? AND debit_date = ?
        `).get(seriesId, adjustedDate);

        if (!existing) {
          // Android rules:
          // - If fixed_amount is true, copy the amount
          // - If fixed_amount is false, set amount to 0
          // - paid is always set to 0 (not paid) for new occurrences
          const amountCents = latest.fixed_amount ? latest.amount_cents : 0;

          db.prepare(`
            INSERT INTO expenses (
              user_id, series_id, description, amount_cents, debit_date,
              paid, recurring, fixed_amount, original_day, recurrence_months
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            seriesId,
            latest.description,
            amountCents,
            adjustedDate,
            0, // Always start as not paid (Android behavior)
            1,
            latest.fixed_amount ? 1 : 0,
            latest.original_day,
            latest.recurrence_months
          );
        }

        nextDate.setMonth(nextDate.getMonth() + interval);
      }
    });

    res.json({ message: 'Future occurrences ensured' });
  } catch (error) {
    console.error('Ensure future occurrences error:', error);
    res.status(500).json({ error: 'Failed to ensure future occurrences' });
  }
});

module.exports = router;

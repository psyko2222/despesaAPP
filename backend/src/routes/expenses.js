const express = require('express');
const router = express.Router();
const { authenticateToken, checkDataAccess, requireWriteAccess, requireDeleteAccess } = require('../middleware/auth');
const { db, isPostgres, financialPeriod, currentFinancialPeriodMonth, adjustedDebitDate, normalizedRecurrenceMonths, query, queryOne, run } = require('../models/database');

// Get expenses for a specific month
router.get('/month/:month', authenticateToken, checkDataAccess, async (req, res) => {
  try {
    const { month } = req.params;
    const userId = req.dataUserId;
    const period = financialPeriod(month);

    const sql = isPostgres
      ? 'SELECT * FROM expenses WHERE user_id = $1 AND debit_date BETWEEN $2 AND $3 ORDER BY debit_date, description'
      : 'SELECT * FROM expenses WHERE user_id = ? AND debit_date BETWEEN ? AND ? ORDER BY debit_date, description';
    const params = [userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]];
    
    const expenses = await query(sql, params);
    res.json(isPostgres ? expenses.rows : expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to get expenses' });
  }
});

// Get recurring expenses
router.get('/recurring', authenticateToken, checkDataAccess, async (req, res) => {
  try {
    const userId = req.dataUserId;
    const currentMonth = currentFinancialPeriodMonth();
    const period = financialPeriod(currentMonth);

    // Get all recurring expenses within the current financial period (21-20)
    const sql = isPostgres
      ? 'SELECT * FROM expenses WHERE user_id = $1 AND recurring = 1 AND debit_date BETWEEN $2 AND $3 ORDER BY debit_date ASC'
      : 'SELECT * FROM expenses WHERE user_id = ? AND recurring = 1 AND debit_date BETWEEN ? AND ? ORDER BY debit_date ASC';
    const params = [userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]];
    
    const expenses = await query(sql, params);
    const expensesArray = isPostgres ? expenses.rows : expenses;

    // Group by series and select the most relevant expense
    const groupedExpenses = [];
    const seenSeries = new Set();

    expensesArray.forEach(expense => {
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
router.get('/upcoming', authenticateToken, checkDataAccess, async (req, res) => {
  try {
    const userId = req.dataUserId;
    const today = new Date().toISOString().split('T')[0];

    const sql = isPostgres
      ? 'SELECT * FROM expenses WHERE user_id = $1 AND debit_date >= $2 ORDER BY debit_date, description'
      : 'SELECT * FROM expenses WHERE user_id = ? AND debit_date >= ? ORDER BY debit_date, description';
    const params = [userId, today];
    
    const expenses = await query(sql, params);
    res.json(isPostgres ? expenses.rows : expenses);
  } catch (error) {
    console.error('Get upcoming expenses error:', error);
    res.status(500).json({ error: 'Failed to get upcoming expenses' });
  }
});

// Get expense by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const sql = isPostgres
      ? 'SELECT * FROM expenses WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM expenses WHERE id = ? AND user_id = ?';
    const params = [id, userId];
    
    const expense = await queryOne(sql, params);

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
router.get('/series/:seriesId', authenticateToken, checkDataAccess, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const userId = req.dataUserId;

    const sql = isPostgres
      ? 'SELECT * FROM expenses WHERE series_id = $1 AND user_id = $2 ORDER BY debit_date'
      : 'SELECT * FROM expenses WHERE series_id = ? AND user_id = ? ORDER BY debit_date';
    const params = [seriesId, userId];
    
    const expenses = await query(sql, params);
    res.json(isPostgres ? expenses.rows : expenses);
  } catch (error) {
    console.error('Get series expenses error:', error);
    res.status(500).json({ error: 'Failed to get series expenses' });
  }
});

// Create expense
router.post('/', authenticateToken, checkDataAccess, requireWriteAccess, async (req, res) => {
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
      recurrenceMonths,
      recurrence_months
    } = req.body;

    // Handle both naming conventions (camelCase and snake_case)
    const finalAmountCents = amountCents !== undefined ? amountCents : amount_cents;
    const finalDebitDate = debitDate !== undefined ? debitDate : debit_date;

    // Avalia corretamente se 'fixedAmount' ou 'fixed_amount' é explicitamente verdadeiro (booleano, 1 ou string "true")
    const rawFixedAmount = fixedAmount !== undefined ? fixedAmount : fixed_amount;
    const finalFixedAmount = (rawFixedAmount === true || rawFixedAmount === 1 || rawFixedAmount === 'true');

    const finalOriginalDay = originalDay !== undefined ? originalDay : original_day;
    const finalRecurrenceMonths = recurrence_months !== undefined ? recurrence_months : recurrenceMonths;

    if (!description || !finalDebitDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedMonths = normalizedRecurrenceMonths(finalRecurrenceMonths);
    const day = finalOriginalDay || new Date(finalDebitDate).getDate();

    console.log('=== DEBUG: Received expense data ===', {
      recurrence_months: finalRecurrenceMonths,
      normalizedMonths: normalizedMonths,
      recurring: recurring,
      timestamp: new Date().toISOString()
    });

    const insertSql = isPostgres
      ? 'INSERT INTO expenses (user_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, recurrence_months) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id'
      : 'INSERT INTO expenses (user_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, recurrence_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const insertParams = [
      userId,
      description,
      Math.round(finalAmountCents),
      finalDebitDate,
      paid ? 1 : 0,
      recurring ? 1 : 0,
      finalFixedAmount ? 1 : 0,
      day,
      normalizedMonths
    ];
    
    const result = await run(insertSql, insertParams);
    const expenseId = isPostgres ? result.lastInsertRowid : result.lastInsertRowid;

    // If recurring, set series_id and generate future occurrences
    if (recurring) {
      const updateSeriesSql = isPostgres
        ? 'UPDATE expenses SET series_id = id WHERE id = $1'
        : 'UPDATE expenses SET series_id = id WHERE id = ?';
      await run(updateSeriesSql, [expenseId]);

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
        const debitDateStr = nextDate.toISOString().split('T')[0];

        const existingSql = isPostgres
          ? 'SELECT id FROM expenses WHERE series_id = $1 AND debit_date = $2'
          : 'SELECT id FROM expenses WHERE series_id = ? AND debit_date = ?';
        const existing = await queryOne(existingSql, [expenseId, debitDateStr]);

        if (!existing) {
          // Android rules:
          // - If fixed_amount is true, copy the amount
          // - If fixed_amount is false, set amount to 0
          // - paid is always set to 0 (not paid) for new occurrences
          const amountCents = finalFixedAmount ? finalAmountCents : 0;

          const occurrenceSql = isPostgres
            ? 'INSERT INTO expenses (user_id, series_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, recurrence_months) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'
            : 'INSERT INTO expenses (user_id, series_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, recurrence_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
          const occurrenceParams = [
            userId,
            expenseId,
            description,
            amountCents,
            debitDateStr,
            0, // Always start as not paid (Android behavior)
            1,
            finalFixedAmount ? 1 : 0,
            day,
            normalizedMonths
          ];
          await run(occurrenceSql, occurrenceParams);
        }

        nextDate.setMonth(nextDate.getMonth() + normalizedMonths);
      }
    }

    const expense = await queryOne(
      isPostgres ? 'SELECT * FROM expenses WHERE id = $1' : 'SELECT * FROM expenses WHERE id = ?',
      [expenseId]
    );
    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
router.put('/:id', authenticateToken, checkDataAccess, requireWriteAccess, async (req, res) => {
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
    const existingSql = isPostgres
      ? 'SELECT * FROM expenses WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM expenses WHERE id = ? AND user_id = ?';
    const existing = await queryOne(existingSql, [id, userId]);
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
      const updateSql = isPostgres
        ? 'UPDATE expenses SET description = $1, amount_cents = $2, debit_date = $3, paid = $4, recurring = $5, fixed_amount = $6, original_day = $7, recurrence_months = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 AND user_id = $10'
        : 'UPDATE expenses SET description = ?, amount_cents = ?, debit_date = ?, paid = ?, recurring = ?, fixed_amount = ?, original_day = ?, recurrence_months = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?';
      await run(updateSql, [
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
      ]);

      // Update future occurrences (not past ones)
      const updateFutureSql = isPostgres
        ? 'UPDATE expenses SET description = $1, amount_cents = $2, fixed_amount = $3, original_day = $4, recurrence_months = $5, updated_at = CURRENT_TIMESTAMP WHERE series_id = $6 AND user_id = $7 AND debit_date > $8'
        : 'UPDATE expenses SET description = ?, amount_cents = ?, fixed_amount = ?, original_day = ?, recurrence_months = ?, updated_at = CURRENT_TIMESTAMP WHERE series_id = ? AND user_id = ? AND debit_date > ?';
      await run(updateFutureSql, [
        description,
        Math.round(finalAmount),
        finalFixedAmount ? 1 : 0,
        day,
        normalizedMonths,
        existing.series_id,
        userId,
        existing.debit_date
      ]);
    } else {
      // Non-recurring expense, just update this one
      const updateSql = isPostgres
        ? 'UPDATE expenses SET description = $1, amount_cents = $2, debit_date = $3, paid = $4, recurring = $5, fixed_amount = $6, original_day = $7, recurrence_months = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 AND user_id = $10'
        : 'UPDATE expenses SET description = ?, amount_cents = ?, debit_date = ?, paid = ?, recurring = ?, fixed_amount = ?, original_day = ?, recurrence_months = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?';
      await run(updateSql, [
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
      ]);
    }

    const expense = await queryOne(
      isPostgres ? 'SELECT * FROM expenses WHERE id = $1' : 'SELECT * FROM expenses WHERE id = ?',
      [id]
    );
    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Update paid status
router.patch('/:id/paid', authenticateToken, checkDataAccess, requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.dataUserId;
    const { paid } = req.body;

    const updateSql = isPostgres
      ? 'UPDATE expenses SET paid = $1 WHERE id = $2 AND user_id = $3'
      : 'UPDATE expenses SET paid = ? WHERE id = ? AND user_id = ?';
    await run(updateSql, [paid ? 1 : 0, id, userId]);

    const expense = await queryOne(
      isPostgres ? 'SELECT * FROM expenses WHERE id = $1' : 'SELECT * FROM expenses WHERE id = ?',
      [id]
    );
    res.json(expense);
  } catch (error) {
    console.error('Update paid status error:', error);
    res.status(500).json({ error: 'Failed to update paid status' });
  }
});

// Delete expense
router.delete('/:id', authenticateToken, checkDataAccess, requireDeleteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.dataUserId;
    const { wholeSeries = false } = req.query;

    const expenseSql = isPostgres
      ? 'SELECT * FROM expenses WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM expenses WHERE id = ? AND user_id = ?';
    const expense = await queryOne(expenseSql, [id, userId]);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (wholeSeries === 'true' && expense.series_id) {
      // Delete whole series (past and future)
      const updateActiveSql = isPostgres
        ? 'UPDATE expenses SET active_series = 0 WHERE series_id = $1'
        : 'UPDATE expenses SET active_series = 0 WHERE series_id = ?';
      await run(updateActiveSql, [expense.series_id]);
      
      const deleteSeriesSql = isPostgres
        ? 'DELETE FROM expenses WHERE series_id = $1'
        : 'DELETE FROM expenses WHERE series_id = ?';
      await run(deleteSeriesSql, [expense.series_id]);
    } else if (expense.recurring === 1 && expense.series_id) {
      // Delete this occurrence and future ones only (Android behavior)
      // First, delete this specific occurrence
      const deleteSql = isPostgres
        ? 'DELETE FROM expenses WHERE id = $1 AND user_id = $2'
        : 'DELETE FROM expenses WHERE id = ? AND user_id = ?';
      await run(deleteSql, [id, userId]);

      // Then delete future occurrences
      const deleteFutureSql = isPostgres
        ? 'DELETE FROM expenses WHERE series_id = $1 AND user_id = $2 AND debit_date > $3'
        : 'DELETE FROM expenses WHERE series_id = ? AND user_id = ? AND debit_date > ?';
      await run(deleteFutureSql, [expense.series_id, userId, expense.debit_date]);

      // If this was the root of the series, find a new root or deactivate the series
      const countSql = isPostgres
        ? 'SELECT COUNT(*) as count FROM expenses WHERE series_id = $1'
        : 'SELECT COUNT(*) as count FROM expenses WHERE series_id = ?';
      const remaining = await queryOne(countSql, [expense.series_id]);
      if (remaining.count === 0) {
        // No more occurrences, series is complete
      } else {
        // Check if we deleted the root (id == series_id)
        if (expense.id === expense.series_id) {
          // Find the next occurrence as the new root
          const nextRootSql = isPostgres
            ? 'SELECT id FROM expenses WHERE series_id = $1 ORDER BY debit_date ASC LIMIT 1'
            : 'SELECT id FROM expenses WHERE series_id = ? ORDER BY debit_date ASC LIMIT 1';
          const nextRoot = await queryOne(nextRootSql, [expense.series_id]);
          if (nextRoot) {
            // Update all remaining occurrences to point to the new root
            const updateRootSql = isPostgres
              ? 'UPDATE expenses SET series_id = $1 WHERE series_id = $2'
              : 'UPDATE expenses SET series_id = ? WHERE series_id = ?';
            await run(updateRootSql, [nextRoot.id, expense.series_id]);
          }
        }
      }
    } else {
      // Delete single non-recurring expense
      const deleteSql = isPostgres
        ? 'DELETE FROM expenses WHERE id = $1 AND user_id = $2'
        : 'DELETE FROM expenses WHERE id = ? AND user_id = ?';
      await run(deleteSql, [id, userId]);
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Ensure future occurrences
router.post('/ensure-future', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthsAhead = 18 } = req.body;

    const today = new Date();
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + monthsAhead);

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
      if (latestDate > horizon) continue;

      const interval = normalizedRecurrenceMonths(latest.recurrence_months);
      let nextDate = new Date(latestDate);

      // Skip past occurrences, start from current or future
      while (nextDate < today) {
        nextDate.setMonth(nextDate.getMonth() + interval);
      }

      while (nextDate <= horizon) {
        const debitDateStr = nextDate.toISOString().split('T')[0];

        const existingSql = isPostgres
          ? 'SELECT id FROM expenses WHERE series_id = $1 AND debit_date = $2'
          : 'SELECT id FROM expenses WHERE series_id = ? AND debit_date = ?';
        const existing = await queryOne(existingSql, [seriesId, debitDateStr]);

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
            debitDateStr,
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

    res.json({ message: 'Future occurrences ensured' });
  } catch (error) {
    console.error('Ensure future occurrences error:', error);
    res.status(500).json({ error: 'Failed to ensure future occurrences' });
  }
});

module.exports = router;

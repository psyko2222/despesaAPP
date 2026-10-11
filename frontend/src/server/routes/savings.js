const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query, isPostgres } = require('../models/database');
const webPushService = require('../services/webPushService');

async function sendNotificationToUser(userId, { title, message, type = 'info', tag }) {
  try {
    const notifSql = isPostgres
      ? 'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)'
      : 'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)';
    await query(notifSql, [userId, title, message, type]);

    const subsSql = isPostgres
      ? 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1'
      : 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?';
    const subsResult = await query(subsSql, [userId]);
    const subscriptions = isPostgres ? (subsResult.rows || subsResult) : subsResult;

    if (subscriptions && subscriptions.length > 0) {
      for (const sub of subscriptions) {
        try {
          await webPushService.sendPushNotification(sub, {
            title,
            body: message,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            url: '/',
            tag: tag || `saving-${Date.now()}`
          });
        } catch (pushErr) {
          console.warn('Error sending push notification:', pushErr);
        }
      }
    }
  } catch (err) {
    console.error('Error sending notification to user:', err);
  }
}

let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  try {
    const sql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS savings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        target_amount_cents INTEGER DEFAULT NULL,
        current_amount_cents INTEGER NOT NULL DEFAULT 0,
        target_date VARCHAR(50) DEFAULT NULL,
        reminder_date_enabled INTEGER DEFAULT 0,
        reminder_days_before INTEGER DEFAULT 7,
        reminder_target_reached_enabled INTEGER DEFAULT 1,
        target_reached_notified INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saving_transactions (
        id SERIAL PRIMARY KEY,
        saving_id INTEGER NOT NULL REFERENCES savings(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL,
        description VARCHAR(255),
        date VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_savings_user ON savings(user_id);
      CREATE INDEX IF NOT EXISTS idx_saving_trans_saving ON saving_transactions(saving_id);
      CREATE INDEX IF NOT EXISTS idx_saving_trans_user ON saving_transactions(user_id);

      ALTER TABLE savings ADD COLUMN IF NOT EXISTS target_date VARCHAR(50) DEFAULT NULL;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_date_enabled INTEGER DEFAULT 0;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 7;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_target_reached_enabled INTEGER DEFAULT 1;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS target_reached_notified INTEGER DEFAULT 0;
    ` : `
      CREATE TABLE IF NOT EXISTS savings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        target_amount_cents INTEGER DEFAULT NULL,
        current_amount_cents INTEGER NOT NULL DEFAULT 0,
        target_date TEXT DEFAULT NULL,
        reminder_date_enabled INTEGER DEFAULT 0,
        reminder_days_before INTEGER DEFAULT 7,
        reminder_target_reached_enabled INTEGER DEFAULT 1,
        target_reached_notified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saving_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saving_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(sql);

    if (!isPostgres) {
      const sqliteCols = [
        'target_date TEXT DEFAULT NULL',
        'reminder_date_enabled INTEGER DEFAULT 0',
        'reminder_days_before INTEGER DEFAULT 7',
        'reminder_target_reached_enabled INTEGER DEFAULT 1',
        'target_reached_notified INTEGER DEFAULT 0'
      ];
      for (const col of sqliteCols) {
        try {
          await query(`ALTER TABLE savings ADD COLUMN ${col}`);
        } catch (e) {}
      }
    }

    tablesEnsured = true;
  } catch (err) {
    console.error('Error ensuring savings tables:', err);
  }
}

// Obter todas as poupanças do utilizador
router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const sql = isPostgres
      ? `SELECT s.*, 
                (SELECT COUNT(*) FROM saving_transactions st WHERE st.saving_id = s.id) as transactions_count
         FROM savings s 
         WHERE s.user_id = $1 
         ORDER BY s.id ASC`
      : `SELECT s.*, 
                (SELECT COUNT(*) FROM saving_transactions st WHERE st.saving_id = s.id) as transactions_count
         FROM savings s 
         WHERE s.user_id = ? 
         ORDER BY s.id ASC`;

    const result = await query(sql, [req.user.id]);
    const savings = isPostgres ? (result.rows || result) : result;
    res.json(savings || []);
  } catch (err) {
    console.error('Erro ao obter poupanças:', err);
    res.status(500).json({ error: 'Erro ao obter poupanças' });
  }
});

// Criar nova poupança
router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const { 
      name, 
      target_amount_cents, 
      initial_amount_cents,
      target_date,
      reminder_date_enabled,
      reminder_days_before,
      reminder_target_reached_enabled
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da poupança é obrigatório' });
    }

    const targetVal = target_amount_cents !== undefined && target_amount_cents !== null && target_amount_cents !== ''
      ? Math.max(0, parseInt(target_amount_cents, 10))
      : null;

    const initialVal = initial_amount_cents ? Math.max(0, parseInt(initial_amount_cents, 10)) : 0;
    const cleanTargetDate = target_date && target_date.trim() ? target_date.trim() : null;
    const cleanReminderDate = (reminder_date_enabled === 1 || reminder_date_enabled === true || reminder_date_enabled === '1') ? 1 : 0;
    const cleanReminderDays = parseInt(reminder_days_before, 10) || 7;
    const cleanReminderTarget = (reminder_target_reached_enabled === 0 || reminder_target_reached_enabled === false || reminder_target_reached_enabled === '0') ? 0 : 1;

    // Se o valor inicial já atinge a meta definida
    const isInitiallyCompleted = targetVal !== null && targetVal > 0 && initialVal >= targetVal;
    const targetNotified = isInitiallyCompleted ? 1 : 0;

    const insertSql = isPostgres
      ? `INSERT INTO savings (
           user_id, name, target_amount_cents, current_amount_cents,
           target_date, reminder_date_enabled, reminder_days_before,
           reminder_target_reached_enabled, target_reached_notified
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`
      : `INSERT INTO savings (
           user_id, name, target_amount_cents, current_amount_cents,
           target_date, reminder_date_enabled, reminder_days_before,
           reminder_target_reached_enabled, target_reached_notified
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const insertRes = await query(insertSql, [
      req.user.id, name.trim(), targetVal, initialVal,
      cleanTargetDate, cleanReminderDate, cleanReminderDays,
      cleanReminderTarget, targetNotified
    ]);

    let newSaving;
    if (isPostgres) {
      newSaving = insertRes.rows[0];
    } else {
      const getSql = 'SELECT * FROM savings WHERE id = ?';
      const getRes = await query(getSql, [insertRes.lastInsertRowid]);
      newSaving = getRes[0];
    }

    // Se houve valor inicial, registar transação
    if (initialVal > 0 && newSaving) {
      const today = new Date().toISOString().split('T')[0];
      const transSql = isPostgres
        ? `INSERT INTO saving_transactions (saving_id, user_id, amount_cents, type, description, date)
           VALUES ($1, $2, $3, $4, $5, $6)`
        : `INSERT INTO saving_transactions (saving_id, user_id, amount_cents, type, description, date)
           VALUES (?, ?, ?, ?, ?, ?)`;
      await query(transSql, [newSaving.id, req.user.id, initialVal, 'deposit', 'Valor inicial', today]);
    }

    // Se a meta foi atingida logo na criação e as notificações de meta estão ativas
    if (isInitiallyCompleted && cleanReminderTarget === 1) {
      const valStr = (targetVal / 100).toFixed(2).replace('.', ',') + ' €';
      await sendNotificationToUser(req.user.id, {
        title: `🎉 Meta Atingida: ${name.trim()}!`,
        message: `Parabéns! Atingiu o objetivo definido de ${valStr} na poupança "${name.trim()}"!`,
        type: 'saving_goal',
        tag: `saving-goal-${newSaving.id}`
      });
    }

    res.status(201).json(newSaving);
  } catch (err) {
    console.error('Erro ao criar poupança:', err);
    res.status(500).json({ error: 'Erro ao criar poupança' });
  }
});

// Atualizar poupança (Nome, Meta, Data Limite, Lembretes)
router.put('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const { id } = req.params;
    const { 
      name, 
      target_amount_cents,
      target_date,
      reminder_date_enabled,
      reminder_days_before,
      reminder_target_reached_enabled
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da poupança é obrigatório' });
    }

    const targetVal = target_amount_cents !== undefined && target_amount_cents !== null && target_amount_cents !== ''
      ? Math.max(0, parseInt(target_amount_cents, 10))
      : null;

    const cleanTargetDate = target_date && target_date.trim() ? target_date.trim() : null;
    const cleanReminderDate = (reminder_date_enabled === 1 || reminder_date_enabled === true || reminder_date_enabled === '1') ? 1 : 0;
    const cleanReminderDays = parseInt(reminder_days_before, 10) || 7;
    const cleanReminderTarget = (reminder_target_reached_enabled === 0 || reminder_target_reached_enabled === false || reminder_target_reached_enabled === '0') ? 0 : 1;

    // Obter estado anterior da poupança
    const currentSql = isPostgres
      ? 'SELECT * FROM savings WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM savings WHERE id = ? AND user_id = ?';
    const currentRes = await query(currentSql, [id, req.user.id]);
    const prevSaving = isPostgres ? currentRes.rows[0] : currentRes[0];

    if (!prevSaving) {
      return res.status(404).json({ error: 'Poupança não encontrada' });
    }

    let targetNotified = prevSaving.target_reached_notified || 0;
    const currentAmount = prevSaving.current_amount_cents || 0;

    let shouldNotifyGoal = false;
    if (targetVal !== null && targetVal > 0 && currentAmount >= targetVal) {
      if (cleanReminderTarget === 1 && targetNotified === 0) {
        shouldNotifyGoal = true;
        targetNotified = 1;
      }
    } else {
      targetNotified = 0;
    }

    const updateSql = isPostgres
      ? `UPDATE savings 
         SET name = $1, target_amount_cents = $2, target_date = $3,
             reminder_date_enabled = $4, reminder_days_before = $5,
             reminder_target_reached_enabled = $6, target_reached_notified = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 AND user_id = $9 RETURNING *`
      : `UPDATE savings 
         SET name = ?, target_amount_cents = ?, target_date = ?,
             reminder_date_enabled = ?, reminder_days_before = ?,
             reminder_target_reached_enabled = ?, target_reached_notified = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`;

    const updateRes = await query(updateSql, [
      name.trim(), targetVal, cleanTargetDate,
      cleanReminderDate, cleanReminderDays,
      cleanReminderTarget, targetNotified,
      id, req.user.id
    ]);
    const updated = isPostgres ? updateRes.rows[0] : null;

    if (shouldNotifyGoal) {
      const valStr = (targetVal / 100).toFixed(2).replace('.', ',') + ' €';
      await sendNotificationToUser(req.user.id, {
        title: `🎉 Meta Atingida: ${name.trim()}!`,
        message: `Parabéns! Atingiu o objetivo definido de ${valStr} na poupança "${name.trim()}"!`,
        type: 'saving_goal',
        tag: `saving-goal-${id}`
      });
    }

    res.json(updated || { 
      id, 
      name: name.trim(), 
      target_amount_cents: targetVal,
      target_date: cleanTargetDate,
      reminder_date_enabled: cleanReminderDate,
      reminder_days_before: cleanReminderDays,
      reminder_target_reached_enabled: cleanReminderTarget
    });
  } catch (err) {
    console.error('Erro ao atualizar poupança:', err);
    res.status(500).json({ error: 'Erro ao atualizar poupança' });
  }
});

// Apagar poupança
router.delete('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const { id } = req.params;
    const deleteSql = isPostgres
      ? 'DELETE FROM savings WHERE id = $1 AND user_id = $2'
      : 'DELETE FROM savings WHERE id = ? AND user_id = ?';

    await query(deleteSql, [id, req.user.id]);
    res.json({ success: true, message: 'Poupança apagada com sucesso' });
  } catch (err) {
    console.error('Erro ao apagar poupança:', err);
    res.status(500).json({ error: 'Erro ao apagar poupança' });
  }
});

// Obter transações / histórico de uma poupança
router.get('/:id/transactions', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const { id } = req.params;
    const sql = isPostgres
      ? `SELECT * FROM saving_transactions 
         WHERE saving_id = $1 AND user_id = $2 
         ORDER BY date DESC, id DESC`
      : `SELECT * FROM saving_transactions 
         WHERE saving_id = ? AND user_id = ? 
         ORDER BY date DESC, id DESC`;

    const result = await query(sql, [id, req.user.id]);
    const transactions = isPostgres ? (result.rows || result) : result;
    res.json(transactions || []);
  } catch (err) {
    console.error('Erro ao obter transações:', err);
    res.status(500).json({ error: 'Erro ao obter transações' });
  }
});

// Adicionar ou subtrair valor (transação)
router.post('/:id/transactions', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const { id } = req.params;
    const { amount_cents, type, description, date } = req.body;

    const amount = parseInt(amount_cents, 10);
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'O valor deve ser superior a zero' });
    }

    if (type !== 'deposit' && type !== 'withdraw') {
      return res.status(400).json({ error: 'Tipo inválido (deve ser "deposit" ou "withdraw")' });
    }

    // Verificar se poupança existe e pertence ao utilizador
    const checkSql = isPostgres
      ? 'SELECT * FROM savings WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM savings WHERE id = ? AND user_id = ?';
    const checkRes = await query(checkSql, [id, req.user.id]);
    const saving = isPostgres ? checkRes.rows[0] : checkRes[0];

    if (!saving) {
      return res.status(404).json({ error: 'Poupança não encontrada' });
    }

    // Se for withdraw, validar saldo se não quiser deixar negativo
    if (type === 'withdraw' && saving.current_amount_cents < amount) {
      return res.status(400).json({ 
        error: `Saldo insuficiente na poupança. Saldo atual: ${(saving.current_amount_cents / 100).toFixed(2)}€` 
      });
    }

    const txDate = date || new Date().toISOString().split('T')[0];
    const txDesc = description && description.trim() ? description.trim() : (type === 'deposit' ? 'Depósito' : 'Retirada');

    // Inserir transação
    const insertTxSql = isPostgres
      ? `INSERT INTO saving_transactions (saving_id, user_id, amount_cents, type, description, date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`
      : `INSERT INTO saving_transactions (saving_id, user_id, amount_cents, type, description, date)
         VALUES (?, ?, ?, ?, ?, ?)`;
    const txRes = await query(insertTxSql, [id, req.user.id, amount, type, txDesc, txDate]);
    const newTx = isPostgres ? txRes.rows[0] : null;

    // Atualizar saldo da poupança
    const delta = type === 'deposit' ? amount : -amount;
    const newAmount = (saving.current_amount_cents || 0) + delta;

    let targetNotified = saving.target_reached_notified || 0;
    let shouldNotifyGoal = false;

    if (type === 'deposit') {
      if (saving.target_amount_cents !== null && saving.target_amount_cents > 0) {
        if (newAmount >= saving.target_amount_cents && targetNotified === 0 && saving.reminder_target_reached_enabled === 1) {
          shouldNotifyGoal = true;
          targetNotified = 1;
        }
      }
    } else if (type === 'withdraw') {
      if (saving.target_amount_cents !== null && newAmount < saving.target_amount_cents) {
        targetNotified = 0;
      }
    }

    const updateSavingSql = isPostgres
      ? `UPDATE savings 
         SET current_amount_cents = current_amount_cents + $1, target_reached_notified = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4 RETURNING *`
      : `UPDATE savings 
         SET current_amount_cents = current_amount_cents + ?, target_reached_notified = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`;
    const updateRes = await query(updateSavingSql, [delta, targetNotified, id, req.user.id]);
    const updatedSaving = isPostgres ? updateRes.rows[0] : null;

    if (shouldNotifyGoal) {
      const valStr = (saving.target_amount_cents / 100).toFixed(2).replace('.', ',') + ' €';
      await sendNotificationToUser(req.user.id, {
        title: `🎉 Meta Atingida: ${saving.name}!`,
        message: `Parabéns! Atingiu o objetivo definido de ${valStr} na poupança "${saving.name}"!`,
        type: 'saving_goal',
        tag: `saving-goal-${saving.id}`
      });
    }

    res.json({
      success: true,
      saving: updatedSaving,
      transaction: newTx
    });
  } catch (err) {
    console.error('Erro ao registar movimento na poupança:', err);
    res.status(500).json({ error: 'Erro ao registar movimento' });
  }
});

// Apagar uma transação específica (e reverter saldo)
router.delete('/transactions/:txId', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const { txId } = req.params;
    const findSql = isPostgres
      ? 'SELECT * FROM saving_transactions WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM saving_transactions WHERE id = ? AND user_id = ?';
    const findRes = await query(findSql, [txId, req.user.id]);
    const tx = isPostgres ? findRes.rows[0] : findRes[0];

    if (!tx) {
      return res.status(404).json({ error: 'Movimento não encontrado' });
    }

    // Reverter o saldo da poupança (se era deposit, subtrai; se era withdraw, adiciona)
    const revertDelta = tx.type === 'deposit' ? -tx.amount_cents : tx.amount_cents;
    const updateSql = isPostgres
      ? `UPDATE savings SET current_amount_cents = current_amount_cents + $1 WHERE id = $2 AND user_id = $3`
      : `UPDATE savings SET current_amount_cents = current_amount_cents + ? WHERE id = ? AND user_id = ?`;
    await query(updateSql, [revertDelta, tx.saving_id, req.user.id]);

    // Apagar transação
    const delSql = isPostgres
      ? 'DELETE FROM saving_transactions WHERE id = $1 AND user_id = $2'
      : 'DELETE FROM saving_transactions WHERE id = ? AND user_id = ?';
    await query(delSql, [txId, req.user.id]);

    res.json({ success: true, message: 'Movimento cancelado e saldo revertido' });
  } catch (err) {
    console.error('Erro ao apagar movimento:', err);
    res.status(500).json({ error: 'Erro ao apagar movimento' });
  }
});

module.exports = router;


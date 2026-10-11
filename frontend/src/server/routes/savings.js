const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query, isPostgres } = require('../models/database');

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
    ` : `
      CREATE TABLE IF NOT EXISTS savings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        target_amount_cents INTEGER DEFAULT NULL,
        current_amount_cents INTEGER NOT NULL DEFAULT 0,
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
    const { name, target_amount_cents, initial_amount_cents } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da poupança é obrigatório' });
    }

    const targetVal = target_amount_cents !== undefined && target_amount_cents !== null && target_amount_cents !== ''
      ? Math.max(0, parseInt(target_amount_cents, 10))
      : null;

    const initialVal = initial_amount_cents ? Math.max(0, parseInt(initial_amount_cents, 10)) : 0;

    const insertSql = isPostgres
      ? `INSERT INTO savings (user_id, name, target_amount_cents, current_amount_cents)
         VALUES ($1, $2, $3, $4) RETURNING *`
      : `INSERT INTO savings (user_id, name, target_amount_cents, current_amount_cents)
         VALUES (?, ?, ?, ?)`;

    const insertRes = await query(insertSql, [req.user.id, name.trim(), targetVal, initialVal]);
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

    res.status(201).json(newSaving);
  } catch (err) {
    console.error('Erro ao criar poupança:', err);
    res.status(500).json({ error: 'Erro ao criar poupança' });
  }
});

// Atualizar poupança (Nome ou Meta)
router.put('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const { id } = req.params;
    const { name, target_amount_cents } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da poupança é obrigatório' });
    }

    const targetVal = target_amount_cents !== undefined && target_amount_cents !== null && target_amount_cents !== ''
      ? Math.max(0, parseInt(target_amount_cents, 10))
      : null;

    const updateSql = isPostgres
      ? `UPDATE savings 
         SET name = $1, target_amount_cents = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4 RETURNING *`
      : `UPDATE savings 
         SET name = ?, target_amount_cents = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`;

    const updateRes = await query(updateSql, [name.trim(), targetVal, id, req.user.id]);
    const updated = isPostgres ? updateRes.rows[0] : null;

    if (isPostgres && !updated) {
      return res.status(404).json({ error: 'Poupança não encontrada' });
    }

    res.json(updated || { id, name: name.trim(), target_amount_cents: targetVal });
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
    const updateSavingSql = isPostgres
      ? `UPDATE savings 
         SET current_amount_cents = current_amount_cents + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND user_id = $3 RETURNING *`
      : `UPDATE savings 
         SET current_amount_cents = current_amount_cents + ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`;
    const updateRes = await query(updateSavingSql, [delta, id, req.user.id]);
    const updatedSaving = isPostgres ? updateRes.rows[0] : null;

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

const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

let db;
let isPostgres = false;

if (process.env.DATABASE_URL) {
  isPostgres = true;
  console.log('Using PostgreSQL database');
  console.log('DATABASE_URL is set:', process.env.DATABASE_URL ? 'Yes' : 'No');
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.log('Using SQLite database');
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../despesas.db');
  console.log('Database path:', dbPath);
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
}

async function initializeDatabase() {
  if (!isPostgres) {
    // Inicialização original para SQLite
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT,
        fcm_token TEXT
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        series_id INTEGER,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        debit_date TEXT NOT NULL,
        paid INTEGER NOT NULL DEFAULT 0,
        recurring INTEGER NOT NULL DEFAULT 0,
        fixed_amount INTEGER NOT NULL DEFAULT 1,
        original_day INTEGER NOT NULL,
        active_series INTEGER NOT NULL DEFAULT 1,
        recurrence_months INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        notifications_enabled INTEGER DEFAULT 1,
        debit_notifications_enabled INTEGER DEFAULT 1,
        debit_reminder_days INTEGER DEFAULT 1,
        debit_reminder_hour INTEGER DEFAULT 9,
        debit_reminder_minute INTEGER DEFAULT 0,
        variable_reminder_enabled INTEGER DEFAULT 0,
        variable_reminder_day INTEGER DEFAULT 21,
        variable_reminder_hour INTEGER DEFAULT 9,
        variable_reminder_minute INTEGER DEFAULT 0,
        variable_snooze_minutes INTEGER DEFAULT 1440,
        tolerance REAL DEFAULT 2.0,
        stats_window_months INTEGER DEFAULT 3,
        terms_accepted_version INTEGER DEFAULT 0,
        terms_accepted_at TEXT,
        auto_cleanup_years INTEGER DEFAULT 0,
        stats_comparison TEXT DEFAULT 'WINDOW_AVERAGE',
        variable_reminder_time INTEGER DEFAULT 0,
        variable_reminder_scheduled INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS account_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        shared_with_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        can_read INTEGER DEFAULT 1,
        can_write INTEGER DEFAULT 1,
        can_delete INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(owner_id, shared_with_id)
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_approval_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT,
        processed_by INTEGER,
        new_password TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT DEFAULT 'error' CHECK(level IN ('error', 'warning', 'info')),
        message TEXT NOT NULL,
        details TEXT,
        user_id INTEGER,
        route TEXT,
        method TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, debit_date);
      CREATE INDEX IF NOT EXISTS idx_expenses_series ON expenses(series_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(user_id, recurring, active_series);
      CREATE INDEX IF NOT EXISTS idx_shares_owner ON account_shares(owner_id, status);
      CREATE INDEX IF NOT EXISTS idx_shares_shared_with ON account_shares(shared_with_id, status);
      CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_approval_token ON user_approval_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_user_approval_user ON user_approval_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
      CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
    `);
    console.log('SQLite Database initialized successfully');
    return;
  }

  // Inicialização para PostgreSQL
  console.log('Connecting to PostgreSQL...');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    console.log('PostgreSQL transaction started');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        role VARCHAR(50) DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        fcm_token VARCHAR(500)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        series_id INTEGER,
        description VARCHAR(255) NOT NULL,
        amount_cents INTEGER NOT NULL,
        debit_date VARCHAR(50) NOT NULL,
        paid INTEGER NOT NULL DEFAULT 0,
        recurring INTEGER NOT NULL DEFAULT 0,
        fixed_amount INTEGER NOT NULL DEFAULT 1,
        original_day INTEGER NOT NULL,
        active_series INTEGER NOT NULL DEFAULT 1,
        recurrence_months INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        notifications_enabled INTEGER DEFAULT 1,
        debit_notifications_enabled INTEGER DEFAULT 1,
        debit_reminder_days INTEGER DEFAULT 1,
        debit_reminder_hour INTEGER DEFAULT 9,
        debit_reminder_minute INTEGER DEFAULT 0,
        variable_reminder_enabled INTEGER DEFAULT 0,
        variable_reminder_day INTEGER DEFAULT 21,
        variable_reminder_hour INTEGER DEFAULT 9,
        variable_reminder_minute INTEGER DEFAULT 0,
        variable_snooze_minutes INTEGER DEFAULT 1440,
        tolerance REAL DEFAULT 2.0,
        stats_window_months INTEGER DEFAULT 3,
        terms_accepted_version INTEGER DEFAULT 0,
        terms_accepted_at VARCHAR(50),
        auto_cleanup_years INTEGER DEFAULT 0,
        stats_comparison VARCHAR(50) DEFAULT 'WINDOW_AVERAGE',
        variable_reminder_time INTEGER DEFAULT 0,
        variable_reminder_scheduled INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS account_shares (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shared_with_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        can_read INTEGER DEFAULT 1,
        can_write INTEGER DEFAULT 1,
        can_delete INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner_id, shared_with_id)
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at VARCHAR(100) NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_approval_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at VARCHAR(100) NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        new_password VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(50) DEFAULT 'error' CHECK(level IN ('error', 'warning', 'info')),
        message TEXT NOT NULL,
        details TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        route VARCHAR(255),
        method VARCHAR(10),
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, debit_date);
      CREATE INDEX IF NOT EXISTS idx_expenses_series ON expenses(series_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(user_id, recurring, active_series);
      CREATE INDEX IF NOT EXISTS idx_shares_owner ON account_shares(owner_id, status);
      CREATE INDEX IF NOT EXISTS idx_shares_shared_with ON account_shares(shared_with_id, status);
      CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_approval_token ON user_approval_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_user_approval_user ON user_approval_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
      CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
    `);

    await client.query('COMMIT');
    console.log('PostgreSQL Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL database:', error);
  } finally {
    client.release();
  }
}

// Help helpers
function financialPeriod(startMonth) {
  const [year, month] = startMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 21);
  const endDate = new Date(year, month, 20);
  return { start: startDate, end: endDate };
}

function currentFinancialPeriodMonth(date = new Date()) {
  if (date.getDate() >= 21) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } else {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  }
}

function adjustedDebitDate(month, originalDay) {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  let day = Math.min(originalDay, lastDay);
  let date = new Date(year, monthNum - 1, day);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString().split('T')[0];
}

function normalizedRecurrenceMonths(months) {
  return Math.max(1, Math.min(60, months));
}

// Database abstraction layer for compatibility between SQLite and PostgreSQL
function query(sql, params = []) {
  if (isPostgres) {
    // PostgreSQL - async query
    return db.query(sql, params);
  } else {
    // SQLite - sync query
    return db.prepare(sql).all(...params);
  }
}

function queryOne(sql, params = []) {
  if (isPostgres) {
    // PostgreSQL - async query for single row
    return db.query(sql, params).then(result => result.rows[0]);
  } else {
    // SQLite - sync query for single row
    return db.prepare(sql).get(...params);
  }
}

function run(sql, params = []) {
  if (isPostgres) {
    // PostgreSQL - async insert/update
    return db.query(sql, params).then(result => ({
      lastInsertRowid: result.rows[0]?.id,
      changes: result.rowCount
    }));
  } else {
    // SQLite - sync insert/update
    return db.prepare(sql).run(...params);
  }
}

async function transaction(callback) {
  if (isPostgres) {
    // PostgreSQL transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    // SQLite transaction (sync)
    return db.transaction(callback)();
  }
}

module.exports = {
  db,
  isPostgres,
  initializeDatabase,
  financialPeriod,
  currentFinancialPeriodMonth,
  adjustedDebitDate,
  normalizedRecurrenceMonths,
  query,
  queryOne,
  run,
  transaction
};
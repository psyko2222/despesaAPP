const { Pool } = require('pg');

let pool = null;

function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.URL_DO_BANCO_DE_DADOS;
    if (!connectionString) {
      console.warn('DATABASE_URL is not set in environment variables');
    }
    pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    ensureInitialized();
  }
  return pool;
}

const isPostgres = true;

let initPromise = null;
function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeDatabase().catch(err => {
      console.error('Database migration error:', err);
    });
  }
  return initPromise;
}

async function initializeDatabase() {
  const db = getDb();
  console.log('Connecting to PostgreSQL...');
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        role VARCHAR(50) DEFAULT 'user' CHECK(role IN ('user', 'admin', 'admin_private')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
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
        is_private INTEGER DEFAULT 0,
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
        variable_reminder_scheduled INTEGER DEFAULT 0,
        second_debit_reminder_enabled INTEGER DEFAULT 0,
        second_debit_reminder_days INTEGER DEFAULT 0,
        same_day_reminder_enabled INTEGER DEFAULT 1,
        no_value_reminder_enabled INTEGER DEFAULT 0,
        no_value_reminder_days VARCHAR(50) DEFAULT '1,10,15,20'
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

      CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, message TEXT NOT NULL, type VARCHAR(50) DEFAULT 'info', is_read INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id); CREATE TABLE IF NOT EXISTS error_logs (
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

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
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
        is_private INTEGER DEFAULT 0,
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

      ALTER TABLE settings ADD COLUMN IF NOT EXISTS second_debit_reminder_enabled INTEGER DEFAULT 0;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS second_debit_reminder_days INTEGER DEFAULT 0;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS same_day_reminder_enabled INTEGER DEFAULT 1;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS no_value_reminder_enabled INTEGER DEFAULT 0;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS no_value_reminder_days VARCHAR(50) DEFAULT '1,10,15,20';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS backup_reminder_enabled INTEGER DEFAULT 1;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS backup_reminder_day INTEGER DEFAULT 21;

      ALTER TABLE savings ADD COLUMN IF NOT EXISTS target_date VARCHAR(50) DEFAULT NULL;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_date_enabled INTEGER DEFAULT 0;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 7;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_target_reached_enabled INTEGER DEFAULT 1;
      ALTER TABLE savings ADD COLUMN IF NOT EXISTS target_reached_notified INTEGER DEFAULT 0;
    `);

    await client.query('COMMIT');

    // Executar migrações individuais de forma segura (garantir colunas)
    const individualMigrations = [
      'ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_private INTEGER DEFAULT 0;',
      'ALTER TABLE savings ADD COLUMN IF NOT EXISTS is_private INTEGER DEFAULT 0;',
      'ALTER TABLE savings ADD COLUMN IF NOT EXISTS target_date VARCHAR(50) DEFAULT NULL;',
      'ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_date_enabled INTEGER DEFAULT 0;',
      'ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 7;',
      'ALTER TABLE savings ADD COLUMN IF NOT EXISTS reminder_target_reached_enabled INTEGER DEFAULT 1;',
      'ALTER TABLE savings ADD COLUMN IF NOT EXISTS target_reached_notified INTEGER DEFAULT 0;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS second_debit_reminder_enabled INTEGER DEFAULT 0;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS second_debit_reminder_days INTEGER DEFAULT 0;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS same_day_reminder_enabled INTEGER DEFAULT 1;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS no_value_reminder_enabled INTEGER DEFAULT 0;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS no_value_reminder_days VARCHAR(50) DEFAULT \'1,10,15,20\';',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS backup_reminder_enabled INTEGER DEFAULT 1;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS backup_reminder_day INTEGER DEFAULT 21;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS drive_backup_enabled INTEGER DEFAULT 0;',
      'ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_cleanup_years NUMERIC(4,2) DEFAULT 0;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;',
      'ALTER TABLE users ALTER COLUMN google_refresh_token TYPE TEXT;',
      'ALTER TABLE settings ALTER COLUMN auto_cleanup_years TYPE NUMERIC(4,2);'
    ];

    for (const sql of individualMigrations) {
      try {
        await client.query(sql);
      } catch (colErr) {
        console.warn('Migration column warning:', colErr.message);
      }
    }

    // Atualizar check constraints na tabela users para role
    try {
      const constraintsQuery = `
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'users'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) LIKE '%role%';
      `;
      const constrRes = await client.query(constraintsQuery);
      for (const row of constrRes.rows) {
        try {
          await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "${row.conname}";`);
        } catch (e) {
          console.warn('Drop constraint warning:', e.message);
        }
      }
      await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('user', 'admin', 'admin_private'));`);
    } catch (conErr) {
      console.warn('Check constraint update warning:', conErr.message);
    }

    // Promover luiszambujo@hotmail.com
    try {
      await client.query(`UPDATE users SET role = 'admin_private' WHERE LOWER(email) = 'luiszambujo@hotmail.com';`);
    } catch (uErr) {
      console.warn('User role update warning:', uErr.message);
    }

    console.log('PostgreSQL Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error initializing PostgreSQL database:', error);
  } finally {
    client.release();
  }
}

// Helpers
function financialPeriod(startMonth) {
  const [year, month] = startMonth.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 21));
  const endDate = new Date(Date.UTC(year, month, 20));
  return { start: startDate, end: endDate };
}

function getPreviousMonth(month, offset = 1) {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNum - 1 - offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
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

// Database helper functions for PostgreSQL
async function query(sql, params = []) {
  await ensureInitialized();
  return getDb().query(sql, params);
}

async function queryOne(sql, params = []) {
  await ensureInitialized();
  return getDb().query(sql, params).then(result => result.rows[0]);
}

async function run(sql, params = []) {
  await ensureInitialized();
  return getDb().query(sql, params).then(result => ({
    lastInsertRowid: result.rows[0]?.id,
    changes: result.rowCount
  }));
}

async function transaction(callback) {
  await ensureInitialized();
  const client = await getDb().connect();
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
}

module.exports = {
  get db() { return getDb(); },
  isPostgres: true,
  initializeDatabase,
  ensureInitialized,
  financialPeriod,
  getPreviousMonth,
  currentFinancialPeriodMonth,
  adjustedDebitDate,
  normalizedRecurrenceMonths,
  query,
  queryOne,
  run,
  transaction
};
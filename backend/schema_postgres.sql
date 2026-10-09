-- ==============================================================================
-- Schema Completo e Atualizado da Base de Dados Despesas (PostgreSQL)
-- Este ficheiro contém todas as tabelas, índices e restrições da versão mais recente.
-- ==============================================================================

-- 1. Tabela de Utilizadores
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    role VARCHAR(50) DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- 2. Tabela de Despesas
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

-- 3. Tabela de Definições de Utilizador
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

-- 4. Tabela de Partilha de Contas (Multi-utilizador)
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

-- 5. Tokens de Redefinição de Palavra-passe
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at VARCHAR(100) NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tokens de Aprovação de Novos Utilizadores
CREATE TABLE IF NOT EXISTS user_approval_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at VARCHAR(100) NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Pedidos de Recuperação de Palavra-passe
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    new_password VARCHAR(255)
);

-- 8. Registo de Erros e Logs do Sistema
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

-- 9. Subscrições Web Push (VAPID)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- Índices para Máxima Performance de Consultas
-- ==============================================================================
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


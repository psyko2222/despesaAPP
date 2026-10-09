const { query, isPostgres } = require('./src/server/models/database');

async function run() {
  try {
    if (isPostgres) {
       await query(`
         CREATE TABLE IF NOT EXISTS notifications (
           id SERIAL PRIMARY KEY,
           user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           title VARCHAR(255) NOT NULL,
           message TEXT NOT NULL,
           type VARCHAR(50) DEFAULT 'info',
           is_read INTEGER DEFAULT 0,
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         );
         CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
       `);
       console.log('Notifications table created');
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();


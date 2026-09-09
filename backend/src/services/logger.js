const { db } = require('../models/database');

function logError({ level = 'error', message, details = null, userId = null, route = null, method = null, ipAddress = null }) {
  try {
    const detailsString = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null;
    
    if (db.prepare) {
      // SQLite
      db.prepare(`
        INSERT INTO error_logs (level, message, details, user_id, route, method, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(level, message, detailsString, userId, route, method, ipAddress);
    } else {
      // PostgreSQL
      db.query(`
        INSERT INTO error_logs (level, message, details, user_id, route, method, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [level, message, detailsString, userId, route, method, ipAddress]);
    }
  } catch (error) {
    console.error('Failed to log error:', error);
  }
}

function getLogs({ limit = 100, offset = 0, level = null, userId = null } = {}) {
  try {
    let query = 'SELECT * FROM error_logs';
    const conditions = [];
    const params = [];

    if (level) {
      conditions.push('level = ?');
      params.push(level);
    }

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    if (db.prepare) {
      return db.prepare(query).all(...params);
    } else {
      return db.query(query, params);
    }
  } catch (error) {
    console.error('Failed to get logs:', error);
    return [];
  }
}

function clearLogs({ olderThanDays = 30 } = {}) {
  try {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    
    if (db.prepare) {
      const result = db.prepare('DELETE FROM error_logs WHERE created_at < ?').run(cutoffDate);
      return { deleted: result.changes };
    } else {
      const result = db.query('DELETE FROM error_logs WHERE created_at < $1', [cutoffDate]);
      return { deleted: result.rowCount };
    }
  } catch (error) {
    console.error('Failed to clear logs:', error);
    return { deleted: 0 };
  }
}

module.exports = {
  logError,
  getLogs,
  clearLogs
};

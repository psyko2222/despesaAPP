const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getLogs, clearLogs } = require('../services/logger');

// Get all error logs (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const level = req.query.level || null;
    const userId = req.query.userId ? parseInt(req.query.userId) : null;

    const logs = getLogs({ limit, offset, level, userId });
    
    res.json({
      logs,
      count: logs.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Clear old logs (admin only)
router.delete('/clear', authenticateToken, requireAdmin, (req, res) => {
  try {
    const olderThanDays = parseInt(req.query.olderThanDays) || 30;
    const result = clearLogs({ olderThanDays });
    
    res.json({
      message: 'Logs cleared successfully',
      deleted: result.deleted
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

module.exports = router;

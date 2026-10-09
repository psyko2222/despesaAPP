const express = require('express');
const cors = require('cors');

const app = express();

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/shares', require('./routes/shares'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/push', require('./routes/push'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/google', require('./routes/google'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tratamento de rota nÃ£o encontrada
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint nÃ£o encontrado' });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;


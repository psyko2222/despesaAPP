# Despesas Backend API

Backend Node.js/Express para a aplicação Despesas, compatível com Android, iOS e Web.

## Funcionalidades

- ✅ Autenticação de utilizadores (JWT)
- ✅ Gestão completa de despesas
- ✅ Despesas recorrentes com periodicidade
- ✅ Sistema de períodos financeiros (21-20)
- ✅ Backup e restauração de dados
- ✅ Definições personalizáveis
- ✅ Notificações (preparado para integração)

## Instalação

```bash
npm install
```

## Configuração

1. Copiar `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Editar `.env` com as tuas configurações:
```
PORT=3000
JWT_SECRET=your-secret-key-change-this
DATABASE_PATH=./despesas.db
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

## Executar

### Modo desenvolvimento
```bash
npm run dev
```

### Modo produção
```bash
npm start
```

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registar novo utilizador
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Obter utilizador atual

### Despesas
- `GET /api/expenses/month/:month` - Despesas de um mês
- `GET /api/expenses/recurring` - Despesas recorrentes
- `GET /api/expenses/upcoming` - Próximas despesas
- `GET /api/expenses/:id` - Obter despesa por ID
- `GET /api/expenses/series/:seriesId` - Obter série de despesas
- `POST /api/expenses` - Criar despesa
- `PUT /api/expenses/:id` - Atualizar despesa
- `PATCH /api/expenses/:id/paid` - Atualizar estado pago
- `DELETE /api/expenses/:id` - Apagar despesa
- `POST /api/expenses/ensure-future` - Garantir ocorrências futuras

### Definições
- `GET /api/settings` - Obter definições
- `PUT /api/settings` - Atualizar definições
- `PATCH /api/settings/:key` - Atualizar definição específica

### Backup
- `GET /api/backup/export` - Exportar backup
- `POST /api/backup/import` - Importar backup

## Estrutura da Base de Dados

### Users
- id, email, password, created_at, last_login

### Expenses
- id, user_id, series_id, description, amount_cents, debit_date, paid, recurring, fixed_amount, original_day, active_series, recurrence_months, created_at, updated_at

### Settings
- id, user_id, notifications_enabled, debit_notifications_enabled, debit_reminder_days, debit_reminder_hour, debit_reminder_minute, variable_reminder_enabled, variable_reminder_day, variable_reminder_hour, variable_reminder_minute, variable_snooze_minutes, tolerance, stats_window_months, terms_accepted_version, terms_accepted_at

## Compatibilidade

- ✅ Android (via WebView ou API)
- ✅ iOS (via WebView ou API)
- ✅ Web (Next.js frontend)
- ✅ Desktop (qualquer browser)

## Segurança

- Tokens JWT com expiração de 7 dias
- Passwords hashed com bcrypt
- CORS configurado
- Validação de inputs
- Proteção contra SQL injection (prepared statements)

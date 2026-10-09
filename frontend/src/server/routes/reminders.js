const express = require('express');
const router = express.Router();
const { db, isPostgres, financialPeriod, currentFinancialPeriodMonth, query, queryOne, run } = require('../models/database');
const webPushService = require('../services/webPushService');
const { uploadBackup, rotateBackups } = require('../services/googleDriveService');

const CRON_SECRET = process.env.CRON_SECRET || process.env.SEGREDO_CRON || 'despesas-cron-secret-key-change-this';

// Middleware para autorizar a execuÃ§Ã£o do despertador (Vercel Cron, GitHub Actions ou Admin)
function verifyCronAuth(req, res, next) {
  // 1. AutorizaÃ§Ã£o automÃ¡tica para Vercel Cron
  if (req.headers['x-vercel-cron']) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const headerSecret = req.headers['x-cron-secret'];
  const querySecret = req.query.secret;

  const providedSecret = bearerToken || headerSecret || querySecret;

  if (providedSecret && providedSecret === CRON_SECRET) {
    return next();
  }

  // Se nÃ£o foi fornecido o segredo do cron, verifica se Ã© um JWT de admin vÃ¡lido
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

  if (bearerToken) {
    try {
      const decoded = jwt.verify(bearerToken, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      // Falha de JWT
    }
  }

  return res.status(401).json({ error: 'Acesso nÃ£o autorizado ao endpoint de lembretes.' });
}

// Processa e envia os lembretes de dÃ©bito por Web Push
async function processDebitReminders(options = {}) {
  console.log('=== A processar lembretes diÃ¡rios ===', new Date().toISOString());

  // 1. Obter utilizadores aprovados com notificaÃ§Ãµes ativas
  const usersSql = `
    SELECT u.id, u.email, u.google_refresh_token,
           COALESCE(s.notifications_enabled, 1) as notifications_enabled,
           COALESCE(s.debit_notifications_enabled, 1) as debit_notifications_enabled,
           COALESCE(s.debit_reminder_days, 1) as debit_reminder_days,
           COALESCE(s.second_debit_reminder_enabled, 0) as second_debit_reminder_enabled,
           COALESCE(s.second_debit_reminder_days, 0) as second_debit_reminder_days,
           COALESCE(s.same_day_reminder_enabled, 1) as same_day_reminder_enabled,
           COALESCE(s.no_value_reminder_enabled, 0) as no_value_reminder_enabled,
           COALESCE(s.no_value_reminder_days, '1,10,15,20') as no_value_reminder_days,
           COALESCE(s.backup_reminder_enabled, 1) as backup_reminder_enabled,
           COALESCE(s.backup_reminder_day, 21) as backup_reminder_day,
           COALESCE(s.drive_backup_enabled, 0) as drive_backup_enabled
    FROM users u
    JOIN settings s ON u.id = s.user_id
    WHERE u.status = 'approved' AND (
      s.debit_notifications_enabled = 1 OR 
      s.second_debit_reminder_enabled = 1 OR 
      s.same_day_reminder_enabled = 1 OR 
      s.no_value_reminder_enabled = 1 OR 
      s.backup_reminder_enabled = 1 OR 
      s.drive_backup_enabled = 1 OR
      s.notifications_enabled = 1
    )
  `;

  const usersResult = await query(usersSql);
  const users = usersResult.rows || usersResult;

  const results = [];

  for (const user of users) {
    if (user.notifications_enabled === 0) continue;

    // Obter subscriÃ§Ãµes Web Push do utilizador
    const subsSql = 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1';
    const subsResult = await query(subsSql, [user.id]);
    const subscriptions = subsResult.rows || subsResult;

    const sendPush = async (title, body, tag = undefined) => {
      let pushSent = 0;
      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          const sendRes = await webPushService.sendPushNotification(sub, {
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            url: '/',
            tag: tag || `debit-${Date.now()}`
          });

          if (sendRes.success) {
            pushSent++;
          } else if (sendRes.isExpired) {
            await run('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          }
        }
      }
      return pushSent;
    };

    // Lembretes de DÃ©bito
    const reminderOffsets = [];

    if (user.debit_notifications_enabled === 1) {
      const parsedDays1 = parseInt(user.debit_reminder_days);
      const daysBefore1 = isNaN(parsedDays1) ? 1 : parsedDays1;
      if (!reminderOffsets.includes(daysBefore1)) reminderOffsets.push(daysBefore1);
    }

    if (user.second_debit_reminder_enabled === 1) {
      const parsedDays2 = parseInt(user.second_debit_reminder_days);
      const daysBefore2 = isNaN(parsedDays2) ? 0 : parsedDays2;
      if (!reminderOffsets.includes(daysBefore2)) reminderOffsets.push(daysBefore2);
    }

    if (user.same_day_reminder_enabled === 1) {
      if (!reminderOffsets.includes(0)) reminderOffsets.push(0);
    }

    for (const daysBefore of reminderOffsets) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const expensesSql = 'SELECT * FROM expenses WHERE user_id = $1 AND debit_date = $2 AND paid = 0 ORDER BY debit_date';
      const expensesResult = await query(expensesSql, [user.id, targetDateStr]);
      const expenses = expensesResult.rows || expensesResult;

      if (!expenses || expenses.length === 0) continue;

      const totalCents = expenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
      const totalEur = (totalCents / 100).toFixed(2);
      const [tYear, tMonth, tDay] = targetDateStr.split('-');
      const formattedDate = `${tDay}/${tMonth}`;

      let notificationTitle = '';
      let notificationBody = '';

      if (expenses.length === 1) {
        const exp = expenses[0];
        const valStr = exp.amount_cents > 0 ? ` (${(exp.amount_cents / 100).toFixed(2)}â‚¬)` : '';
        if (daysBefore === 0) {
          notificationTitle = 'âš ï¸ AtenÃ§Ã£o: DÃ©bito Hoje por Pagar';
          notificationBody = `A despesa "${exp.description}"${valStr} debita hoje e ainda nÃ£o foi paga!`;
        } else if (daysBefore === 1) {
          notificationTitle = 'âš ï¸ AtenÃ§Ã£o: DÃ©bito Agendado para AmanhÃ£';
          notificationBody = `A despesa "${exp.description}"${valStr} irÃ¡ ser debitada amanhÃ£ (dia ${formattedDate}).`;
        } else {
          notificationTitle = `âš ï¸ AtenÃ§Ã£o: DÃ©bito em ${daysBefore} dias`;
          notificationBody = `A despesa "${exp.description}"${valStr} irÃ¡ ser debitada no dia ${formattedDate}.`;
        }
      } else {
        const names = expenses.map(e => e.description).slice(0, 3).join(', ') + (expenses.length > 3 ? '...' : '');
        if (daysBefore === 0) {
          notificationTitle = `âš ï¸ AtenÃ§Ã£o: ${expenses.length} Despesas Hoje por Pagar`;
          notificationBody = `As despesas (${names}) num total de ${totalEur}â‚¬ debitam hoje e ainda nÃ£o foram pagas!`;
        } else if (daysBefore === 1) {
          notificationTitle = `âš ï¸ AtenÃ§Ã£o: ${expenses.length} Despesas a Debitar AmanhÃ£`;
          notificationBody = `As despesas (${names}) num total de ${totalEur}â‚¬ irÃ£o ser debitadas amanhÃ£ (dia ${formattedDate}).`;
        } else {
          notificationTitle = `âš ï¸ AtenÃ§Ã£o: ${expenses.length} Despesas em ${daysBefore} dias`;
          notificationBody = `As despesas (${names}) num total de ${totalEur}â‚¬ irÃ£o ser debitadas no dia ${formattedDate}.`;
        }
      }

      const pushSent = await sendPush(notificationTitle, notificationBody, `debit-${daysBefore}`);

      results.push({
        userId: user.id,
        email: user.email,
        type: 'debit_reminder',
        daysBefore,
        targetDate: targetDateStr,
        expensesCount: expenses.length,
        totalEur,
        pushSent
      });
    }

    // VerificaÃ§Ã£o de Despesas Sem Valor (Dias 1, 10, 15, 20)
    if (user.no_value_reminder_enabled === 1) {
      const lisbonParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());

      const realDay = parseInt(lisbonParts.find(p => p.type === 'day').value, 10);
      const currentDay = options.forceDay !== undefined ? options.forceDay : realDay;
      const currentYear = lisbonParts.find(p => p.type === 'year').value;
      const currentMonthNum = lisbonParts.find(p => p.type === 'month').value;
      const lisbonTodayStr = `${currentYear}-${currentMonthNum}-${String(currentDay).padStart(2, '0')}`;

      const allowedDays = (user.no_value_reminder_days || '1,10,15,20')
        .split(',')
        .map(d => parseInt(d.trim(), 10))
        .filter(d => !isNaN(d));

      if (allowedDays.includes(currentDay)) {
        const periodMonth = currentFinancialPeriodMonth(new Date(lisbonTodayStr));
        const period = financialPeriod(periodMonth);
        const startDateStr = period.start.toISOString().split('T')[0];
        const endDateStr = period.end.toISOString().split('T')[0];

        const noValSql = 'SELECT * FROM expenses WHERE user_id = $1 AND debit_date BETWEEN $2 AND $3 AND (amount_cents = 0 OR amount_cents IS NULL) ORDER BY debit_date ASC';
        const noValResult = await query(noValSql, [user.id, startDateStr, endDateStr]);
        const noValExpenses = noValResult.rows || noValResult;

        if (noValExpenses && noValExpenses.length > 0) {
          const count = noValExpenses.length;
          const notificationTitle = 'âš ï¸ AtenÃ§Ã£o: Despesas Sem Valor';
          let notificationBody = '';

          if (count === 1) {
            notificationBody = `Por favor verifique despesas sem valor: "${noValExpenses[0].description}" ainda nÃ£o tem valor definido.`;
          } else {
            const names = noValExpenses.map(e => e.description).slice(0, 3).join(', ') + (count > 3 ? '...' : '');
            notificationBody = `Por favor verifique despesas sem valor: existem ${count} despesas (${names}) por preencher.`;
          }

          const pushSent = await sendPush(notificationTitle, notificationBody, 'no-value-reminder');

          results.push({
            userId: user.id,
            email: user.email,
            type: 'no_value_reminder',
            currentDay,
            expensesCount: count,
            pushSent
          });
        }
      }
    }

    // VerificaÃ§Ã£o de Lembrete Mensal de Backup
    const backupEnabled = parseInt(user.backup_reminder_enabled, 10) === 1 || user.backup_reminder_enabled == 1;
    if (backupEnabled) {
      const lisbonParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());

      const realDay = parseInt(lisbonParts.find(p => p.type === 'day').value, 10);
      const currentDay = options.forceDay !== undefined ? parseInt(options.forceDay, 10) : realDay;
      const targetBackupDay = parseInt(user.backup_reminder_day, 10) || 21;

      if (currentDay === targetBackupDay) {
        const notificationTitle = 'ðŸ’¾ Lembrete: CÃ³pia de SeguranÃ§a Mensal';
        const notificationBody = 'O ciclo do mÃªs fechou. Clique para descarregar o backup dos seus dados.';
        const pushSent = await sendPush(notificationTitle, notificationBody, 'monthly-backup-reminder');

        results.push({
          userId: user.id,
          email: user.email,
          type: 'backup_reminder',
          currentDay,
          pushSent
        });
      }
    }

    // Backup AutomÃ¡tico para o Google Drive
    const driveBackupEnabled = parseInt(user.drive_backup_enabled, 10) === 1 || user.drive_backup_enabled == 1;
    if (driveBackupEnabled && user.google_refresh_token) {
      const lisbonDate = new Date();
      const currentDay = lisbonDate.getDay(); // 0 = Sunday, 1 = Monday
      const currentDate = lisbonDate.getDate(); // 1-31
      const targetBackupDay = parseInt(user.backup_reminder_day, 10) || 21;

      const isWeekly = (currentDay === 1); // Segunda-feira
      const isMonthly = (currentDate === targetBackupDay);

      if (isWeekly || isMonthly) {
        try {
          // Gerar os dados do backup
          const expensesSql = isPostgres
            ? 'SELECT * FROM expenses WHERE user_id = $1 ORDER BY id'
            : 'SELECT * FROM expenses WHERE user_id = ? ORDER BY id';
          const expensesResult = await query(expensesSql, [user.id]);
          const userExpenses = isPostgres ? expensesResult.rows : expensesResult;

          const settingsSql = isPostgres
            ? 'SELECT * FROM settings WHERE user_id = $1'
            : 'SELECT * FROM settings WHERE user_id = ?';
          const userSettings = await queryOne(settingsSql, [user.id]);

          const backupData = JSON.stringify({
            format_version: 1,
            exported_at: lisbonDate.toISOString(),
            user_id: user.id,
            expenses: userExpenses,
            settings: userSettings
          }, null, 2);

          const dateStr = lisbonDate.toISOString().split('T')[0];
          
          if (isWeekly) {
            const fileName = `backup_semanal_${dateStr}.json`;
            await uploadBackup(user.google_refresh_token, backupData, fileName, isWeekly ? 'semanal' : 'mensal');
            await rotateBackups(user.google_refresh_token, 'semanal', 2); // Manter os Ãºltimos 2
          }

          if (isMonthly) {
            const fileName = `backup_mensal_${dateStr}.json`;
            await uploadBackup(user.google_refresh_token, backupData, fileName, isWeekly ? 'semanal' : 'mensal');
            // Mensais nÃ£o sÃ£o apagados por defeito (ou poderÃ­amos rodar 12)
          }

          const isPostgres = require('../models/database').isPostgres;
          const query = require('../models/database').query;
          const msg = 'Backup automático ' + (isWeekly ? 'semanal' : 'mensal') + ' gravado com sucesso!';
          const sql = isPostgres 
            ? 'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)'
            : 'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)';
          await query(sql, [user.id, 'Backup Google Drive', msg, 'success']);
          
          results.push({
            userId: user.id,
            email: user.email,
            type: 'google_drive_backup',
            weekly: isWeekly,
            monthly: isMonthly
          });
        } catch (err) {
          console.error('Erro ao fazer backup para o Google Drive', err);
          // Opcional: enviar notificaÃ§Ã£o push de erro de backup
        }
      }
    }
  }

  console.log('=== Lembretes processados com sucesso ===', results);
  return results;
}

router.all('/check', verifyCronAuth, async (req, res) => {
  try {
    const rawForce = req.query?.forceDay || req.query?.forceday || req.query?.force_day || (req.body && req.body.forceDay);
    const forceDay = rawForce !== undefined ? parseInt(rawForce, 10) : undefined;
    const details = await processDebitReminders({ forceDay });
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      remindersSentCount: details.length,
      details
    });
  } catch (error) {
    console.error('Error processing reminders:', error);
    res.status(500).json({ error: 'Falha ao processar lembretes', details: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db, isPostgres, financialPeriod, currentFinancialPeriodMonth, query, queryOne, run } = require('../models/database');
const webPushService = require('../services/webPushService');
const { uploadBackup, rotateBackups } = require('../services/googleDriveService');

const CRON_SECRET = process.env.CRON_SECRET || process.env.SEGREDO_CRON || 'despesas-cron-secret-key-change-this';

// Middleware para autorizar a execução do despertador (Vercel Cron, GitHub Actions ou Admin)
function verifyCronAuth(req, res, next) {
  // 1. Autorização automática para Vercel Cron
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

  // Se não foi fornecido o segredo do cron, verifica se é um JWT de admin válido
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

  return res.status(401).json({ error: 'Acesso não autorizado ao endpoint de lembretes.' });
}

// Processa e envia os lembretes de débito por Web Push
async function processDebitReminders(options = {}) {
  console.log('=== A processar lembretes diários ===', new Date().toISOString());

  // 1. Obter utilizadores aprovados com notificações ativas
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

    // Obter subscrições Web Push do utilizador
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

    // Lembretes de Débito
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
        const valStr = exp.amount_cents > 0 ? ` (${(exp.amount_cents / 100).toFixed(2).replace('.', ',')} €)` : '';
        if (daysBefore === 0) {
          notificationTitle = '⚠️ Débito Hoje';
          notificationBody = `A despesa "${exp.description}"${valStr} debita hoje e ainda não foi paga!`;
        } else if (daysBefore === 1) {
          notificationTitle = '📅 Débito Amanhã';
          notificationBody = `A despesa "${exp.description}"${valStr} será debitada amanhã (${formattedDate}).`;
        } else {
          notificationTitle = `📅 Débito em ${daysBefore} dias`;
          notificationBody = `A despesa "${exp.description}"${valStr} será debitada no dia ${formattedDate}.`;
        }
      } else {
        const names = expenses.map(e => e.description).slice(0, 3).join(', ') + (expenses.length > 3 ? '...' : '');
        const totalFormatted = (totalCents / 100).toFixed(2).replace('.', ',') + ' €';
        if (daysBefore === 0) {
          notificationTitle = `⚠️ ${expenses.length} Despesas Hoje`;
          notificationBody = `As despesas (${names}) num total de ${totalFormatted} debitam hoje e ainda não foram pagas!`;
        } else if (daysBefore === 1) {
          notificationTitle = `📅 ${expenses.length} Despesas Amanhã`;
          notificationBody = `As despesas (${names}) num total de ${totalFormatted} serão debitadas amanhã (${formattedDate}).`;
        } else {
          notificationTitle = `📅 ${expenses.length} Despesas em ${daysBefore} dias`;
          notificationBody = `As despesas (${names}) num total de ${totalFormatted} serão debitadas no dia ${formattedDate}.`;
        }
      }

      const pushSent = await sendPush(notificationTitle, notificationBody, `debit-${daysBefore}`);

      // Registar também na central interna de notificações (sino)
      try {
        const notifSql = isPostgres
          ? 'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)'
          : 'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)';
        await query(notifSql, [user.id, notificationTitle, notificationBody, 'reminder']);
      } catch (errNotif) {
        console.error('Erro ao registar notificação interna:', errNotif);
      }

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

    // Verificação de Despesas Sem Valor (Dias 1, 10, 15, 20)
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
          const notificationTitle = '⚠️ Despesas Sem Valor';
          let notificationBody = '';

          if (count === 1) {
            notificationBody = `A despesa "${noValExpenses[0].description}" ainda não tem valor definido no ciclo atual.`;
          } else {
            const names = noValExpenses.map(e => e.description).slice(0, 3).join(', ') + (count > 3 ? '...' : '');
            notificationBody = `Existem ${count} despesas (${names}) sem valor definido no ciclo atual.`;
          }

          const pushSent = await sendPush(notificationTitle, notificationBody, 'no-value-reminder');

          // Registar na central interna de notificações
          try {
            const notifSql = isPostgres
              ? 'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)'
              : 'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)';
            await query(notifSql, [user.id, notificationTitle, notificationBody, 'warning']);
          } catch (errNotif) {
            console.error('Erro ao registar notificação interna:', errNotif);
          }

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

    // Verificação de Lembrete Mensal de Backup
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
        const notificationTitle = '💾 Cópia de Segurança Mensal';
        const notificationBody = 'O ciclo do mês fechou. Clique para descarregar o backup dos seus dados.';
        const pushSent = await sendPush(notificationTitle, notificationBody, 'monthly-backup-reminder');

        // Registar na central interna de notificações
        try {
          const notifSql = isPostgres
            ? 'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)'
            : 'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)';
          await query(notifSql, [user.id, notificationTitle, notificationBody, 'backup']);
        } catch (errNotif) {
          console.error('Erro ao registar notificação interna:', errNotif);
        }

        results.push({
          userId: user.id,
          email: user.email,
          type: 'backup_reminder',
          currentDay,
          pushSent
        });
      }
    }

    // Verificação de Lembretes de Aproximação da Data Limite de Poupanças
    try {
      const savingsSql = isPostgres
        ? `SELECT * FROM savings 
           WHERE user_id = $1 
             AND target_date IS NOT NULL 
             AND reminder_date_enabled = 1`
        : `SELECT * FROM savings 
           WHERE user_id = ? 
             AND target_date IS NOT NULL 
             AND reminder_date_enabled = 1`;
      const savingsResult = await query(savingsSql, [user.id]);
      const userSavings = isPostgres ? (savingsResult.rows || savingsResult) : savingsResult;

      if (userSavings && userSavings.length > 0) {
        const lisbonParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Lisbon',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).formatToParts(new Date());
        const todayStr = `${lisbonParts.find(p => p.type === 'year').value}-${lisbonParts.find(p => p.type === 'month').value}-${lisbonParts.find(p => p.type === 'day').value}`;
        const todayDate = new Date(todayStr + 'T00:00:00Z');

        for (const saving of userSavings) {
          if (!saving.target_date) continue;

          const targetDate = new Date(saving.target_date + 'T00:00:00Z');
          const diffMs = targetDate.getTime() - todayDate.getTime();
          const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
          const reminderDaysBefore = parseInt(saving.reminder_days_before, 10) || 7;

          // Notificar se faltam os dias configurados OU se faltam 0 dias (hoje) OU se falta 1 dia
          const shouldNotify = (daysRemaining === reminderDaysBefore) || (daysRemaining === 0) || (daysRemaining === 1 && reminderDaysBefore > 1);

          if (shouldNotify) {
            // Verificar se já foi enviada notificação hoje para esta poupança para evitar duplicados
            const checkNotifSql = isPostgres
              ? `SELECT id FROM notifications 
                 WHERE user_id = $1 
                   AND type = 'saving_deadline' 
                   AND message LIKE $2 
                   AND created_at >= CURRENT_DATE`
              : `SELECT id FROM notifications 
                 WHERE user_id = ? 
                   AND type = 'saving_deadline' 
                   AND message LIKE ? 
                   AND date(created_at) = date('now')`;
            const checkRes = await query(checkNotifSql, [user.id, `%${saving.name}%`]);
            const existingNotifs = isPostgres ? (checkRes.rows || checkRes) : checkRes;

            if (!existingNotifs || existingNotifs.length === 0) {
              const [tYear, tMonth, tDay] = saving.target_date.split('-');
              const formattedDate = `${tDay}/${tMonth}/${tYear}`;
              const valCurStr = (saving.current_amount_cents / 100).toFixed(2).replace('.', ',') + ' €';
              const valTargetStr = saving.target_amount_cents 
                ? ` (Meta: ${(saving.target_amount_cents / 100).toFixed(2).replace('.', ',')} €)` 
                : '';

              let notifTitle = '';
              let notifBody = '';

              if (daysRemaining === 0) {
                notifTitle = `🎯 Prazo Hoje: Poupança "${saving.name}"`;
                notifBody = `O prazo da poupança "${saving.name}" termina hoje! Saldo acumulado: ${valCurStr}${valTargetStr}.`;
              } else if (daysRemaining === 1) {
                notifTitle = `🎯 Prazo Amanhã: Poupança "${saving.name}"`;
                notifBody = `Falta 1 dia para o prazo da poupança "${saving.name}" (${formattedDate}). Saldo atual: ${valCurStr}${valTargetStr}.`;
              } else {
                notifTitle = `🎯 Prazo em ${daysRemaining} dias: Poupança "${saving.name}"`;
                notifBody = `Faltam ${daysRemaining} dias para a data limite da poupança "${saving.name}" (${formattedDate}). Saldo atual: ${valCurStr}${valTargetStr}.`;
              }

              const pushSent = await sendPush(notifTitle, notifBody, `saving-deadline-${saving.id}-${todayStr}`);

              // Registar na central interna de notificações
              try {
                const notifInsertSql = isPostgres
                  ? 'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)'
                  : 'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)';
                await query(notifInsertSql, [user.id, notifTitle, notifBody, 'saving_deadline']);
              } catch (errNotif) {
                console.error('Erro ao registar notificação interna de prazo de poupança:', errNotif);
              }

              results.push({
                userId: user.id,
                email: user.email,
                type: 'saving_deadline_reminder',
                savingId: saving.id,
                savingName: saving.name,
                daysRemaining,
                pushSent
              });
            }
          }
        }
      }
    } catch (savingErr) {
      console.error('Erro ao verificar prazos de poupanças:', savingErr);
    }

    // Backup Automático para o Google Drive
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
            await rotateBackups(user.google_refresh_token, 'semanal', 2); // Manter os últimos 2
          }

          if (isMonthly) {
            const fileName = `backup_mensal_${dateStr}.json`;
            await uploadBackup(user.google_refresh_token, backupData, fileName, isWeekly ? 'semanal' : 'mensal');
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

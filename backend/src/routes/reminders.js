const express = require('express');
const router = express.Router();
const { db, isPostgres, financialPeriod, currentFinancialPeriodMonth, query, queryOne, run } = require('../models/database');
const webPushService = require('../services/webPushService');
const { sendDebitReminderEmail, sendNoValueExpensesEmail, isEmailConfigured } = require('../services/emailService');

const CRON_SECRET = process.env.CRON_SECRET || 'despesas-cron-secret-key-change-this';

// Middleware para autorizar a execução do despertador (Cron ou Admin)
function verifyCronAuth(req, res, next) {
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

  return res.status(401).json({ error: 'Acesso não autorizado ao endpoint de lembretes. Forneça o segredo do cron.' });
}

// Processa e envia os lembretes de débito para todos os utilizadores
async function processDebitReminders(options = {}) {
  console.log('=== A processar lembretes diários ===', new Date().toISOString());

  // 1. Obter utilizadores aprovados com notificações ativas
  const usersSql = isPostgres
    ? `SELECT u.id, u.email,
              COALESCE(s.notifications_enabled, 1) as notifications_enabled,
              COALESCE(s.debit_notifications_enabled, 1) as debit_notifications_enabled,
              COALESCE(s.debit_reminder_days, 1) as debit_reminder_days,
              COALESCE(s.second_debit_reminder_enabled, 0) as second_debit_reminder_enabled,
              COALESCE(s.second_debit_reminder_days, 0) as second_debit_reminder_days,
              COALESCE(s.same_day_reminder_enabled, 1) as same_day_reminder_enabled,
              COALESCE(s.no_value_reminder_enabled, 0) as no_value_reminder_enabled,
              COALESCE(s.no_value_reminder_days, '1,10,15,20') as no_value_reminder_days
       FROM users u
       JOIN settings s ON u.id = s.user_id
       WHERE u.status = 'approved' AND (
         s.debit_notifications_enabled = 1 OR 
         s.second_debit_reminder_enabled = 1 OR 
         s.same_day_reminder_enabled = 1 OR 
         s.no_value_reminder_enabled = 1 OR 
         s.notifications_enabled = 1
       )`
    : `SELECT u.id, u.email,
              COALESCE(s.notifications_enabled, 1) as notifications_enabled,
              COALESCE(s.debit_notifications_enabled, 1) as debit_notifications_enabled,
              COALESCE(s.debit_reminder_days, 1) as debit_reminder_days,
              COALESCE(s.second_debit_reminder_enabled, 0) as second_debit_reminder_enabled,
              COALESCE(s.second_debit_reminder_days, 0) as second_debit_reminder_days,
              COALESCE(s.same_day_reminder_enabled, 1) as same_day_reminder_enabled,
              COALESCE(s.no_value_reminder_enabled, 0) as no_value_reminder_enabled,
              COALESCE(s.no_value_reminder_days, '1,10,15,20') as no_value_reminder_days
       FROM users u
       JOIN settings s ON u.id = s.user_id
       WHERE u.status = 'approved' AND (
         s.debit_notifications_enabled = 1 OR 
         s.second_debit_reminder_enabled = 1 OR 
         s.same_day_reminder_enabled = 1 OR 
         s.no_value_reminder_enabled = 1 OR 
         s.notifications_enabled = 1
       )`;

  const usersResult = await query(usersSql);
  const users = isPostgres ? usersResult.rows : usersResult;

  const results = [];

  for (const user of users) {
    if (user.notifications_enabled === 0) continue;

    // Obter subscrições Web Push do utilizador
    const subsSql = isPostgres
      ? 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1'
      : 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?';

    const subsResult = await query(subsSql, [user.id]);
    const subscriptions = isPostgres ? subsResult.rows : subsResult;

    // Função auxiliar para envio de notificação push
    const sendPush = async (title, body) => {
      let pushSent = 0;
      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          const sendRes = await webPushService.sendPushNotification(sub, {
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            url: '/'
          });

          if (sendRes.success) {
            pushSent++;
          } else if (sendRes.isExpired) {
            const delSql = isPostgres
              ? 'DELETE FROM push_subscriptions WHERE id = $1'
              : 'DELETE FROM push_subscriptions WHERE id = ?';
            await run(delSql, [sub.id]);
          }
        }
      }
      return pushSent;
    };

    // -------------------------------------------------------------
    // A. Lembretes de Débito (1º, 2º e Próprio Dia)
    // -------------------------------------------------------------
    const reminderOffsets = [];

    if (user.debit_notifications_enabled === 1) {
      const parsedDays1 = parseInt(user.debit_reminder_days);
      const daysBefore1 = isNaN(parsedDays1) ? 1 : parsedDays1;
      if (!reminderOffsets.includes(daysBefore1)) {
        reminderOffsets.push(daysBefore1);
      }
    }

    if (user.second_debit_reminder_enabled === 1) {
      const parsedDays2 = parseInt(user.second_debit_reminder_days);
      const daysBefore2 = isNaN(parsedDays2) ? 0 : parsedDays2;
      if (!reminderOffsets.includes(daysBefore2)) {
        reminderOffsets.push(daysBefore2);
      }
    }

    if (user.same_day_reminder_enabled === 1) {
      if (!reminderOffsets.includes(0)) {
        reminderOffsets.push(0);
      }
    }

    for (const daysBefore of reminderOffsets) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const expensesSql = isPostgres
        ? 'SELECT * FROM expenses WHERE user_id = $1 AND debit_date = $2 AND paid = 0 ORDER BY debit_date'
        : 'SELECT * FROM expenses WHERE user_id = ? AND debit_date = ? AND paid = 0 ORDER BY debit_date';

      const expensesResult = await query(expensesSql, [user.id, targetDateStr]);
      const expenses = isPostgres ? expensesResult.rows : expensesResult;

      if (!expenses || expenses.length === 0) {
        continue;
      }

      const totalCents = expenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
      const totalEur = (totalCents / 100).toFixed(2);

      const [tYear, tMonth, tDay] = targetDateStr.split('-');
      const formattedDate = `${tDay}/${tMonth}`;

      let notificationTitle = '';
      let notificationBody = '';

      if (expenses.length === 1) {
        const exp = expenses[0];
        const valStr = exp.amount_cents > 0 ? ` (${(exp.amount_cents / 100).toFixed(2)}€)` : '';
        if (daysBefore === 0) {
          notificationTitle = '⚠️ Atenção: Débito Hoje por Pagar';
          notificationBody = `A despesa "${exp.description}"${valStr} debita hoje e ainda não foi paga!`;
        } else if (daysBefore === 1) {
          notificationTitle = '⚠️ Atenção: Débito Agendado para Amanhã';
          notificationBody = `A despesa "${exp.description}"${valStr} irá ser debitada amanhã (dia ${formattedDate}).`;
        } else {
          notificationTitle = `⚠️ Atenção: Débito em ${daysBefore} dias`;
          notificationBody = `A despesa "${exp.description}"${valStr} irá ser debitada no dia ${formattedDate}.`;
        }
      } else {
        const names = expenses.map(e => e.description).slice(0, 3).join(', ') + (expenses.length > 3 ? '...' : '');
        if (daysBefore === 0) {
          notificationTitle = `⚠️ Atenção: ${expenses.length} Despesas Hoje por Pagar`;
          notificationBody = `As despesas (${names}) num total de ${totalEur}€ debitam hoje e ainda não foram pagas!`;
        } else if (daysBefore === 1) {
          notificationTitle = `⚠️ Atenção: ${expenses.length} Despesas a Debitar Amanhã`;
          notificationBody = `As despesas (${names}) num total de ${totalEur}€ irão ser debitadas amanhã (dia ${formattedDate}).`;
        } else {
          notificationTitle = `⚠️ Atenção: ${expenses.length} Despesas em ${daysBefore} dias`;
          notificationBody = `As despesas (${names}) num total de ${totalEur}€ irão ser debitadas no dia ${formattedDate}.`;
        }
      }

      const pushSent = await sendPush(notificationTitle, notificationBody);

      let emailSent = false;
      if (isEmailConfigured()) {
        try {
          const emailRes = await sendDebitReminderEmail(user.email, expenses, daysBefore);
          emailSent = emailRes.success;
        } catch (err) {
          console.error(`Error sending reminder email to ${user.email}:`, err.message);
        }
      }

      results.push({
        userId: user.id,
        email: user.email,
        type: 'debit_reminder',
        daysBefore,
        targetDate: targetDateStr,
        expensesCount: expenses.length,
        totalEur,
        pushSent,
        emailSent
      });
    }

    // -------------------------------------------------------------
    // B. Verificação de Despesas Sem Valor (Dias 1, 10, 15, 20)
    // -------------------------------------------------------------
    if (user.no_value_reminder_enabled === 1) {
      // Obter dia atual no fuso horário de Lisboa
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
        // Obter o período financeiro atual (21 do mês anterior ao dia 20 deste mês)
        const periodMonth = currentFinancialPeriodMonth(new Date(lisbonTodayStr));
        const period = financialPeriod(periodMonth);
        const startDateStr = period.start.toISOString().split('T')[0];
        const endDateStr = period.end.toISOString().split('T')[0];

        // Buscar despesas sem valor no período atual
        const noValSql = isPostgres
          ? 'SELECT * FROM expenses WHERE user_id = $1 AND debit_date BETWEEN $2 AND $3 AND (amount_cents = 0 OR amount_cents IS NULL) ORDER BY debit_date ASC'
          : 'SELECT * FROM expenses WHERE user_id = ? AND debit_date BETWEEN ? AND ? AND (amount_cents = 0 OR amount_cents IS NULL) ORDER BY debit_date ASC';

        const noValResult = await query(noValSql, [user.id, startDateStr, endDateStr]);
        const noValExpenses = isPostgres ? noValResult.rows : noValResult;

        // Se não existirem despesas sem valor nessas condições, a notificação NÃO aparece
        if (noValExpenses && noValExpenses.length > 0) {
          const count = noValExpenses.length;
          const notificationTitle = '⚠️ Atenção: Despesas Sem Valor';
          let notificationBody = '';

          if (count === 1) {
            notificationBody = `Por favor verifique despesas sem valor: "${noValExpenses[0].description}" ainda não tem valor definido.`;
          } else {
            const names = noValExpenses.map(e => e.description).slice(0, 3).join(', ') + (count > 3 ? '...' : '');
            notificationBody = `Por favor verifique despesas sem valor: existem ${count} despesas (${names}) por preencher.`;
          }

          const pushSent = await sendPush(notificationTitle, notificationBody);

          let emailSent = false;
          if (isEmailConfigured()) {
            try {
              const emailRes = await sendNoValueExpensesEmail(user.email, noValExpenses);
              emailSent = emailRes.success;
            } catch (err) {
              console.error(`Error sending no-value email to ${user.email}:`, err.message);
            }
          }

          results.push({
            userId: user.id,
            email: user.email,
            type: 'no_value_reminder',
            currentDay,
            expensesCount: count,
            pushSent,
            emailSent
          });
        }
      }
    }
  }

  console.log('=== Lembretes processados com sucesso ===', results);
  return results;
}

// Aceita tanto GET como POST para ser compatível com qualquer serviço externo de cron
router.all('/check', verifyCronAuth, async (req, res) => {
  try {
    const forceDay = req.query.forceDay ? parseInt(req.query.forceDay, 10) : undefined;
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


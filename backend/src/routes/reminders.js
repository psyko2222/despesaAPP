const express = require('express');
const router = express.Router();
const { db, isPostgres, query, queryOne, run } = require('../models/database');
const webPushService = require('../services/webPushService');
const { sendDebitReminderEmail, isEmailConfigured } = require('../services/emailService');

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
async function processDebitReminders() {
  console.log('=== A processar lembretes diários de débito ===', new Date().toISOString());

  // 1. Obter utilizadores aprovados com notificações ativas
  // 1. Obter utilizadores aprovados com notificações ativas
  const usersSql = isPostgres
    ? `SELECT u.id, u.email,
              COALESCE(s.notifications_enabled, 1) as notifications_enabled,
              COALESCE(s.debit_notifications_enabled, 1) as debit_notifications_enabled,
              COALESCE(s.debit_reminder_days, 1) as debit_reminder_days,
              COALESCE(s.second_debit_reminder_enabled, 0) as second_debit_reminder_enabled,
              COALESCE(s.second_debit_reminder_days, 0) as second_debit_reminder_days,
              COALESCE(s.same_day_reminder_enabled, 1) as same_day_reminder_enabled
       FROM users u
       JOIN settings s ON u.id = s.user_id
       WHERE u.status = 'approved' AND (s.debit_notifications_enabled = 1 OR s.second_debit_reminder_enabled = 1 OR s.same_day_reminder_enabled = 1 OR s.notifications_enabled = 1)`
    : `SELECT u.id, u.email,
              COALESCE(s.notifications_enabled, 1) as notifications_enabled,
              COALESCE(s.debit_notifications_enabled, 1) as debit_notifications_enabled,
              COALESCE(s.debit_reminder_days, 1) as debit_reminder_days,
              COALESCE(s.second_debit_reminder_enabled, 0) as second_debit_reminder_enabled,
              COALESCE(s.second_debit_reminder_days, 0) as second_debit_reminder_days,
              COALESCE(s.same_day_reminder_enabled, 1) as same_day_reminder_enabled
       FROM users u
       JOIN settings s ON u.id = s.user_id
       WHERE u.status = 'approved' AND (s.debit_notifications_enabled = 1 OR s.second_debit_reminder_enabled = 1 OR s.same_day_reminder_enabled = 1 OR s.notifications_enabled = 1)`;

  const usersResult = await query(usersSql);
  const users = isPostgres ? usersResult.rows : usersResult;

  const results = [];

  for (const user of users) {
    if (user.notifications_enabled === 0) continue;

    const reminderOffsets = [];

    // 1º Lembrete de antecedência
    if (user.debit_notifications_enabled === 1) {
      const parsedDays1 = parseInt(user.debit_reminder_days);
      const daysBefore1 = isNaN(parsedDays1) ? 1 : parsedDays1;
      if (!reminderOffsets.includes(daysBefore1)) {
        reminderOffsets.push(daysBefore1);
      }
    }

    // 2º Lembrete de antecedência
    if (user.second_debit_reminder_enabled === 1) {
      const parsedDays2 = parseInt(user.second_debit_reminder_days);
      const daysBefore2 = isNaN(parsedDays2) ? 0 : parsedDays2;
      if (!reminderOffsets.includes(daysBefore2)) {
        reminderOffsets.push(daysBefore2);
      }
    }

    // Verificação no próprio dia do débito
    if (user.same_day_reminder_enabled === 1) {
      if (!reminderOffsets.includes(0)) {
        reminderOffsets.push(0);
      }
    }

    for (const daysBefore of reminderOffsets) {
      // Calcular a data alvo de vencimento
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // 2. Buscar despesas não pagas dessa data
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

      // Formatar a data para estilo português (DD/MM)
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

    // 3. Obter subscrições Web Push do utilizador
    const subsSql = isPostgres
      ? 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1'
      : 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?';

    const subsResult = await query(subsSql, [user.id]);
    const subscriptions = isPostgres ? subsResult.rows : subsResult;

    let pushSent = 0;
    if (subscriptions && subscriptions.length > 0) {
      for (const sub of subscriptions) {
        const sendRes = await webPushService.sendPushNotification(sub, {
          title: notificationTitle,
          body: notificationBody,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          url: '/'
        });

        if (sendRes.success) {
          pushSent++;
        } else if (sendRes.isExpired) {
          // Limpa subscrição inválida
          const delSql = isPostgres
            ? 'DELETE FROM push_subscriptions WHERE id = $1'
            : 'DELETE FROM push_subscriptions WHERE id = ?';
          await run(delSql, [sub.id]);
        }
      }
    }

    // 4. Enviar Email de resumo
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
      targetDate: targetDateStr,
      expensesCount: expenses.length,
      totalEur,
      pushSent,
      emailSent
    });
    }
  }

  console.log('=== Lembretes processados com sucesso ===', results);
  return results;
}

// Aceita tanto GET como POST para ser compatível com qualquer serviço externo de cron
router.all('/check', verifyCronAuth, async (req, res) => {
  try {
    const details = await processDebitReminders();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      remindersSentCount: details.length,
      details
    });
  } catch (error) {
    console.error('Error processing reminders:', error);
    res.status(500).json({ error: 'Falha ao processar lembretes de débito', details: error.message });
  }
});

module.exports = router;


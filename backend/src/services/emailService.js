const nodemailer = require('nodemailer');

// Configuração específica para Hotmail/Outlook
const OUTLOOK_SMTP_CONFIG = {
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  tls: {
    ciphers: 'SSLv3'
  }
};

// Configuração específica para Gmail
const GMAIL_SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
};

function isPlaceholder(value) {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v.startsWith('your-') || v.includes('change-this') || v === 'undefined';
}

function fromAddress() {
  return (
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    'noreply@despesas.app'
  );
}

function isEmailConfigured() {
  const smtp = process.env.SMTP_HOST && !isPlaceholder(process.env.SMTP_HOST);
  return Boolean(smtp);
}

async function sendMail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    console.error('Email not sent: configure SMTP_HOST');
    return { success: false, message: 'Email service not configured' };
  }

  const from = fromAddress();

  try {
    // Detetar se é Outlook/Hotmail e usar configuração específica
    const isOutlook = process.env.SMTP_HOST && (
      process.env.SMTP_HOST.includes('outlook.com') ||
      process.env.SMTP_HOST.includes('hotmail.com') ||
      process.env.SMTP_USER && (
        process.env.SMTP_USER.includes('@outlook.com') ||
        process.env.SMTP_USER.includes('@hotmail.com')
      )
    );

    // Detetar se é Gmail e usar configuração específica
    const isGmail = process.env.SMTP_HOST && (
      process.env.SMTP_HOST.includes('gmail.com') ||
      process.env.SMTP_USER && process.env.SMTP_USER.includes('@gmail.com')
    );

    let smtpConfig;
    if (isOutlook) {
      smtpConfig = OUTLOOK_SMTP_CONFIG;
    } else if (isGmail) {
      smtpConfig = GMAIL_SMTP_CONFIG;
    } else {
      smtpConfig = {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      };
    }

    const transporter = nodemailer.createTransport({
      ...smtpConfig,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    await transporter.sendMail({ from, to, subject, text, html });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error.response?.body || error.message || error);
    return { success: false, message: 'Failed to send email', error: error.message };
  }
}

async function sendPasswordResetEmail(email, resetToken, frontendUrl) {
  const resetUrl = `${frontendUrl.replace(/\/+$/, '')}/login?reset=${resetToken}`;

  return sendMail({
    to: email,
    subject: 'Recuperação de Password - Despesas',
    text: `
Recebemos um pedido para redefinir a sua password.

Abra este link para definir uma nova password:
${resetUrl}

Este link expira em 1 hora. Se não fez este pedido, ignore este email.
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Recuperação de Password</h2>
        <p>Recebemos um pedido para redefinir a sua password.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Redefinir Password
          </a>
        </p>
        <p>Ou copie este link:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #666; font-size: 14px;">Este link expira em 1 hora.</p>
      </div>
    `,
  });
}

async function sendUserApprovalNotification(adminEmails, newUserEmail, approvalToken, frontendUrl) {
  const approvalUrl = `${frontendUrl.replace(/\/+$/, '')}/login?approve=${approvalToken}`;
  const recipients = (adminEmails || []).filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, message: 'No admin emails' };
  }

  const results = [];
  for (const adminEmail of recipients) {
    const result = await sendMail({
      to: adminEmail,
      subject: 'Novo utilizador pendente de aprovação - Despesas',
      text: `
Um novo utilizador registou-se e está pendente de aprovação:

Email: ${newUserEmail}

Para aprovar: ${approvalUrl}
      `.trim(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Novo utilizador pendente</h2>
          <p>Email: <strong>${newUserEmail}</strong></p>
          <p>
            <a href="${approvalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
              Aprovar utilizador
            </a>
          </p>
        </div>
      `,
    });
    results.push({ email: adminEmail, success: result.success });
  }

  return { success: results.some((r) => r.success), results };
}

async function sendDebitReminderEmail(email, expenses, daysBefore) {
  const totalCents = expenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  const totalEur = (totalCents / 100).toFixed(2);
  const daysText = daysBefore === 0 ? 'hoje' : daysBefore === 1 ? 'amanhã' : `em ${daysBefore} dias`;
  const countText = expenses.length === 1 ? '1 despesa' : `${expenses.length} despesas`;

  const expenseItemsText = expenses.map(e => {
    const val = ((e.amount_cents || 0) / 100).toFixed(2);
    return `- ${e.description}: ${val}€ (data: ${e.debit_date})`;
  }).join('\n');

  const expenseItemsHtml = expenses.map(e => {
    const val = ((e.amount_cents || 0) / 100).toFixed(2);
    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 8px; font-weight: 500; color: #1f2937;">${e.description}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #dc2626;">${val}€</td>
        <td style="padding: 10px 8px; text-align: right; color: #6b7280; font-size: 13px;">${e.debit_date}</td>
      </tr>
    `;
  }).join('');

  const frontendUrl = (process.env.FRONTEND_URL || 'https://despesa-app.vercel.app').replace(/\/+$/, '');

  return sendMail({
    to: email,
    subject: `⚠️ Lembrete: ${countText} a debitar ${daysText} (${totalEur}€) - Despesas`,
    text: `
Olá,

Tens ${countText} para pagar ${daysText}, no valor total de ${totalEur}€:

${expenseItemsText}

Abre a aplicação para consultar ou marcar como pagas:
${frontendUrl}
    `.trim(),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin: 0;">Lembrete de Débito</h2>
          <p style="color: #4b5563; margin-top: 6px;">Tens <strong>${countText}</strong> a debitar <strong>${daysText}</strong>.</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left; font-size: 13px; color: #4b5563;">
              <th style="padding: 8px;">Descrição</th>
              <th style="padding: 8px; text-align: right;">Valor</th>
              <th style="padding: 8px; text-align: right;">Data</th>
            </tr>
          </thead>
          <tbody>
            ${expenseItemsHtml}
            <tr style="background-color: #f9fafb; font-weight: bold;">
              <td style="padding: 10px 8px; color: #111827;">Total</td>
              <td style="padding: 10px 8px; text-align: right; color: #1e40af; font-size: 16px;">${totalEur}€</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${frontendUrl}" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Abrir Aplicação Despesas
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          Este é um alerta automático gerado de acordo com as tuas definições de lembretes.
        </p>
      </div>
    `
  });
}

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
  sendUserApprovalNotification,
  sendDebitReminderEmail
};

const nodemailer = require('nodemailer');

function isPlaceholder(value) {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v.startsWith('your-') || v.includes('change-this') || v === 'undefined';
}

function fromAddress() {
  return (
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_FROM ||
    'noreply@despesas.app'
  );
}

function isEmailConfigured() {
  const hasUserAndPass = process.env.SMTP_USER && !isPlaceholder(process.env.SMTP_USER) &&
                         process.env.SMTP_PASS && !isPlaceholder(process.env.SMTP_PASS);
  const hasHost = process.env.SMTP_HOST && !isPlaceholder(process.env.SMTP_HOST);
  return Boolean(hasUserAndPass || hasHost);
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS || '';
  const pass = rawPass.replace(/\s+/g, '');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    console.warn('Email não enviado: serviço de email não configurado');
    return { success: false, message: 'Email service not configured' };
  }

  const from = fromAddress();

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log(`Email enviado com sucesso para ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Erro ao enviar email para ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

// 1. Notificar administradores de novo registo pendente de aprovação
async function sendUserApprovalNotification(adminEmails, newUserEmail, approvalToken, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const approvalUrl = `${cleanUrl}/login?approve=${approvalToken}`;
  const recipients = (adminEmails || []).filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, message: 'No admin emails found' };
  }

  const results = [];
  for (const adminEmail of recipients) {
    const result = await sendMail({
      to: adminEmail,
      subject: 'Novo utilizador pendente de aprovação - Despesas',
      text: `Olá,\n\nUm novo utilizador registou-se e está pendente de aprovação:\nEmail: ${newUserEmail}\n\nPara aprovar este utilizador com 1 clique, aceda a:\n${approvalUrl}\n\nCumprimentos,\nDespesas App`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #1e40af; margin: 0; font-size: 22px;">Novo Utilizador Registado</h2>
            <p style="color: #4b5563; font-size: 14px; margin-top: 6px;">Existe uma nova conta que requer a sua aprovação de administrador.</p>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
            <p style="margin: 0; color: #64748b;">Email do novo utilizador:</p>
            <p style="margin: 4px 0 0 0; color: #0f172a; font-weight: 600; font-size: 16px;">${newUserEmail}</p>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${approvalUrl}" style="display: inline-block; padding: 12px 28px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);">
              Aprovar Utilizador Agora
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; pt: 16px;">
            Também pode aprovar esta conta através do Painel de Administração na aplicação.
          </p>
        </div>
      `
    });
    results.push({ email: adminEmail, success: result.success });
  }

  return { success: results.some(r => r.success), results };
}

// 2. Notificar o utilizador que a sua conta foi aprovada
async function sendUserApprovedConfirmation(userEmail, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const loginUrl = `${cleanUrl}/login`;

  return sendMail({
    to: userEmail,
    subject: 'A sua conta foi aprovada! - Despesas',
    text: `Olá,\n\nA sua conta no Despesas App foi aprovada pelo administrador.\nJá pode aceder e iniciar sessão em:\n${loginUrl}\n\nCumprimentos,\nDespesas App`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #16a34a; margin: 0; font-size: 22px;">Conta Aprovada com Sucesso!</h2>
          <p style="color: #4b5563; font-size: 14px; margin-top: 6px;">A sua conta no Despesas App está pronta a ser utilizada.</p>
        </div>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          O administrador aprovou o seu registo. A partir deste momento já pode aceder a todas as funcionalidades de gestão de despesas e poupanças.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Entrar na Aplicação
          </a>
        </div>
      </div>
    `
  });
}

// 3. Notificar administradores que um utilizador solicitou redefinição de password
async function sendPasswordResetRequestNotification(adminEmails, userEmail, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const adminUrl = `${cleanUrl}/login`;
  const recipients = (adminEmails || []).filter(Boolean);

  if (recipients.length === 0) return { success: false };

  for (const adminEmail of recipients) {
    await sendMail({
      to: adminEmail,
      subject: 'Pedido de Recuperação de Password - Despesas',
      text: `Olá,\n\nO utilizador ${userEmail} solicitou a redefinição da sua password.\nAceda ao Painel de Administração para aprovar este pedido:\n${adminUrl}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #ea580c; margin: 0 0 12px 0; font-size: 20px;">Pedido de Recuperação de Password</h2>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
            O utilizador <strong>${userEmail}</strong> solicitou a redefinição da sua password no Despesas App.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${adminUrl}" style="display: inline-block; padding: 11px 24px; background-color: #ea580c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Abrir Painel de Administração
            </a>
          </div>
        </div>
      `
    });
  }
}

// 4. Notificar utilizador que o seu pedido de redefinição de password foi aprovado
async function sendPasswordResetApprovedNotification(userEmail, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const resetUrl = `${cleanUrl}/login?mode=reset&email=${encodeURIComponent(userEmail)}`;

  return sendMail({
    to: userEmail,
    subject: 'Recuperação de Password Aprovada - Despesas',
    text: `Olá,\n\nO seu pedido de redefinição de password foi aprovado pelo administrador.\nClique no link seguinte para definir a sua nova password:\n${resetUrl}\n\nCumprimentos,\nDespesas App`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #2563eb; margin: 0 0 12px 0; font-size: 20px;">Redefinir a sua Password</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
          O administrador aprovou o seu pedido de recuperação de password. Pode agora definir uma nova palavra-passe clicando no botão abaixo:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Definir Nova Password
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
          Se não solicitou esta alteração, entre em contacto imediatamente com o administrador da aplicação.
        </p>
      </div>
    `
  });
}

// 5. Envio direto de token de reset de password (se utilizado)
async function sendPasswordResetEmail(email, resetToken, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const resetUrl = `${cleanUrl}/login?reset=${resetToken}`;

  return sendMail({
    to: email,
    subject: 'Recuperação de Password - Despesas',
    text: `Olá,\n\nRecebemos um pedido para redefinir a sua password:\n${resetUrl}\n\nEste link expira em 1 hora.\nSe não fez este pedido, ignore este email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #2563eb; margin: 0 0 12px 0;">Recuperação de Password</h2>
        <p style="color: #4b5563; font-size: 14px;">Recebemos um pedido para redefinir a sua password.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Redefinir Password
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">Este link expira em 1 hora.</p>
      </div>
    `
  });
}

// 6. Lembretes de débito
async function sendDebitReminderEmail(email, expenses, daysBefore) {
  const totalCents = expenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  const totalEur = (totalCents / 100).toFixed(2);
  const daysText = daysBefore === 0 ? 'hoje' : daysBefore === 1 ? 'amanhã' : `em ${daysBefore} dias`;
  const countText = expenses.length === 1 ? '1 despesa' : `${expenses.length} despesas`;

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
    text: `Olá,\n\nTens ${countText} a debitar ${daysText}, no valor total de ${totalEur}€.\nAbre a aplicação para consultar: ${frontendUrl}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e40af; margin: 0 0 6px 0;">Lembrete de Débito</h2>
        <p style="color: #4b5563; font-size: 14px;">Tens <strong>${countText}</strong> a debitar <strong>${daysText}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8fafc; font-size: 13px; color: #64748b;">
              <th style="padding: 8px; text-align: left;">Descrição</th>
              <th style="padding: 8px; text-align: right;">Valor</th>
              <th style="padding: 8px; text-align: right;">Data</th>
            </tr>
          </thead>
          <tbody>
            ${expenseItemsHtml}
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td style="padding: 10px 8px; color: #0f172a;">Total</td>
              <td style="padding: 10px 8px; text-align: right; color: #1e40af; font-size: 16px;">${totalEur}€</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${frontendUrl}" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Abrir Despesas App
          </a>
        </div>
      </div>
    `
  });
}

// 7. Lembretes de despesas sem valor
async function sendNoValueExpensesEmail(email, expenses) {
  const count = expenses.length;
  const countText = count === 1 ? '1 despesa sem valor' : `${count} despesas sem valor`;
  const frontendUrl = (process.env.FRONTEND_URL || 'https://despesa-app.vercel.app').replace(/\/+$/, '');

  return sendMail({
    to: email,
    subject: `⚠️ Atenção: ${countText} a necessitar de valor - Despesas`,
    text: `Olá,\n\nTens ${countText} agendadas para este mês que ainda não têm o montante preenchido.\nAbre a aplicação para atualizar: ${frontendUrl}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #b45309; margin: 0 0 10px 0;">Despesas Sem Valor Definido</h2>
        <p style="color: #4b5563; font-size: 14px;">Tens <strong>${countText}</strong> que necessitam de preenchimento de valor.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${frontendUrl}" style="display: inline-block; padding: 12px 24px; background-color: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Preencher Valores
          </a>
        </div>
      </div>
    `
  });
}

module.exports = {
  isEmailConfigured,
  sendMail,
  sendPasswordResetEmail,
  sendUserApprovalNotification,
  sendUserApprovedConfirmation,
  sendPasswordResetRequestNotification,
  sendPasswordResetApprovedNotification,
  sendDebitReminderEmail,
  sendNoValueExpensesEmail
};

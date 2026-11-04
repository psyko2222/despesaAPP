const nodemailer = require('nodemailer');

function isPlaceholder(value) {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v.startsWith('your-') || v.includes('change-this') || v === 'undefined';
}

function fromAddress() {
  const addr = (
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_FROM ||
    'despesasnotificacao@gmail.com'
  ).trim();
  return addr.replace(/@gmial\.com$/i, '@gmail.com');
}

function isEmailConfigured() {
  const user = process.env.SMTP_USER || 'despesasnotificacao@gmail.com';
  const hasUserAndPass = user && !isPlaceholder(user) &&
                         process.env.SMTP_PASS && !isPlaceholder(process.env.SMTP_PASS);
  const hasHost = process.env.SMTP_HOST && !isPlaceholder(process.env.SMTP_HOST);
  return Boolean(hasUserAndPass || hasHost);
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  let user = (process.env.SMTP_USER || 'despesasnotificacao@gmail.com').trim();
  user = user.replace(/@gmial\.com$/i, '@gmail.com');
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

// Layout corporativo profissional para todos os emails
function renderEmailLayout({ headerColor = '#2563eb', badgeText, badgeBg = '#eff6ff', badgeColor = '#1d4ed8', title, contentHtml }) {
  const currentYear = new Date().getFullYear();
  return `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 12px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
              <!-- Barra superior de destaque -->
              <tr>
                <td style="height: 6px; background-color: ${headerColor};"></td>
              </tr>
              <!-- Cabeçalho com Logótipo / Branding -->
              <tr>
                <td style="padding: 24px 28px 16px 28px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                  <div style="display: inline-block; padding: 6px 14px; background-color: #0f172a; border-radius: 8px;">
                    <span style="font-weight: 800; font-size: 14px; color: #ffffff; letter-spacing: 1px;">DESPESAS APP</span>
                  </div>
                  <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Gestão Inteligente de Despesas & Poupanças</p>
                </td>
              </tr>
              <!-- Conteúdo Principal -->
              <tr>
                <td style="padding: 28px 28px 24px 28px;">
                  ${badgeText ? `
                    <div style="text-align: center; margin-bottom: 14px;">
                      <span style="display: inline-block; padding: 4px 12px; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 700; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${badgeText}
                      </span>
                    </div>
                  ` : ''}
                  <h1 style="margin: 0 0 16px 0; font-size: 21px; font-weight: 700; color: #0f172a; text-align: center; line-height: 1.35;">
                    ${title}
                  </h1>
                  <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                    ${contentHtml}
                  </div>
                  <!-- Caixa de Alerta sobre Caixa de Lixo / Spam -->
                  <div style="margin-top: 26px; padding: 12px 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.55;">
                    📬 <strong>Dica importante:</strong> Se não visualizar futuras notificações ou links de recuperação na sua Caixa de Entrada principal, verifique sempre a pasta de <strong>Lixo Eletrónico</strong> ou <strong>Spam</strong> e marque o remetente como confiável.
                  </div>
                </td>
              </tr>
              <!-- Rodapé Corporativo -->
              <tr>
                <td style="padding: 18px 28px 24px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                  <p style="margin: 0;">© ${currentYear} Despesas App — Todos os direitos reservados.</p>
                  <p style="margin: 4px 0 0 0;">Esta é uma mensagem automática de segurança. Por favor não responda a este email.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// 1. Notificar administradores de novo registo pendente de aprovação
async function sendUserApprovalNotification(adminEmails, newUserEmail, approvalToken, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const approvalUrl = `${cleanUrl}/login?approve=${approvalToken}`;
  const adminPanelUrl = `${cleanUrl}/login`;
  const recipients = (adminEmails || []).filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, message: 'No admin emails found' };
  }

  const registeredAt = new Date().toLocaleString('pt-PT', { 
    dateStyle: 'long', 
    timeStyle: 'short' 
  });

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">
      Informamos que um novo utilizador concluiu o registo na aplicação e aguarda a sua validação.
    </p>

    <!-- Caixa de Política de Segurança -->
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 12px 14px; margin: 18px 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
      <strong>🛡️ Política de Acesso:</strong> De acordo com a regra de segurança da plataforma, todas as novas contas são criadas em <strong>estado suspenso</strong>, permanecendo estritamente sem acesso até aprovação manual por um administrador.
    </div>

    <!-- Tabela de Detalhes -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Detalhes do Novo Registo</p>
      <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px;">👤 ${newUserEmail}</p>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">📅 Registado a: ${registeredAt}</p>
      <p style="margin: 4px 0 0 0; color: #b45309; font-size: 13px; font-weight: 600;">⏳ Estado atual: Suspenso (A aguardar aprovação)</p>
    </div>

    <p style="color: #475569; font-size: 13px; margin: 18px 0 10px 0;">
      Pode aprovar este utilizador de imediato com um clique no botão abaixo:
    </p>

    <!-- Botão de Aprovação 1-clique -->
    <div style="text-align: center; margin: 24px 0;">
      <a href="${approvalUrl}" style="display: inline-block; padding: 13px 30px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25);">
        ✓ Aprovar Utilizador Agora
      </a>
    </div>

    <div style="text-align: center; margin-top: 14px;">
      <a href="${adminPanelUrl}" style="color: #64748b; font-size: 12px; text-decoration: underline;">
        Ou gerir/rejeitar através do Painel de Administração
      </a>
    </div>
  `;

  const html = renderEmailLayout({
    headerColor: '#d97706',
    badgeText: '⚠️ Ação Necessária',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    title: 'Novo Utilizador Pendente de Aprovação',
    contentHtml
  });

  const results = [];
  for (const adminEmail of recipients) {
    const result = await sendMail({
      to: adminEmail,
      subject: `⚠️ Novo Utilizador Registado (${newUserEmail}) - Aprovação Necessária`,
      text: `Olá,

Um novo utilizador registou-se no Despesas App: ${newUserEmail}
Data: ${registeredAt}

A conta encontra-se suspensa até que seja aprovada por um administrador.
Para aprovar com 1 clique, aceda a:
${approvalUrl}

Cumprimentos,
Despesas App`,
      html
    });
    results.push({ email: adminEmail, success: result.success });
  }

  return { success: results.some(r => r.success), results };
}

// 2. Notificar novo utilizador que o seu registo foi recebido e aguarda aprovação
async function sendUserRegistrationPendingNotification(userEmail, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">
      Olá, agradecemos o seu registo na plataforma <strong>Despesas App</strong>.
    </p>

    <!-- Caixa de Destaque da Conta Suspensa -->
    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px; margin: 18px 0; font-size: 13px; color: #1e40af; line-height: 1.55;">
      <strong>ℹ️ Nota Importante de Segurança:</strong><br/>
      Por motivos de proteção e controlo de acessos, informamos que <strong>a sua conta fica temporariamente suspensa</strong> até aceitação e validação expressa por parte do administrador.
    </div>

    <p style="color: #334155;">
      O seu pedido já se encontra na lista de validação da administração. Assim que o administrador aprovar o seu registo, <strong>receberá um email de confirmação</strong> a avisar que a conta foi ativada.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #475569;">
      <strong>Email registado:</strong> <span style="color: #0f172a; font-weight: 600;">${userEmail}</span><br/>
      <strong>Estado atual:</strong> <span style="color: #d97706; font-weight: 600;">Suspenso (A aguardar aceitação)</span>
    </div>

    <p style="color: #64748b; font-size: 13px;">
      Pedimos que aguarde a receção da mensagem de ativação antes de tentar aceder.
    </p>
  `;

  const html = renderEmailLayout({
    headerColor: '#2563eb',
    badgeText: 'Registo Concluído',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    title: 'O seu registo foi recebido!',
    contentHtml
  });

  return sendMail({
    to: userEmail,
    subject: 'Registo Recebido - Conta Pendente de Aprovação - Despesas',
    text: `Olá,

Recebemos com sucesso o seu registo no Despesas App (${userEmail}).

Por motivos de segurança, a sua conta fica temporariamente suspensa até aceitação pelo administrador.
Assim que a sua conta for ativada, receberá uma notificação por email.

Nota: Verifique também a pasta de Lixo Eletrónico / Spam.

Cumprimentos,
Despesas App`,
    html
  });
}

// 3. Notificar o utilizador que a sua conta foi ativada/aprovada pelo administrador
async function sendUserApprovedConfirmation(userEmail, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const loginUrl = `${cleanUrl}/login`;

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">
      Temos o prazer de informar que o administrador do sistema validou o seu registo e <strong>a sua conta foi ativada com sucesso</strong>!
    </p>

    <!-- Caixa de Referência à Política de Suspensão Anterior -->
    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; padding: 14px; margin: 18px 0; font-size: 13px; color: #166534; line-height: 1.55;">
      <strong>✓ Conta Desbloqueada:</strong><br/>
      Relembramos que, por norma da plataforma, todas as contas permanecem suspensas até aceitação formal da administração. A sua conta cumpriu com sucesso todas as validações e encontra-se agora <strong>100% operacional</strong>.
    </div>

    <p style="color: #334155;">
      A partir deste momento já pode aceder a todas as funcionalidades de gestão de despesas, orçamentos e poupanças.
    </p>

    <!-- Botão de Acesso -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${loginUrl}" style="display: inline-block; padding: 13px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);">
        Entrar na Minha Conta
      </a>
    </div>

    <p style="color: #64748b; font-size: 13px; text-align: center; margin-bottom: 0;">
      Email de acesso: <strong>${userEmail}</strong>
    </p>
  `;

  const html = renderEmailLayout({
    headerColor: '#16a34a',
    badgeText: '✓ Conta Ativa',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    title: 'A sua conta foi ativada!',
    contentHtml
  });

  return sendMail({
    to: userEmail,
    subject: 'Conta Ativada com Sucesso - Despesas',
    text: `Olá,

A sua conta no Despesas App foi aprovada e ativada pelo administrador.
Relembramos que a conta permaneceu suspensa até esta validação e já pode entrar livremente em:
${loginUrl}

Nota: Verifique a pasta de Lixo Eletrónico/Spam se não encontrar futuros avisos.

Cumprimentos,
Despesas App`,
    html
  });
}

// 4. Envio de link direto de recuperação de password para o utilizador
async function sendPasswordResetEmail(email, resetToken, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const resetUrl = `${cleanUrl}/login?reset=${resetToken}`;

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">
      Recebemos um pedido para recuperar a palavra-passe associada à sua conta com o endereço <strong>${email}</strong>.
    </p>

    <p style="color: #334155;">
      Para definir uma nova palavra-passe de forma segura, clique no botão abaixo:
    </p>

    <!-- Botão de Redefinição -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="display: inline-block; padding: 13px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);">
        Redefinir Palavra-passe
      </a>
    </div>

    <!-- Caixa de Segurança -->
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 12px 14px; margin: 18px 0; font-size: 12px; color: #92400e; line-height: 1.55;">
      <strong>🔒 Aviso de Segurança:</strong><br/>
      • Este link é estritamente pessoal e expira automaticamente em <strong>1 hora</strong>.<br/>
      • Se não fez este pedido de recuperação, pode ignorar esta mensagem com total segurança — a sua password atual permanecerá inalterada.
    </div>

    <p style="color: #94a3b8; font-size: 11px; word-break: break-all; margin-top: 16px;">
      Caso o botão não funcione, copie e cole este endereço no seu navegador:<br/>
      <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
    </p>
  `;

  const html = renderEmailLayout({
    headerColor: '#2563eb',
    badgeText: 'Recuperação de Acesso',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    title: 'Recuperação de Palavra-passe',
    contentHtml
  });

  return sendMail({
    to: email,
    subject: 'Recuperação de Palavra-passe - Despesas',
    text: `Olá,

Recebemos um pedido para redefinir a palavra-passe da sua conta no Despesas App.

Para definir uma nova palavra-passe, aceda ao seguinte link (válido por 1 hora):
${resetUrl}

Se não fez este pedido, ignore este email.
Nota: Verifique também a pasta de Lixo Eletrónico / Spam.

Cumprimentos,
Despesas App`,
    html
  });
}

// 5. Notificar administradores que um utilizador solicitou redefinição de password
async function sendPasswordResetRequestNotification(adminEmails, userEmail, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const adminUrl = `${cleanUrl}/login`;
  const recipients = (adminEmails || []).filter(Boolean);

  if (recipients.length === 0) return { success: false };

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">
      O utilizador <strong>${userEmail}</strong> acabou de solicitar a redefinição da sua palavra-passe na aplicação.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #475569;">
      <strong>Utilizador:</strong> ${userEmail}<br/>
      <strong>Ação efetuada:</strong> Foi enviado um link de recuperação direta com validade de 1 hora.
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${adminUrl}" style="display: inline-block; padding: 12px 26px; background-color: #475569; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px;">
        Abrir Painel de Gestão
      </a>
    </div>
  `;

  const html = renderEmailLayout({
    headerColor: '#f59e0b',
    badgeText: 'Aviso de Segurança',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    title: 'Pedido de Recuperação de Palavra-passe',
    contentHtml
  });

  for (const adminEmail of recipients) {
    await sendMail({
      to: adminEmail,
      subject: `Aviso: Pedido de Recuperação de Password (${userEmail}) - Despesas`,
      text: `Olá,

O utilizador ${userEmail} solicitou a recuperação da sua palavra-passe.
O link de redefinição foi enviado diretamente para o seu email.

Cumprimentos,
Despesas App`,
      html
    });
  }
}

// 6. Notificar utilizador que o seu pedido de redefinição de password foi aprovado manualmente
async function sendPasswordResetApprovedNotification(userEmail, frontendUrl) {
  const cleanUrl = (frontendUrl || 'https://despesa-app.vercel.app').replace(/\/+$/, '');
  const resetUrl = `${cleanUrl}/login?mode=reset&email=${encodeURIComponent(userEmail)}`;

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">
      O administrador do sistema aprovou o seu pedido de redefinição de palavra-passe.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" style="display: inline-block; padding: 13px 30px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
        Definir Nova Password
      </a>
    </div>
  `;

  const html = renderEmailLayout({
    headerColor: '#2563eb',
    badgeText: 'Aprovado',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    title: 'Recuperação de Palavra-passe Aprovada',
    contentHtml
  });

  return sendMail({
    to: userEmail,
    subject: 'Recuperação de Password Aprovada - Despesas',
    text: `Olá,

O seu pedido de redefinição de password foi aprovado pelo administrador.
Defina a sua nova password em: ${resetUrl}

Cumprimentos,
Despesas App`,
    html
  });
}

// 7. Lembretes de débito
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

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">Tens <strong>${countText}</strong> a debitar <strong>${daysText}</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0;">
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
  `;

  return sendMail({
    to: email,
    subject: `⚠️ Lembrete: ${countText} a debitar ${daysText} (${totalEur}€) - Despesas`,
    text: `Olá,

Tens ${countText} a debitar ${daysText}, no valor total de ${totalEur}€.
Abre a aplicação: ${frontendUrl}`,
    html: renderEmailLayout({
      headerColor: '#dc2626',
      badgeText: 'Lembrete de Débito',
      badgeBg: '#fee2e2',
      badgeColor: '#b91c1c',
      title: 'Lembrete de Débito',
      contentHtml
    })
  });
}

// 8. Lembretes de despesas sem valor
async function sendNoValueExpensesEmail(email, expenses) {
  const count = expenses.length;
  const countText = count === 1 ? '1 despesa sem valor' : `${count} despesas sem valor`;
  const frontendUrl = (process.env.FRONTEND_URL || 'https://despesa-app.vercel.app').replace(/\/+$/, '');

  const contentHtml = `
    <p style="margin-top: 0; color: #334155;">Tens <strong>${countText}</strong> que necessitam de preenchimento de valor.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${frontendUrl}" style="display: inline-block; padding: 12px 24px; background-color: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Preencher Valores
      </a>
    </div>
  `;

  return sendMail({
    to: email,
    subject: `⚠️ Atenção: ${countText} a necessitar de valor - Despesas`,
    text: `Olá,

Tens ${countText} que necessitam de preenchimento de valor.
Abre a aplicação: ${frontendUrl}`,
    html: renderEmailLayout({
      headerColor: '#d97706',
      badgeText: 'Valor em Falta',
      badgeBg: '#fef3c7',
      badgeColor: '#b45309',
      title: 'Despesas Sem Valor Definido',
      contentHtml
    })
  });
}

module.exports = {
  isEmailConfigured,
  sendMail,
  sendPasswordResetEmail,
  sendUserApprovalNotification,
  sendUserRegistrationPendingNotification,
  sendUserApprovedConfirmation,
  sendPasswordResetRequestNotification,
  sendPasswordResetApprovedNotification,
  sendDebitReminderEmail,
  sendNoValueExpensesEmail
};

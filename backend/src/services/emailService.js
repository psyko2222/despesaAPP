const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, resetToken, frontendUrl) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured. Reset token:', resetToken);
    return { success: false, message: 'Email service not configured' };
  }

  const resetUrl = `${frontendUrl}/login?reset=${resetToken}`;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@despesas.app',
    subject: 'Recuperação de Password - Despesas',
    text: `
      Recebemos um pedido para redefinir a sua password.
      
      Clique no link abaixo para redefinir a sua password:
      ${resetUrl}
      
      Este link expira em 1 hora.
      
      Se não fez este pedido, ignore este email.
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Recuperação de Password</h2>
        <p>Recebemos um pedido para redefinir a sua password.</p>
        <p>Clique no botão abaixo para redefinir a sua password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
          Redefinir Password
        </a>
        <p>Ou copie e cole este link no seu browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #666; font-size: 14px;">Este link expira em 1 hora.</p>
        <p style="color: #666; font-size: 14px;">Se não fez este pedido, ignore este email.</p>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { success: false, message: 'Failed to send email', error: error.message };
  }
}

/**
 * Send user approval notification to admins
 */
async function sendUserApprovalNotification(adminEmails, newUserEmail, approvalToken, frontendUrl) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured. Approval token:', approvalToken);
    console.log('Admin emails to notify:', adminEmails);
    return { success: false, message: 'Email service not configured' };
  }

  const approvalUrl = `${frontendUrl}/admin?approve=${approvalToken}`;

  const results = [];

  for (const adminEmail of adminEmails) {
    const msg = {
      to: adminEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@despesas.app',
      subject: 'Novo Utilizador Pendente de Aprovação - Despesas',
      text: `
        Um novo utilizador registou-se e está pendente de aprovação:
        
        Email: ${newUserEmail}
        
        Para aprovar este utilizador, clique no link abaixo:
        ${approvalUrl}
        
        Para rejeitar, aceda ao painel de administração.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Novo Utilizador Pendente de Aprovação</h2>
          <p>Um novo utilizador registou-se e está pendente de aprovação:</p>
          <p style="font-weight: bold; color: #333;">Email: ${newUserEmail}</p>
          <p>Para aprovar este utilizador, clique no botão abaixo:</p>
          <a href="${approvalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Aprovar Utilizador
          </a>
          <p>Ou copie e cole este link no seu browser:</p>
          <p style="word-break: break-all; color: #666;">${approvalUrl}</p>
          <p style="color: #666; font-size: 14px;">Para rejeitar, aceda ao painel de administração.</p>
        </div>
      `
    };

    try {
      await sgMail.send(msg);
      results.push({ email: adminEmail, success: true });
    } catch (error) {
      console.error(`Failed to send approval email to ${adminEmail}:`, error);
      results.push({ email: adminEmail, success: false, error: error.message });
    }
  }

  return { success: true, results };
}

module.exports = {
  sendPasswordResetEmail,
  sendUserApprovalNotification
};

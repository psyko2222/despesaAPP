// Email service desativado a pedido do utilizador.
// Todas as operações de email são tratadas de forma segura e silenciosa sem dependências externas.

function isEmailConfigured() {
  return false;
}

async function sendPasswordResetEmail() {
  return { success: false, message: 'Email service is disabled' };
}

async function sendUserApprovalNotification() {
  return { success: false, message: 'Email service is disabled' };
}

async function sendDebitReminderEmail() {
  return { success: false, message: 'Email service is disabled' };
}

async function sendNoValueExpensesEmail() {
  return { success: false, message: 'Email service is disabled' };
}

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
  sendUserApprovalNotification,
  sendDebitReminderEmail,
  sendNoValueExpensesEmail
};

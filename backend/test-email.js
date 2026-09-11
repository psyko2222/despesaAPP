/**
 * Script de teste para configuração de email
 * Executar: node test-email.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('=== Teste de Configuração de Email ===\n');

// Verificar variáveis de ambiente
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM
};

console.log('Configuração SMTP:');
console.log('HOST:', smtpConfig.host || 'NÃO DEFINIDO');
console.log('PORT:', smtpConfig.port || 'NÃO DEFINIDO');
console.log('SECURE:', smtpConfig.secure || 'NÃO DEFINIDO');
console.log('USER:', smtpConfig.user || 'NÃO DEFINIDO');
console.log('PASS:', smtpConfig.pass ? '***CONFIGURADO***' : 'NÃO DEFINIDO');
console.log('FROM:', smtpConfig.from || 'NÃO DEFINIDO');
console.log();

// Verificar se configuração está completa
if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
  console.error('❌ Configuração incompleta. Configure as variáveis de ambiente SMTP.');
  process.exit(1);
}

console.log('✅ Configuração básica está completa.\n');

// Configurar transporter específico para Outlook se necessário
const isOutlook = smtpConfig.host.includes('outlook.com') ||
                 smtpConfig.host.includes('hotmail.com') ||
                 smtpConfig.user.includes('@outlook.com') ||
                 smtpConfig.user.includes('@hotmail.com');

// Configurar transporter específico para Gmail se necessário
const isGmail = smtpConfig.host.includes('gmail.com') ||
                smtpConfig.user.includes('@gmail.com');

let transporterConfig;
if (isOutlook) {
  transporterConfig = {
    host: smtpConfig.host,
    port: Number(smtpConfig.port) || 587,
    secure: false,
    tls: {
      ciphers: 'SSLv3'
    },
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    }
  };
} else if (isGmail) {
  transporterConfig = {
    host: smtpConfig.host,
    port: Number(smtpConfig.port) || 587,
    secure: false,
    tls: {
      rejectUnauthorized: false
    },
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    }
  };
} else {
  transporterConfig = {
    host: smtpConfig.host,
    port: Number(smtpConfig.port) || 587,
    secure: smtpConfig.secure === 'true' || Number(smtpConfig.port) === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    }
  };
}

console.log('Tipo de configuração:', isOutlook ? 'Outlook/Hotmail' : 'SMTP Genérico');
console.log();

// Testar conexão
console.log('📧 Testando conexão SMTP...');
const transporter = nodemailer.createTransport(transporterConfig);

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Erro na conexão SMTP:', error);
    process.exit(1);
  }
  
  console.log('✅ Conexão SMTP estabelecida com sucesso!\n');
  
  // Enviar email de teste
  const testEmail = {
    from: smtpConfig.from,
    to: smtpConfig.user, // Enviar para o próprio email
    subject: '🧪 Teste de Email - Despesas App',
    text: 'Este é um email de teste da aplicação Despesas.\n\nSe recebeu este email, a configuração SMTP está funcionando corretamente!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">✅ Teste de Email Bem-Sucedido</h2>
        <p>Este é um email de teste da aplicação Despesas.</p>
        <p style="color: #16a34a; font-weight: bold;">A configuração SMTP está funcionando corretamente!</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">
          <strong>Configuração usada:</strong><br>
          Host: ${smtpConfig.host}<br>
          Port: ${smtpConfig.port}<br>
          From: ${smtpConfig.from}
        </p>
      </div>
    `
  };
  
  console.log('📤 Enviando email de teste para:', smtpConfig.user);
  
  transporter.sendMail(testEmail, (error, info) => {
    if (error) {
      console.error('❌ Erro ao enviar email:', error);
      process.exit(1);
    }
    
    console.log('✅ Email enviado com sucesso!');
    console.log('📋 Message ID:', info.messageId);
    console.log('📎 Response:', info.response);
    console.log('\n🎉 Configuração de email está funcionando corretamente!');
    console.log('📧 Verifique a sua caixa de entrada (e spam) para confirmar recebimento.');
    
    transporter.close();
    process.exit(0);
  });
});
/**
 * Script de teste para funcionalidade de reset de password
 * Executar: node test-reset-password.js
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testForgotPassword() {
  console.log('=== Teste de Reset de Password ===\n');
  
  const testEmail = 'luislzandroid@gmail.com';
  
  try {
    console.log(`📧 Enviando pedido de reset para: ${testEmail}`);
    
    const response = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: testEmail
    });
    
    console.log('✅ Pedido enviado com sucesso!');
    console.log('📋 Resposta:', response.data);
    console.log('\n🎉 Verifique o seu email para o link de reset!');
    
  } catch (error) {
    console.error('❌ Erro no pedido de reset:', error.response?.data || error.message);
  }
}

testForgotPassword();
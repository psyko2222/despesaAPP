# 📧 Configuração SendGrid - Envio de Emails

Guia para configurar o SendGrid para envio de emails na webapp Despesas.

## 🎯 Porquê SendGrid?

- **Plano gratuito**: 100 emails/dia (suficiente para 5-6 utilizadores)
- **Entrega confiável**: Alta taxa de entrega
- **Fácil configuração**: API simples
- **Templates HTML**: Suporte para emails bonitos

## 📋 Passo 1: Criar Conta SendGrid

1. Aceda a [sendgrid.com](https://sendgrid.com)
2. Clique em "Sign Up Free"
3. Preencha o formulário de registo
4. Verifique o email de confirmação

## 🔑 Passo 2: Obter API Key

1. Faça login no SendGrid
2. Vá a **Settings** → **API Keys**
3. Clique em "Create API Key"
4. Dê um nome (ex: "Despesas Webapp")
5. Selecione permissions:
   - **Mail Send**: Full Access
   - **Mail Send**: Restricted Access (opcional)
6. Clique "Create & View"
7. **Copie a API Key** (só aparece uma vez!)

## 📧 Passo 3: Configurar Sender Identity

1. No SendGrid, vá a **Settings** → **Sender Authentication**
2. Clique em "Create New Sender"
3. Escolha uma opção:
   - **Single Sender** (mais fácil para testes)
   - **Domain Authentication** (mais profissional)

### Opção A: Single Sender (Recomendado para começar)
1. Preencha os dados:
   - **From Email**: seu-email@dominio.com
   - **From Name**: Despesas
   - **Reply To**: seu-email@dominio.com
   - **Address**: Seu endereço
2. Clique "Create"
3. Verifique o email para confirmar

### Opção B: Domain Authentication (Mais profissional)
1. Adicione o seu domínio
2. Siga as instruções DNS
3. Mais credibilidade nos emails

## ⚙️ Passo 4: Configurar Backend

### 4.1 Adicionar variáveis de ambiente

No ficheiro `backend/.env`:
```env
SENDGRID_API_KEY=SG.sua-api-key-aqui
SENDGRID_FROM_EMAIL=seu-email@dominio.com
FRONTEND_URL=http://localhost:3000
```

### 4.2 Para produção (Railway)

No Railway, no serviço Backend → Variables:
```env
SENDGRID_API_KEY=SG.sua-api-key-aqui
SENDGRID_FROM_EMAIL=seu-email@dominio.com
FRONTEND_URL=https://seu-frontend-url.railway.app
```

## 🧪 Passo 5: Testar Envio de Emails

### 5.1 Testar recuperação de password
1. Inicie o backend
2. Na aplicação, clique em "Esqueceu a password?"
3. Introduza um email de utilizador existente
4. Verifique o email (caixa de entrada e spam)

### 5.2 Testar notificação de aprovação
1. Registe um novo utilizador
2. Verifique o email do admin
3. Deve receber notificação com link de aprovação

## 📊 Monitorização

### Ver estatísticas no SendGrid
1. Dashboard → Activity
2. Veja emails enviados, entregues, abertos
3. Identifique problemas de entrega

### Limites do plano gratuito
- **100 emails/dia**
- **2.000 emails/mês**
- **Suficiente para 5-6 utilizadores**

## 🔧 Troubleshooting

### Email não chega
1. Verifique pasta de spam
2. Verifique se API Key está correta
3. Verifique logs do backend
4. Confirme que Sender Identity está verificada

### Erro de autenticação
1. Verifique se API Key está correta
2. Confirme que tem permissões "Mail Send"
3. Regere a API Key se necessário

### Limites excedidos
1. Verifique estatísticas no SendGrid
2. Considere upgrade de plano
3. Otimize número de emails enviados

## 💰 Custos

- **Plano Free**: 100 emails/dia (grátis)
- **Plano Basic**: $15/mês (40.000 emails/mês)
- **Plano Pro**: $60/mês (100.000 emails/mês)

Para 5-6 utilizadores, o plano gratuito é suficiente.

## 🎨 Personalizar Emails

Pode personalizar os templates em `backend/src/services/emailService.js`:

```javascript
// Modificar template HTML
html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <!-- Seu HTML personalizado -->
  </div>
`
```

## 🚀 Próximos Passos

1. Configure SendGrid seguindo este guia
2. Teste envio de emails
3. Personalize templates se desejar
4. Monitorize estatísticas regularmente

## 📞 Suporte SendGrid

- [Documentação](https://docs.sendgrid.com)
- [Support](https://support.sendgrid.com)
- [Community](https://community.sendgrid.com)

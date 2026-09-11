# Guia de Configuração de Email - SMTP (Hotmail/Outlook/Gmail)

## Passo 1: Criar e Configurar Email Hotmail/Outlook

### 1.1 Criar o email
1. Aceda a https://outlook.com ou https://hotmail.com
2. Crie um novo email para a sua aplicação (ex: `despesas-app@outlook.com`)
3. Escolha um nome profissional e fácil de identificar

### 1.2 Ativar autenticação de app (se necessário)
Se tiver problemas de segurança ao usar a password normal:

1. Aceda ao Microsoft Security Settings: https://account.microsoft.com/security
2. Vá a "Advanced security options"
3. Ative "Two-step verification" se ainda não tiver
4. Em "App passwords", crie uma nova app password
5. Use esta app password no SMTP_PASS em vez da password normal

## Passo 2: Configurar Variáveis de Ambiente

### 2.1 No ambiente local (backend/.env)
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@outlook.com
SMTP_PASS=sua_password_ou_app_password
SMTP_FROM=seuemail@outlook.com
```

### 2.2 No Render (Backend)
1. Aceda ao dashboard do Render: https://dashboard.render.com
2. Selecione o projeto backend (despesas-backend)
3. Vá a "Environment" tab ou "Environment Variables"
4. Adicione as seguintes variáveis:
   - `SMTP_HOST`: `smtp-mail.outlook.com`
   - `SMTP_PORT`: `587`
   - `SMTP_SECURE`: `false`
   - `SMTP_USER`: `seuemail@outlook.com`
   - `SMTP_PASS`: `sua_password_ou_app_password`
   - `SMTP_FROM`: `seuemail@outlook.com`
5. Clique em "Save Changes"
6. O serviço irá fazer redeploy automaticamente

**Nota:** Se tiver variáveis `SENDGRID_API_KEY` ou `SENDGRID_FROM_EMAIL` configuradas, pode apagá-las pois não são necessárias ao usar SMTP.

## Passo 3: Configurar DNS (Opcional - para email personalizado)

Se quiser usar um domínio personalizado (ex: `noreply@seudominio.com`):

### 3.1 Configurar no provedor de domínio
1. Aceda ao painel do seu provedor de domínio (Namecheap, GoDaddy, etc.)
2. Adicione os seguintes registos DNS:

**Registo MX:**
```
Nome: @
Tipo: MX
Valor: outlook-com.mail.protection.outlook.com
Prioridade: 10
TTL: 3600
```

**Registos TXT (para SPF):**
```
Nome: @
Tipo: TXT
Valor: v=spf1 include:spf.protection.outlook.com -all
TTL: 3600
```

### 3.2 Configurar no Microsoft 365 (se tiver plano)
1. Aceda ao Microsoft 365 Admin Center
2. Vá a "Setup" → "Domains"
3. Adicione o seu domínio
4. Siga as instruções para verificar a propriedade do domínio
5. Configure os registos DNS conforme indicado

## Passo 4: Testar o Envio de Email

### 4.1 Teste local
```bash
cd backend
npm run dev
```

### 4.2 Teste de reset de password
1. Registre um utilizador novo
2. Na página de login, clique em "Esqueceu a password?"
3. Introduza o email e verifique se recebe o email

### 4.3 Teste de notificação de admin
1. Faça login como admin
2. Registe um novo utilizador (em browser diferente ou modo incógnito)
3. Verifique se o admin recebe o email de notificação

## Passo 5: Resolver Problemas Comuns

### Erro: "Authentication failed"
- Verifique se o email e password estão corretos
- Se usar password normal, tente usar App Password
- Verifique se a autenticação de 2 fatores está configurada corretamente

### Erro: "Connection timeout"
- Verifique se `SMTP_HOST` está correto: `smtp-mail.outlook.com`
- Verifique se a porta 587 está disponível
- Alguns firewalls podem bloquear portas SMTP

### Erro: "Sender address rejected"
- Verifique se `SMTP_FROM` corresponde ao `SMTP_USER`
- Hotmail/Outlook não permite enviar de outro email

### Email vai para spam
- Verifique os registos SPF/DKIM se usar domínio personalizado
- A primeira vez pode ir para spam, marque como "not spam"

## Configuração Alternativa: Gmail

Se preferir usar Gmail em vez de Hotmail:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@gmail.com
SMTP_PASS=sua_app_password
SMTP_FROM=seuemail@gmail.com
```

**Nota:** Para Gmail é obrigatório usar App Password:
1. Aceda a https://myaccount.google.com/security
2. Ative "2-Step Verification"
3. Em "App passwords", crie uma nova
4. Use esta app password no SMTP_PASS

## Suporte

Se tiver problemas:
1. Verifique os logs do backend no Render
2. Verifique o console do browser para erros
3. Teste as credenciais com um cliente SMTP como outlook.com webmail
4. No Render dashboard, verifique se o serviço está "Deployed" e não em crash
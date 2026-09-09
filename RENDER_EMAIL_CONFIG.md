# Configuração de Email no Render - Guia Passo a Passo

## Configurar Variáveis de Ambiente no Render

### 1. Aceder ao Dashboard do Render
1. Aceda a https://dashboard.render.com
2. Faça login com a sua conta
3. Selecione o projeto backend (despesas-backend)

### 2. Configurar Variáveis de Ambiente
1. No dashboard do serviço backend, clique em "Environment"
2. Clique em "Add Environment Variable"
3. Adicione as seguintes variáveis uma por uma:

#### Variáveis SMTP (Email):
```
SMTP_HOST = smtp-mail.outlook.com
SMTP_PORT = 587
SMTP_SECURE = false
SMTP_USER = seuemail@outlook.com
SMTP_PASS = sua_password_ou_app_password
SMTP_FROM = seuemail@outlook.com
```

#### Variável FRONTEND_URL (já deve existir):
```
FRONTEND_URL = https://despesa-app.vercel.app
```

### 3. Confirmar Alterações
1. Depois de adicionar todas as variáveis, clique em "Save Changes"
2. O Render irá automaticamente fazer redeploy do serviço
3. Aguarde até que o status do serviço seja "Live"

## Obter Credenciais Hotmail/Outlook

### Opção 1: Usar Password Normal
1. Use o seu email e password normal do Outlook/Hotmail
2. **Atenção:** Se tiver autenticação de 2 fatores ativa, use App Password

### Opção 2: Usar App Password (Recomendado)
1. Aceda a https://account.microsoft.com/security
2. Vá a "Advanced security options"
3. Ative "Two-step verification" se ainda não tiver
4. Em "App passwords", clique em "Create a new app password"
5. Dê um nome (ex: "Despesas App")
6. Copie a password gerada
7. Use esta password no campo `SMTP_PASS`

## Testar a Configuração

### 1. Verificar Logs no Render
1. No dashboard do serviço backend, clique em "Logs"
2. Procure por erros relacionados com email
3. Se não houver erros, a configuração está correta

### 2. Testar Funcionalidade de Email
1. Registe um novo utilizador na aplicação
2. Verifique se o admin recebe email de notificação
3. Teste a funcionalidade "Esqueceu a password?"

### 3. Testar Localmente (Opcional)
Se quiser testar antes de configurar no Render:
```bash
cd backend
# Crie um arquivo .env com as variáveis SMTP
node test-email.js
```

## Solução de Problemas Comuns

### Erro: "Authentication failed"
**Solução:**
- Verifique se o email e password estão corretos
- Se usar password normal, tente usar App Password
- Verifique se a autenticação de 2 fatores está configurada corretamente

### Erro: "Connection timeout"
**Solução:**
- Verifique se `SMTP_HOST` está correto: `smtp-mail.outlook.com`
- Verifique se a porta 587 está disponível
- Verifique se o firewall do Render não está a bloquear

### Erro: "Sender address rejected"
**Solução:**
- Verifique se `SMTP_FROM` corresponde ao `SMTP_USER`
- Hotmail/Outlook não permite enviar de outro email

### Serviço fica em crash após configurar
**Solução:**
- Verifique os logs no Render
- Pode haver erro na sintaxe das variáveis
- Tente remover as variáveis e adicionar uma por vez

### Email não chega
**Solução:**
- Verifique a pasta de spam do email
- Primeiros emails podem ser marcados como spam
- Marque como "not spam" para futuros emails

## Verificação de Status

### No Dashboard do Render:
1. Status do serviço deve ser "Live" (verde)
2. Último deploy deve ser "Successful"
3. Logs não devem mostrar erros de conexão SMTP

### Na Aplicação:
1. Reset de password deve enviar email
2. Novos registos devem notificar admins
3. Links nos emails devem funcionar corretamente

## Notas Importantes

- As variáveis de ambiente no Render são sincronizadas automaticamente com o deploy
- Alterações nas variáveis causam redeploy automático
- Use App Passwords para maior segurança
- Não partilhe as credenciais do email
- Monitore os logs regularmente para detectar problemas

## Suporte Adicional

Se tiver problemas:
1. Verifique os logs detalhados no Render
2. Use o script `test-email.js` localmente para validar credenciais
3. Consulte o guia completo em `EMAIL_CONFIG_GUIDE.md`
4. Verifique a documentação do Render: https://render.com/docs
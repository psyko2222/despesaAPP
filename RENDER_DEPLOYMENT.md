# 🚀 Guia de Deployment para Render.com

Este guia mostra como fazer o deploy da aplicação Despesas Webapp para o Render.com.

## 📋 Pré-requisitos

- Conta no [Render.com](https://render.com)
- Repositório no GitHub com o código da aplicação
- Conta SendGrid configurada (para envio de emails)

## 🎯 Passo 1: Preparar Repositório GitHub

1. **Crie um repositório GitHub** para a aplicação
2. **Faça commit do código atual**:
   ```bash
   git add .
   git commit -m "Preparar para deploy no Render"
   git push origin main
   ```

## 📦 Passo 2: Deploy do Backend

### 2.1 Criar Web Service no Render

1. **Aceda a [render.com](https://render.com)**
2. **Faça login** com a sua conta
3. **Clique em "New +"** → "Web Service"
4. **Conecte o repositório GitHub** que criou
5. **Configure o Web Service**:

#### Configurações de Build:
- **Name**: `despesas-backend`
- **Region**: Frankfurt (ou a mais próxima)
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node src/server.js`

#### Variáveis de Ambiente:
Clique em "Advanced" → "Add Environment Variable" e adicione:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=despesas-production-secret-key-2024
DATABASE_PATH=/data/despesas.db
SENDGRID_API_KEY=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
SENDGRID_FROM_EMAIL=luislzandroid@gmail.com
CORS_ORIGIN=https://seu-frontend-url.onrender.com
FRONTEND_URL=https://seu-frontend-url.onrender.com
```

**Nota**: Substitua `seu-frontend-url.onrender.com` pela URL real do frontend após criar o serviço de frontend.

#### Persistência de Dados:
- **Disk**: `256 MB` (plano gratuito)
- **Mount Path**: `/data`

6. **Clique em "Create Web Service"**

### 2.2 Aguardar Deploy

- O Render vai fazer o build e deploy automaticamente
- Pode monitorizar o progresso na secção "Logs"
- Quando terminar, o backend estará disponível em: `https://despesas-backend.onrender.com`

## 🎨 Passo 3: Deploy do Frontend

### 3.1 Criar Web Service no Render

1. **Clique em "New +"** → "Web Service"
2. **Conecte o mesmo repositório GitHub**
3. **Configure o Web Service**:

#### Configurações de Build:
- **Name**: `despesas-frontend`
- **Region**: Frankfurt (ou a mesma do backend)
- **Branch**: `main`
- **Root Directory**: `frontend`
- **Runtime**: `Node`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

#### Variáveis de Ambiente:
```
NEXT_PUBLIC_API_URL=https://despesas-backend.onrender.com
```

**Nota**: Substitua pela URL real do backend após o deploy do backend.

4. **Clique em "Create Web Service"**

### 3.2 Aguardar Deploy

- O Render vai fazer o build e deploy automaticamente
- Quando terminar, o frontend estará disponível em: `https://despesas-frontend.onrender.com`

## 🔧 Passo 4: Atualizar Configurações

### 4.1 Atualizar Backend

1. **Volte ao serviço do backend** no Render
2. **Vá a "Environment"** → "Environment Variables"
3. **Atualize as variáveis**:
   ```
   CORS_ORIGIN=https://despesas-frontend.onrender.com
   FRONTEND_URL=https://despesas-frontend.onrender.com
   ```
4. **Clique em "Save Changes"**
5. **Clique em "Manual Deploy"** → "Clear build cache & deploy"

### 4.2 Verificar Frontend

1. **Aceda à URL do frontend**: `https://despesas-frontend.onrender.com`
2. **Verifique se a aplicação carrega corretamente**

## 🧪 Passo 5: Testar a Aplicação

### Testar Backend:
```bash
curl https://despesas-backend.onrender.com/api/health
```

Deve retornar: `{"status":"ok","timestamp":"..."}`

### Testar Frontend:
1. Aceda a: `https://despesas-frontend.onrender.com`
2. Teste o registo de novo utilizador
3. Verifique se o email é enviado para o admin
4. Teste o login e funcionalidades principais

## 📊 Monitorização

### Ver Logs:
- No dashboard do Render, clique em cada serviço
- Vá à secção "Logs" para ver os logs em tempo real

### Ver Status:
- Cada serviço mostra o status atual (Deploying, Live, etc.)
- Alertas e erros aparecem na secção "Events"

## 💰 Custos do Render

### Plano Gratuito:
- **Web Services**: 
  - 750 horas/mês (aproximadamente 1 serviço sempre online)
  - Web services grátis ficam em "sleep" após 15 minutos de inatividade
  - Levam ~30 segundos a "acordar" quando recebem uma requisição
- **Disk**: 256 MB grátis por serviço
- **Build Time**: 15 minutos/mês grátis

### Limitações do Plano Gratuito:
- O backend pode ficar em "sleep" se não houver requisições
- Quando "acorda", pode demorar alguns segundos a responder
- Base de dados SQLite em disco persiste, mas o servidor pode restart

### Plano Pago (Starter - $7/mês):
- Web services sem sleep
- Melhor performance
- Suporte prioritário

## 🔐 Segurança

- **JWT Secret**: Já configurado nas variáveis de ambiente
- **SendGrid API Key**: Já configurada nas variáveis de ambiente
- **CORS**: Configurado para permitir apenas a URL do frontend
- **Environment Variables**: Nunca são expostas no código

## 🔄 Como Fazer Atualizações

### Atualizar Backend:
1. Faça as alterações no código
2. Commit e push para GitHub:
   ```bash
   git add .
   git commit -m "Atualização do backend"
   git push origin main
   ```
3. O Render faz deploy automaticamente

### Atualizar Frontend:
1. Faça as alterações no código
2. Commit e push para GitHub:
   ```bash
   git add .
   git commit -m "Atualização do frontend"
   git push origin main
   ```
3. O Render faz deploy automaticamente

## 🎯 Resumo das URLs

Após o deploy completo:

- **Backend**: `https://despesas-backend.onrender.com`
- **Frontend**: `https://despesas-frontend.onrender.com`
- **Health Check**: `https://despesas-backend.onrender.com/api/health`

## 💡 Dicas Importantes

1. **Tempo de Cold Start**: No plano gratuito, o primeiro acesso após inatividade pode demorar ~30 segundos
2. **Logs Sempre Visíveis**: Mesmo quando o serviço está em "sleep", os logs continuam disponíveis
3. **Auto-Deploy**: Qualquer push para o branch `main` do GitHub triggera um novo deploy
4. **Rollback**: Se algo der errado, pode fazer rollback para deploy anterior no dashboard do Render

## 🆘 Solução de Problemas

### Deploy Falha:
- Verifique os logs no dashboard do Render
- Certifique-se que todas as dependências estão no package.json
- Verifique se as variáveis de ambiente estão corretas

### Frontend Não Conecta ao Backend:
- Verifique se a variável `NEXT_PUBLIC_API_URL` está correta
- Verifique se o CORS no backend está configurado para a URL do frontend
- Verifique os logs do backend para ver se há erros

### Emails Não São Enviados:
- Verifique se a API key do SendGrid está correta
- Verifique os logs do backend para erros do SendGrid
- Confirme que o email `luislzandroid@gmail.com` está verificado no SendGrid

## 🎉 Conclusão

A aplicação Despesas Webapp está agora online no Render.com com:
- ✅ Backend Node.js com SQLite
- ✅ Frontend Next.js
- ✅ Sistema de autenticação com JWT
- ✅ Sistema de aprovação de utilizadores com email
- ✅ Gestão de despesas e partilha de contas
- ✅ Auto-deploy via GitHub
- ✅ Monitorização e logs em tempo real
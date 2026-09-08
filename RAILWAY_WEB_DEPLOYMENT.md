# 🚀 Guia de Deployment Railway via Interface Web

Como o GitHub está a dar problemas, vamos fazer o deployment diretamente via interface web do Railway.

## 📋 Pré-requisitos

- Conta no [Railway](https://railway.app)
- Código local pronto para deployment

## 🎯 Passo 1: Criar Projeto no Railway

1. **Aceda a [railway.app](https://railway.app)**
2. **Faça login** ou crie conta
3. **Clique em "New Project"**
4. **Selecione "Deploy from GitHub repo"** (mesmo sem ter o código no GitHub, vamos usar este método)

## 📦 Passo 2: Fazer Upload do Código

### Opção A: Criar repositório temporário no GitHub

1. **No GitHub**, crie um repositório público temporário
2. **No Railway**, selecione esse repositório
3. **Configure o root directory como `backend`**

### Opção B: Usar Railway CLI (Recomendado)

1. **Instale Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Faça login**:
   ```bash
   railway login
   ```

3. **Crie projeto**:
   ```bash
   railway init
   ```

4. **Fazer upload do backend**:
   ```bash
   cd backend
   railway up
   ```

5. **Fazer upload do frontend**:
   ```bash
   cd ../frontend
   railway up
   ```

## 🔧 Passo 3: Configurar Serviço Backend

### Via Interface Web Railway:

1. **No projeto Railway**, crie um novo serviço
2. **Selecione "Dockerfile" ou "Nixpacks"**
3. **Configure as variáveis de ambiente**:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DATABASE_PATH=/data/despesas.db
CORS_ORIGIN=https://seu-frontend-url.railway.app
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY_HERE
SENDGRID_FROM_EMAIL=luislzandroid@gmail.com
FRONTEND_URL=https://seu-frontend-url.railway.app
```

4. **Configure volumes**:
   - Nome: `data`
   - Mount path: `/data`

## 🎨 Passo 4: Configurar Serviço Frontend

### Via Interface Web Railway:

1. **No mesmo projeto Railway**, adicione outro serviço
2. **Selecione "Dockerfile" ou "Nixpacks"**
3. **Configure as variáveis de ambiente**:

```
NEXT_PUBLIC_API_URL=https://seu-backend-url.railway.app
```

4. **Configure o build**:
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Start command: `npm start`

## 🔄 Passo 5: Deploy Automático

Depois de configurar:
- Cada mudança nos ficheiros locais requer novo upload
- Monitorize o progresso no dashboard Railway
- Logs disponíveis em cada serviço

## 🧪 Passo 6: Testar

### Testar Backend:
1. Aceda à URL do backend + `/api/health`
2. Deve ver: `{"status":"ok","timestamp":"..."}`

### Testar Frontend:
1. Aceda à URL do frontend
2. Deve ver a página de login
3. Teste o registo de novo utilizador (deve enviar email para admins)

## 💡 Solução Alternativa: Render

Se Railway continuar a dar problemas, tente [Render](https://render.com):

1. **Crie conta no Render**
2. **Crie Web Service para Backend**
3. **Crie Web Service para Frontend**
4. **Configure variáveis de ambiente**
5. **Fazer deploy via Git** (Render é mais permissivo com autenticação)

## 🎉 Conclusão

A webapp está online com:
- ✅ Sistema de aprovação de utilizadores com email
- ✅ Correção do problema de email para novos users
- ✅ Deployment persistente
- ✅ Sistema de deleção de users por admin
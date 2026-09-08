# 🚀 Guia de Deployment - Railway

Este guia explica como colocar a sua webapp Despesas online usando Railway (plataforma gratuita).

## 📋 Pré-requisitos

- Conta no [Railway](https://railway.app)
- Conta no [GitHub](https://github.com)
- Git instalado no seu computador

## 🎯 Porquê Railway?

- **Plano gratuito**: $5 crédito/mês para sempre
- **Armazenamento persistente**: SQLite fica guardado permanentemente
- **Deploy automático**: Integrado com GitHub
- **Fácil configuração**: Interface intuitiva
- **Suporte Node.js/Next.js**: Suporte nativo

## 📝 Passo 1: Preparar o Repositório GitHub

### 1.1 Criar repositório no GitHub
1. Vá a [GitHub](https://github.com) e crie um novo repositório
2. Dê um nome (ex: `despesas-webapp`)
3. Não inicialize com README

### 1.2 Fazer commit do código local
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp
git init
git add .
git commit -m "Initial commit - Despesas Webapp"
```

### 1.3 Conectar ao GitHub
```bash
git remote add origin https://github.com/SEU_USERNAME/despesas-webapp.git
git branch -M main
git push -u origin main
```

## 🚂 Passo 2: Configurar Backend no Railway

### 2.1 Criar projeto no Railway
1. Faça login em [railway.app](https://railway.app)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Escolha o repositório `despesas-webapp`

### 2.2 Configurar o serviço Backend
1. Railway vai detetar automaticamente o Node.js
2. No serviço criado, clique em "Settings"
3. Em "Root Directory", coloque: `backend`
4. Em "Build Command", coloque: `npm install`
5. Em "Start Command", coloque: `npm start`

### 2.3 Configurar variáveis de ambiente
1. No serviço Backend, vá a "Variables"
2. Adicione as seguintes variáveis:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DATABASE_PATH=/data/despesas.db
CORS_ORIGIN=https://seu-fronteend-url.railway.app
```

**Importante**: O `CORS_ORIGIN` será atualizado depois de configurar o frontend.

### 2.4 Configurar persistência de dados
1. No serviço Backend, vá a "Volumes"
2. Clique em "New Volume"
3. Nome: `data`
4. Mount path: `/data`
5. Isto garante que o SQLite fica persistente

## 🎨 Passo 3: Configurar Frontend no Railway

### 3.1 Adicionar novo serviço ao projeto
1. No mesmo projeto Railway, clique em "New Service"
2. Selecione "Deploy from GitHub repo"
3. Escolha o mesmo repositório `despesas-webapp`

### 3.2 Configurar o serviço Frontend
1. No serviço criado, clique em "Settings"
2. Em "Root Directory", coloque: `frontend`
3. Em "Build Command", coloque: `npm run build`
4. Em "Start Command", coloque: `npm start`

### 3.3 Configurar variáveis de ambiente
1. No serviço Frontend, vá a "Variables"
2. Adicione as seguintes variáveis:

```
NEXT_PUBLIC_API_URL=https://seu-backend-url.railway.app
```

**Nota**: Substitua `seu-backend-url` pela URL real do backend Railway.

### 3.4 Obter URLs dos serviços
1. No Railway, copie a URL do Backend (ex: `https://despesas-backend.up.railway.app`)
2. Copie a URL do Frontend (ex: `https://despesas-frontend.up.railway.app`)

### 3.5 Atualizar configurações
1. Volte ao serviço Backend → Variables
2. Atualize `CORS_ORIGIN` com a URL do frontend
3. Volte ao serviço Frontend → Variables
4. Atualize `NEXT_PUBLIC_API_URL` com a URL do backend

## 🔄 Passo 4: Deploy Automático

Depois de configurar:
1. Cada vez que fizer push para GitHub, Railway faz deploy automático
2. Pode monitorizar o progresso no dashboard Railway
3. Os logs estão disponíveis em cada serviço

## 🧪 Passo 5: Testar o Deployment

### 5.1 Testar Backend
1. Aceda à URL do backend + `/api/health`
2. Deve ver: `{"status":"ok","timestamp":"..."}`

### 5.2 Testar Frontend
1. Aceda à URL do frontend
2. Deve ver a página de login
3. Tente registar o primeiro utilizador (será admin automaticamente)

## 📊 Passo 6: Configurar Domínio Personalizado (Opcional)

### 6.1 Configurar domínio no Railway
1. No serviço Frontend, vá a "Settings" → "Networking"
2. Clique em "Custom Domain"
3. Adicione o seu domínio (ex: `despesas.seudominio.com`)

### 6.2 Configurar DNS
1. No seu provedor de DNS, adicione um registro CNAME:
   - Nome: `despesas`
   - Valor: `seu-frontend-url.railway.app`

## 🔧 Troubleshooting

### Backend não inicia
- Verifique as variáveis de ambiente
- Verifique os logs no Railway
- Certifique-se que o `package.json` tem o script `start`

### Frontend não conecta ao backend
- Verifique `NEXT_PUBLIC_API_URL` no frontend
- Verifique `CORS_ORIGIN` no backend
- Verifique os logs de ambos os serviços

### Erro de SQLite
- Verifique se o volume `/data` está configurado
- Verifique as permissões do ficheiro de base de dados

### Serviço fica "sleep"
- Normal no plano gratuito
- Acorda automaticamente no primeiro request
- Demora ~30 segundos a acordar

## 💰 Custos

- **Plano gratuito**: $5/mês
- **Suficiente para**: Uso pessoal/teste
- **Se precisar de mais**: Planos pagos a partir de $5/mês

## 🎉 Conclusão

A sua webapp Despesas está agora online! Com:
- ✅ Sistema de aprovação de utilizadores
- ✅ Recuperação de password
- ✅ Limpeza de registos antigos
- ✅ Deployment automático
- ✅ Armazenamento persistente

## 📞 Suporte

Se tiver problemas:
- Verifique os logs no Railway
- Consulte a [documentação Railway](https://docs.railway.app)
- Reviste este guia passo a passo

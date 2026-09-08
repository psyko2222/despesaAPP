# 🚀 Setup Rápido - Despesas Webapp

Guia passo-a-passo para configurar e executar a webapp Despesas.

## 📋 Pré-requisitos

- Node.js (v18 ou superior)
- npm ou yarn
- Git (opcional)

## ⚡ Setup em 5 Minutos

### 1. Backend

```bash
cd webapp/backend
npm install
cp .env.example .env
```

Editar `.env`:
```
PORT=3000
JWT_SECRET=your-secret-key-change-this-in-production
DATABASE_PATH=./despesas.db
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

Iniciar backend:
```bash
npm run dev
```

Backend estará em: `http://localhost:3000`

### 2. Frontend

```bash
cd webapp/frontend
npm install
cp .env.local.example .env.local
```

Editar `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Iniciar frontend:
```bash
npm run dev
```

Frontend estará em: `http://localhost:3000` (porta padrão do Next.js)

### 3. Testar

1. Abre `http://localhost:3000` no browser
2. Clica em "Registar"
3. Introduz email e password
4. Faz login
5. Começa a adicionar despesas!

## 🎯 Próximos Passos

1. **Funcionalidades principais**: Adicionar despesas, navegar por meses
2. **Estatísticas**: Implementar gráficos e comparações
3. **Definições**: Configurar notificações e preferências
4. **Backup**: Testar exportação/importação
5. **Integração Android**: Seguir guia `INTEGRATION.md`

## 🔧 Troubleshooting

### Backend não inicia
- Verifica se a porta 3000 está livre
- Verifica se o Node.js está instalado: `node --version`
- Verifica as dependências: `npm install`

### Frontend não conecta ao backend
- Verifica se o backend está a correr
- Verifica a URL em `.env.local`
- Verifica CORS no backend

### Erro de autenticação
- Limpa o localStorage do browser
- Regista novo utilizador
- Verifica o JWT_SECRET no backend

## 📱 Testar em Mobile

### Local Network
1. Encontra o teu IP local: `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
2. Substitui `localhost` pelo teu IP nos ficheiros `.env`
3. Acede do mobile: `http://TEU_IP:3000`

### iOS Safari
1. Abre Safari no iPhone/iPad
2. Acede à URL da webapp
3. Clica em "Share" → "Add to Home Screen"
4. Agora funciona como app nativa!

### Android Chrome
1. Abre Chrome no Android
2. Acede à URL da webapp
3. Clica no menu (⋮) → "Add to Home Screen"
4. Agora funciona como app nativa!

## 🚀 Deploy em Produção

### Backend (Render - Gratuito)
1. Cria conta em [render.com](https://render.com)
2. Cria "Web Service" com o código do backend
3. Configura variáveis de ambiente
4. Deploy automático!

### Frontend (Vercel - Gratuito)
1. Cria conta em [vercel.com](https://vercel.com)
2. Cria "New Project" com o código do frontend
3. Configura variáveis de ambiente
4. Deploy automático!

## 🎉 Sucesso!

A tua webapp Despesas está pronta para:
- ✅ iOS (iPhone/iPad)
- ✅ Android
- ✅ Desktop (Windows/Mac/Linux)
- ✅ Tablets
- ✅ Integração com app Android

Para mais detalhes, consulta:
- `README.md` - Visão geral
- `INTEGRATION.md` - Integração Android
- `backend/README.md` - Documentação backend
- `frontend/README.md` - Documentação frontend

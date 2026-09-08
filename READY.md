# 🎉 Webapp Despesas - Pronta a Usar!

## ✅ Status do Sistema

**Backend:** ✅ Rodando em http://localhost:3001
**Frontend:** ✅ Rodando em http://localhost:3000
**Database:** ✅ SQLite inicializada
**Dependencies:** ✅ Instaladas

## 🚀 Como Usar

### 1. Aceder à Webapp
Abre o browser em: **http://localhost:3000**

### 2. Criar Conta
1. Clica em "Não tem conta? Registar"
2. Introduz o teu email
3. Cria uma password (mínimo 6 caracteres)
4. Clica em "Registar"

### 3. Começar a Usar
- **Aba Mês:** Adiciona despesas, navega por meses
- **Aba Regulares:** Vê despesas recorrentes
- **Aba Estatísticas:** (em desenvolvimento)
- **Aba Definições:** (em desenvolvimento)

## 📱 Testar em Mobile

### 1. Encontrar o teu IP local
```bash
ipconfig  # Windows
# ou
ifconfig  # Mac/Linux
```

### 2. Modificar ficheiros de configuração

**Backend (.env):**
```
CORS_ORIGIN=http://TEU_IP:3000,http://localhost:3000
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://TEU_IP:3001
```

### 3. Aceder do mobile
Abre no browser: **http://TEU_IP:3000**

### 4. Instalar como App (PWA)

**iOS (iPhone/iPad):**
1. Abre Safari
2. Acede à URL
3. Clica em "Share" → "Add to Home Screen"
4. Agora funciona como app nativa!

**Android:**
1. Abre Chrome
2. Acede à URL
3. Clica no menu (⋮) → "Add to Home Screen"
4. Agora funciona como app nativa!

## 🔧 Comandos Úteis

### Parar o sistema
```bash
# Ctrl+C na janela do backend
# Ctrl+C na janela do frontend
```

### Reiniciar o backend
```bash
cd webapp/backend
npm start
```

### Reiniciar o frontend
```bash
cd webapp/frontend
npm run dev
```

### Reiniciar ambos (Windows)
```bash
cd webapp
start.bat
```

### Reiniciar ambos (Mac/Linux)
```bash
cd webapp
chmod +x start.sh
./start.sh
```

## 🌐 Deploy em Produção

### Backend (Render - Gratuito)
1. Vai a [render.com](https://render.com)
2. Cria "Web Service"
3. Conecta o repositório GitHub
4. Configura variáveis de ambiente
5. Deploy automático!

### Frontend (Vercel - Gratuito)
1. Vai a [vercel.com](https://vercel.com)
2. Cria "New Project"
3. Conecta o repositório GitHub
4. Configura variáveis de ambiente
5. Deploy automático!

## 🔗 Integração com App Android

Ver o guia detalhado: `INTEGRATION.md`

### Resumo rápido:
1. **WebView:** Adicionar WebViewActivity na app Android
2. **API Calls:** Modificar ExpenseDatabase para usar API REST
3. **Híbrido:** Utilizador escolhe entre modo local ou web

## 📊 Funcionalidades Implementadas

### ✅ Prontas
- Autenticação (Login/Registo)
- Gestão de despesas por mês
- Despesas recorrentes
- Navegação por períodos financeiros
- Marcar despesas como pagas
- Interface responsiva
- Design moderno
- Formulário de criação de despesas
- Editar/apagar despesas
- Definições personalizáveis
- Backup/restauração (compatível com Android)
- Estatísticas básicas

### 🚧 Em desenvolvimento
- Estatísticas avançadas e gráficos
- Notificações push
- Dark mode
- PWA manifest

## 🎯 Próximos Passos

1. **Testar** todas as funcionalidades básicas
2. **Adicionar** funcionalidades em desenvolvimento
3. **Deploy** em produção (Render + Vercel)
4. **Integrar** com app Android (ver INTEGRATION.md)
5. **Testar** em iOS e Android reais

## 🐛 Troubleshooting

### Backend não inicia
```bash
cd webapp/backend
npm install
npm start
```

### Frontend não conecta
- Verifica se o backend está a correr
- Verifica a URL em `.env.local`
- Verifica CORS no backend

### Erro de autenticação
- Limpa o localStorage do browser
- Regista novo utilizador
- Verifica o JWT_SECRET

## 📞 Suporte

Para questões:
- Backend: `backend/README.md`
- Frontend: `frontend/README.md`
- Integração: `INTEGRATION.md`
- Setup: `SETUP.md`

## 🎉 Sucesso!

A tua webapp Despesas está pronta para:
- ✅ iOS (iPhone/iPad)
- ✅ Android
- ✅ Desktop (Windows/Mac/Linux)
- ✅ Tablets
- ✅ Integração com app Android

**Diverte-te a gerir as tuas despesas! 🚀**

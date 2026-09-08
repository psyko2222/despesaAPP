# 📋 Guia Completo de Deployment e Atualizações - Railway

Este guia explica como fazer deployment inicial e atualizações futuras da webapp Despesas no Railway.

## 🚀 Deployment Inicial

### Pré-requisitos
- Conta no [Railway](https://railway.app)
- Railway CLI instalado: `npm install -g @railway/cli`
- Código local pronto

### Passo 1: Login no Railway
```bash
railway login
```
Isto abrirá o browser para autenticação.

### Passo 2: Criar Projeto
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp
railway init
```
Siga as instruções para criar um novo projeto.

### Passo 3: Deploy do Backend
```bash
cd backend
railway up
```
Isto fará upload do código backend e iniciará o deployment.

### Passo 4: Configurar Variáveis de Ambiente do Backend
No dashboard Railway:
1. Vá ao serviço Backend → Variables
2. Adicione as seguintes variáveis:

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

### Passo 5: Configurar Volume do Backend
No dashboard Railway:
1. Vá ao serviço Backend → Volumes
2. Clique em "New Volume"
3. Nome: `data`
4. Mount path: `/data`

### Passo 6: Deploy do Frontend
```bash
cd ../frontend
railway up
```

### Passo 7: Configurar Variáveis de Ambiente do Frontend
No dashboard Railway:
1. Vá ao serviço Frontend → Variables
2. Adicione:

```
NEXT_PUBLIC_API_URL=https://seu-backend-url.railway.app
```

### Passo 8: Obter URLs e Atualizar Configurações
1. Copie a URL do Backend (ex: `https://despesas-backend.up.railway.app`)
2. Copie a URL do Frontend (ex: `https://despesas-frontend.up.railway.app`)
3. Atualize `CORS_ORIGIN` no Backend com a URL do Frontend
4. Atualize `NEXT_PUBLIC_API_URL` no Frontend com a URL do Backend

## 🔄 Como Fazer Atualizações

### Método 1: Via Railway CLI (Recomendado)

#### Atualizar Backend
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp\backend
railway up
```

#### Atualizar Frontend
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp\frontend
railway up
```

#### Atualizar Ambos
```bash
cd C:\Users\luisz\Documents\escala\despesas\webapp
railway up
```

### Método 2: Via Interface Web Railway

1. **Aceda ao dashboard Railway**
2. **Selecione o serviço a atualizar** (Backend ou Frontend)
3. **Clique em "Redeploy"**
4. **Ou faça upload dos novos ficheiros manualmente**

### Método 3: Via GitHub (Automatic Deploy)

Se conseguir resolver os problemas do GitHub:

1. **Fazer commit das mudanças**:
```bash
git add .
git commit -m "Descrição das mudanças"
git push
```

2. **Railway fará deploy automático** após o push

## 📝 Checklist de Atualizações

Antes de fazer deploy, verifique:

### Backend
- [ ] Testar mudanças localmente
- [ ] Verificar se variáveis de ambiente estão corretas
- [ ] Verificar dependências no package.json
- [ ] Testar endpoints principais
- [ ] Verificar se migrações de base de dados são necessárias

### Frontend
- [ ] Testar mudanças localmente
- [ ] Verificar NEXT_PUBLIC_API_URL
- [ ] Testar build local: `npm run build`
- [ ] Verificar se novos componentes funcionam
- [ ] Testar integração com backend

## 🧪 Testes Pós-Deployment

### Testar Backend
```bash
# Health check
curl https://seu-backend-url.railway.app/api/health

# Testar auth
curl -X POST https://seu-backend-url.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Testar Frontend
1. Aceda à URL do frontend
2. Teste login/registro
3. Teste funcionalidades principais
4. Verifique console do browser para erros

## 🔧 Troubleshooting

### Backend não inicia
- Verifique logs no Railway
- Verifique variáveis de ambiente
- Verifique se volume `/data` está configurado
- Verifique dependências no package.json

### Frontend não conecta ao backend
- Verifique NEXT_PUBLIC_API_URL
- Verifique CORS_ORIGIN no backend
- Verifique se backend está online
- Verifique logs de ambos os serviços

### Erro de SQLite
- Verifique se volume `/data` está montado
- Verifique permissões do ficheiro de base de dados
- Verifique se DATABASE_PATH está correto

### Email não funciona
- Verifique SENDGRID_API_KEY
- Verifique SENDGRID_FROM_EMAIL
- Verifique logs para erros de SendGrid
- Teste endpoint de registro localmente

## 📊 Monitorização

### Via Railway Dashboard
- Aceda a cada serviço para ver logs
- Monitorize uso de recursos
- Verifique métricas de performance

### Via Logs
```bash
# Ver logs do backend
railway logs

# Ver logs em tempo real
railway logs --tail
```

## 💰 Custos e Limites

### Plano Gratuito Railway
- $5 crédito/mês
- Serviço dorme após inatividade
- Acorda automaticamente no primeiro request
- Suficiente para uso pessoal

### Plano Pago
- A partir de $5/mês
- Serviço sempre ativo
- Mais recursos
- Melhor performance

## 🎯 Boas Práticas

### 1. Testar Localmente Primeiro
Sempre teste mudanças localmente antes de fazer deploy

### 2. Variáveis de Ambiente
Nunca commit segredos (API keys, passwords)
Use .env.example como template

### 3. Backups de Base de Dados
Faça backup regular da base de dados SQLite:
```bash
# Download do volume
railway volume download data
```

### 4. Versionamento
Use git para versionamento mesmo sem GitHub
Mantenha histórico de mudanças importantes

### 5. Documentação
Documente mudanças importantes em CHANGELOG.md

## 🚨 Rollback

Se algo der errado após deployment:

### Via Railway CLI
```bash
# Ver deployments anteriores
railway deployments

# Reverter para deployment anterior
railway rollback <deployment-id>
```

### Via Interface Web
1. Aceda ao serviço no Railway
2. Vá a "Deployments"
3. Selecione deployment anterior
4. Clique "Redeploy"

## 📞 Suporte

Se tiver problemas:
- Verifique logs no Railway
- Consulte [documentação Railway](https://docs.railway.app)
- Reviste este guia passo a passo
- Teste localmente para isolar o problema

## 🎉 Conclusão

Com este guia, pode:
- ✅ Fazer deployment inicial
- ✅ Atualizar backend e frontend
- ✅ Resolver problemas comuns
- ✅ Fazer rollback se necessário
- ✅ Monitorizar a aplicação

Mantenha este ficheiro atualizado com as suas experiências específicas!
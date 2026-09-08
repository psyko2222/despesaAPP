# 🔄 Guia de Atualização do Projeto

Este guia explica como atualizar o projeto Despesas Webapp quando fizer alterações no código.

## 📋 Fluxo de Atualização

### 1. Fazer Alterações no Código

Faça as alterações necessárias no código:
- Backend: `backend/`
- Frontend: `frontend/`
- Documentação: ficheiros `.md`

### 2. Testar Localmente

Antes de fazer deploy, teste as alterações localmente:

```bash
# Testar backend
cd backend
npm start
# Teste as rotas em http://localhost:3000

# Testar frontend
cd ../frontend
npm run dev
# Teste a aplicação em http://localhost:3000
```

### 3. Commit e Push para GitHub

#### 3.1 Verificar Branch Atual
```bash
git branch
```
Deve estar no branch `main`.

#### 3.2 Verificar Alterações
```bash
git status
```
Veja quais ficheiros foram alterados.

#### 3.3 Adicionar Alterações
```bash
git add .
# Ou adicionar ficheiros específicos:
git add backend/src/server.js frontend/src/app/page.tsx
```

#### 3.4 Commit
```bash
git commit -m "Descrição da alteração"
```
Use mensagens de commit descritivas:
- "Corrigir bug no login"
- "Adicionar funcionalidade de estatísticas"
- "Atualizar versão do Next.js"

#### 3.5 Push para GitHub
```bash
git push origin main
```

**Nota**: Se tiver problemas de autenticação, use o token:
```bash
git remote set-url origin https://psyko2222:SEU_TOKEN@github.com/psyko2222/despesaAPP.git
git push origin main
git remote set-url origin https://github.com/psyko2222/despesaAPP.git
```

### 4. Deploy Automático no Render

O Render faz deploy automaticamente quando detecta mudanças no GitHub:
- O processo de build começa automaticamente
- Pode monitorizar o progresso no dashboard do Render
- O deploy pode levar 2-5 minutos

## 🎯 Cenários Específicos

### Atualizar Apenas o Backend

Se alterou apenas o backend:
```bash
git add backend/
git commit -m "Atualizar backend: descrição"
git push origin main
```
Apenas o serviço backend no Render será reconstruído.

### Atualizar Apenas o Frontend

Se alterou apenas o frontend:
```bash
git add frontend/
git commit -m "Atualizar frontend: descrição"
git push origin main
```
Apenas o serviço frontend no Render será reconstruído.

### Atualizar Variáveis de Ambiente

Se precisar de alterar variáveis de ambiente no Render:

1. **No dashboard do Render**, clique no serviço (backend ou frontend)
2. **Vá a "Environment"** → "Environment Variables"
3. **Adicione/Edite as variáveis**
4. **Clique em "Save Changes"**
5. **Clique em "Manual Deploy"** → "Clear build cache & deploy"

### Atualizar Dependências

Se adicionou novas dependências:

#### Backend:
```bash
cd backend
npm install nova-dependencia
git add package.json package-lock.json
git commit -m "Adicionar dependência X"
git push origin main
```

#### Frontend:
```bash
cd frontend
npm install nova-dependencia
git add package.json package-lock.json
git commit -m "Adicionar dependência Y"
git push origin main
```

## 🔧 Troubleshooting

### Push Falha

Se o push falhar:

#### Erro de Autenticação:
```bash
git remote set-url origin https://psyko2222:SEU_TOKEN@github.com/psyko2222/despesaAPP.git
git push origin main
git remote set-url origin https://github.com/psyko2222/despesaAPP.git
```

#### Erro de Conflitos:
```bash
git pull origin main
# Resolva conflitos manualmente
git add .
git commit -m "Resolver conflitos"
git push origin main
```

### Deploy Falha no Render

Se o deploy falhar no Render:

1. **Verifique os logs** no dashboard do Render
2. **Verifique se há erros de build**
3. **Verifique se as variáveis de ambiente estão corretas**
4. **Tente "Manual Deploy"** → "Clear build cache & deploy"

### Erro de Secret Scanning

Se o GitHub bloquear o push por secret scanning:

1. **Não faça commit de API keys ou passwords**
2. **Use variáveis de ambiente** no Render
3. **Remova segredos dos commits anteriores** se necessário

## 📊 Monitorização

### Ver Status do Deploy no Render

1. **Aceda ao dashboard do Render**
2. **Clique no serviço** (backend ou frontend)
3. **Veja o status na secção "Events"**
4. **Verifique os logs em "Logs"**

### Verificar Deploy Bem-Sucedido

#### Backend:
```bash
curl https://despesas-backend.onrender.com/api/health
```
Deve retornar: `{"status":"ok","timestamp":"..."}`

#### Frontend:
- Aceda a: `https://despesas-frontend.onrender.com`
- Verifique se a aplicação carrega corretamente

## 🚀 Boas Práticas

### 1. Branchs para Desenvolvimento

Para projetos maiores, use branchs:

```bash
# Criar branch para nova funcionalidade
git checkout -b feature/nova-funcionalidade

# Fazer alterações e commits
git add .
git commit -m "Adicionar nova funcionalidade"

# Push do branch
git push origin feature/nova-funcionalidade

# Criar Pull Request no GitHub
# Após aprovação, merge para main
```

### 2. Commits Descritivos

Use mensagens de commit claras:
- ✅ "Corrigir bug: login falha com caracteres especiais"
- ✅ "Adicionar: exportação de dados em CSV"
- ✅ "Atualizar: versão do Next.js para 14.2.5"
- ❌ "alterações"
- ❌ "fix"
- ❌ "update"

### 3. Testar Antes de Deploy

Sempre teste localmente:
- Backend: testar rotas modificadas
- Frontend: testar interface modificada
- Integração: testar comunicação entre frontend e backend

### 4. Backup Antes de Grandes Alterações

Antes de alterações grandes:
```bash
git tag -a v1.0.0 -m "Versão estável antes de grandes alterações"
git push origin v1.0.0
```

## 🔄 Fluxo Completo de Atualização

Resumo do processo completo:

```bash
# 1. Fazer alterações no código
# (edite os ficheiros necessários)

# 2. Testar localmente
cd backend
npm start
# (em outro terminal)
cd frontend
npm run dev

# 3. Commit e push
cd ..
git add .
git commit -m "Descrição da alteração"
git push origin main

# 4. Monitorizar deploy no Render
# (aceda ao dashboard do Render)

# 5. Testar em produção
curl https://despesas-backend.onrender.com/api/health
# e teste o frontend no browser
```

## 🎯 URLs Importantes

- **GitHub**: https://github.com/psyko2222/despesaAPP
- **Render Dashboard**: https://dashboard.render.com
- **Backend**: https://despesas-backend.onrender.com (após deploy)
- **Frontend**: https://despesas-frontend.onrender.com (após deploy)

## 💡 Dicas Importantes

1. **Auto-Deploy**: O Render faz deploy automaticamente após cada push
2. **Build Time**: O primeiro deploy pode levar mais tempo (~5-10 minutos)
3. **Cold Start**: No plano gratuito, o primeiro acesso após inatividade pode demorar ~30 segundos
4. **Logs Sempre Disponíveis**: Mesmo quando o serviço está em "sleep", os logs continuam disponíveis
5. **Rollback**: Se algo der errado, pode fazer rollback para deploy anterior no dashboard do Render

## 🆘 Problemas Comuns

### Deploy Trava no Build
- Verifique os logs no Render
- Tente "Clear build cache & deploy"
- Verifique se todas as dependências estão no package.json

### Frontend Não Conecta ao Backend
- Verifique se `NEXT_PUBLIC_API_URL` está correta
- Verifique se o CORS no backend permite a URL do frontend
- Verifique os logs do backend

### Alterações Não Aparecem
- Limpe o cache do browser
- Verifique se o deploy foi bem-sucedido
- Verifique se está na URL correta (produção vs localhost)

## 🎉 Conclusão

Com este guia, pode atualizar o projeto de forma segura e eficiente. O processo de atualização é simples: alterar código → testar → commit → push → deploy automático.
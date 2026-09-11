# Guia de Implementação de Notificações Firebase

## Sistema de Notificações Push Implementado

O sistema de notificações push usando Firebase Cloud Messaging (FCM) foi implementado com sucesso na aplicação DespesaAPP.

## Estrutura da Implementação

### Backend

1. **Serviço de Notificações** (`backend/src/services/notificationService.js`)
   - Integração com Firebase Admin SDK
   - Funções para enviar notificações (single, multicast, topic)
   - Validação de tokens FCM
   - Gestão de subscrições de tópicos

2. **Serviço de Lembretes** (`backend/src/services/reminderService.js`)
   - Sistema automático de lembretes de débito
   - Verificação periódica (cada minuto)
   - Envio de notificações push e email
   - Integração com as definições do utilizador

3. **Rotas de Notificações** (`backend/src/routes/notifications.js`)
   - `/api/notifications/register-token` - Registar token FCM
   - `/api/notifications/remove-token` - Remover token FCM
   - `/api/notifications/status` - Verificar estado do Firebase
   - `/api/notifications/test` - Enviar notificação de teste
   - `/api/notifications/trigger-reminder` - Disparar lembrete manualmente

### Frontend

1. **Configuração Firebase** (`frontend/src/lib/firebase-config.ts`)
   - Configuração do Firebase Web SDK
   - Registo automático do service worker
   - Funções para pedir permissões e obter token
   - Listener para mensagens em foreground

2. **Hook de Notificações** (`frontend/src/hooks/useNotifications.ts`)
   - Gestão do estado de permissões
   - Pedir permissões ao utilizador
   - Registar token no backend
   - Remover token

3. **Service Worker** (`frontend/public/firebase-messaging-sw.js`)
   - Receção de notificações em background
   - Gestão de cliques em notificações
   - Navegação para a aplicação

4. **Interface de Definições** (`frontend/src/components/SettingsScreen.tsx`)
   - UI para ativar/desativar notificações push
   - Indicador de estado das permissões
   - Botões de teste
   - Integração com definições existentes

## Configuração Necessária

### 1. Variáveis de Ambiente (Backend)

O arquivo `firebase-service-account.json` já está configurado com as credenciais do Firebase Admin SDK.

No Render, certifica-te de que:
- O arquivo `firebase-service-account.json` está incluído no deployment
- Ou configura as variáveis de ambiente necessárias

### 2. Configuração Frontend

A configuração do Firebase está em `frontend/src/lib/firebase-config.ts`:
- `apiKey`: Chave de API do Firebase
- `authDomain`: Domínio de autenticação
- `projectId`: ID do projeto
- `storageBucket`: Bucket de storage
- `messagingSenderId`: Sender ID
- `appId`: ID da aplicação web

### 3. Service Worker

O service worker `firebase-messaging-sw.js` está na pasta `public/` e será servido automaticamente pelo Next.js.

## Funcionalidades Implementadas

### 1. Notificações Push
- Pedir permissões ao utilizador
- Registar token FCM no backend
- Receber notificações em foreground e background
- Gestão de estado de permissões

### 2. Lembretes de Débito Automáticos
- Verificação automática cada minuto
- Envio de notificações push baseado nas definições do utilizador
- Fallback para email se push falhar
- Integração com o sistema de períodos financeiros

### 3. Sistema de Testes
- Notificação de teste para verificar configuração
- Teste de lembrete de débito manual
- Verificação de estado do Firebase

## Como Usar

### Para o Utilizador Final

1. **Ativar Notificações Push**
   - Vai a Definições → Notificações
   - Clica em "Ativar Notificações Push"
   - Aceita a permissão do navegador
   - O token será registado automaticamente

2. **Configurar Lembretes de Débito**
   - Em Definições → Notificações
   - Ativa "Notificações de débito"
   - Define "Dias antes do débito" (ex: 1 dia)
   - Define "Hora do lembrete" (ex: 9:00)

3. **Testar Notificações**
   - Usa os botões "Testar Notificação" e "Testar Lembrete"
   - Verifica se recebes a notificação

### Para o Desenvolvedor

1. **Verificar Backend**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Verificar Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Testar API de Notificações**
   ```bash
   # Verificar estado
   GET /api/notifications/status
   
   # Enviar notificação de teste
   POST /api/notifications/test
   
   # Disparar lembrete manualmente
   POST /api/notifications/trigger-reminder
   ```

## Deployment

### Backend (Render)

1. Certifica-te que o arquivo `firebase-service-account.json` está incluído
2. Verifica as variáveis de ambiente
3. Faz deploy do backend

### Frontend (Vercel)

1. Faz build do frontend
2. Deploy no Vercel
3. Verifica que o service worker está a ser servido corretamente

## Resolução de Problemas

### Notificações não funcionam

1. **Verificar permissões do navegador**
   - Certifica-te que o utilizador aceitou as permissões
   - Verifica as definições do navegador

2. **Verificar configuração Firebase**
   - Confirma que as credenciais estão corretas
   - Verifica o console do Firebase para erros

3. **Verificar service worker**
   - Abre DevTools → Application → Service Workers
   - Verifica se o service worker está ativo
   - Verifica a consola para erros

4. **Verificar token FCM**
   - Confirma que o token foi registado no backend
   - Verifica a tabela `users.fcm_token` na base de dados

### Lembretes não são enviados

1. **Verificar definições do utilizador**
   - Confirma que `debit_notifications_enabled = 1`
   - Verifica `debit_reminder_days`, `debit_reminder_hour`, `debit_reminder_minute`

2. **Verificar scheduler**
   - Confirma que o scheduler está a correr (ver logs do backend)
   - Verifica se há erros nos logs

3. **Testar manualmente**
   - Usa o endpoint `/api/notifications/trigger-reminder`
   - Verifica se a notificação é enviada

## Segurança

- O arquivo `firebase-service-account.json` está no `.gitignore`
- As credenciais do Firebase não são expostas no frontend
- Os tokens FCM são validados antes de serem guardados
- Apenas utilizadores autenticados podem registar tokens

## Próximos Passos Opcionais

1. **Tópicos Firebase**
   - Criar tópicos para diferentes tipos de notificações
   - Permitir subscrição a tópicos específicos

2. **Analytics**
   - Integrar Firebase Analytics para tracking de notificações
   - Medir taxas de abertura e cliques

3. **Notificações Ricas**
   - Adicionar imagens às notificações
   - Implementar ações nas notificações

4. **Grupos de Dispositivos**
   - Suportar múltiplos dispositivos por utilizador
   - Sincronizar notificações entre dispositivos

## Suporte

Para questões ou problemas:
1. Verifica os logs do backend e frontend
2. Consulta o console do Firebase
3. Revê este guia de troubleshooting
4. Verifica a documentação oficial do Firebase FCM
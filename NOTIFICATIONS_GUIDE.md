# Guia de Notificações Web Push & Lembretes Diários

O sistema de notificações da aplicação Despesas utiliza o standard oficial **Web Push (VAPID)**, eliminando a dependência do Firebase.

---

## 1. Como Funciona

1. **No Telemóvel / Computador:**
   - Aceda a **Definições > Notificações**.
   - Clique em **"Ativar Notificações"** e autorize o aviso no navegador.
   - O dispositivo fica imediatamente registado para receber alertas em segundo plano.
   - Clique em **"Enviar Notificação de Teste Agora"** para validar na hora.

2. **No iPhone / iPad (iOS):**
   - No Safari, toque em **Partilhar > Adicionar ao Ecrã Principal**.
   - Abra a app a partir do ícone criado no ecrã inicial e ative as notificações nas Definições (suportado desde o iOS 16.4).

---

## 2. Como Funciona o Despertador Automático (GitHub Actions)

O sistema de lembretes diários está configurado para correr automaticamente através do **GitHub Actions** (ficheiro `.github/workflows/daily-reminders.yml`):

1. **Agendamento Automático:**
   - Corre todos os dias às **10:00** (hora de Lisboa).
   - O GitHub chama o endpoint seguro `https://despesaapp.onrender.com/api/reminders/check`.
   - **Sem limite de 30 segundos:** O GitHub Actions aguarda pacientemente até 3 minutos pelo arranque a frio do Render.

2. **Como Executar um Teste Manual no GitHub:**
   - No GitHub, aceda ao separador **Actions**.
   - Na barra lateral esquerda, clique em **"Disparar Lembretes Diários"**.
   - Clique no botão **"Run workflow"** e confirme em **"Run workflow"**.
   - Poderá acompanhar em direto a execução e o relatório de lembretes enviados!

3. **Configuração de Segredo (Opcional):**
   - Caso tenha definido uma `CRON_SECRET` personalizada no Render, adicione-a também no GitHub:
     - No seu repositório no GitHub: **Settings > Secrets and variables > Actions > New repository secret**.
     - Nome: `CRON_SECRET`
     - Valor: O mesmo valor configurado no Render.

---

## 3. Variáveis de Ambiente no Render

| Variável | Valor Padrão / Recomendado |
| :--- | :--- |
| `VAPID_PUBLIC_KEY` | `BHw5zSZANmAYkq15Zk6iUvaSsTf5mH5_Hd60JfTwm7S9QZ2LTUnaYN1jRpkmT7btJUAYsNtHbKUlTiBNG7nf0WA` |
| `VAPID_PRIVATE_KEY` | `O3wzjwQ82bBvojgD-IAGExTUZHLvSgERtP1Kq_mJtdU` |
| `VAPID_SUBJECT` | `mailto:admin@despesas.app` |
| `CRON_SECRET` | Qualquer palavra-passe forte (ex: `despesas-cron-2026-secret`) |
| `FRONTEND_URL` | `https://despesa-app.vercel.app` |


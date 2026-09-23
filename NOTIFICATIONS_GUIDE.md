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

## 2. Como Configurar o "Despertador Externo" (Gratuito)

Para garantir que o backend no Render acorda todas as manhãs às **10:00** e envia os lembretes para o seu telemóvel e email:

1. Crie uma conta gratuita em [cron-job.org](https://cron-job.org).
2. Clique em **"Create cronjob"**:
   - **Title:** `Despesas Lembretes Diários`
   - **URL:** `https://SUA-URL-BACKEND.onrender.com/api/reminders/check` (substitua pela sua URL real do Render, ex: `https://despesaapp.onrender.com/api/reminders/check`)
   - **Execution schedule:** Diariamente às `10:00` (fuso horário: `Europe/Lisbon`).
   - **Request Method:** `POST` (ou `GET`)
   - **Headers:**
     - Key: `Authorization`
     - Value: `Bearer SUA_CHAVE_CRON_SECRET` (o valor definido na variável `CRON_SECRET` no Render)
     *(Em alternativa, pode colocar na própria URL: `https://.../api/reminders/check?secret=SUA_CHAVE_CRON_SECRET`)*
3. Na secção **"Advanced" (Definições Avançadas)** do cronjob:
   - **Request timeout:** altere para `60 s` (ou `120 s`).
   - **Failure retry:** ative com `1 retry` após `60 s`.
   *(Isto é fundamental no plano gratuito do Render, porque quando o servidor está "a dormir" demora ~40-50 segundos a arrancar. A 1ª tentativa acorda o servidor e a 2ª executa com sucesso total).*
4. Guarde o cronjob.

Todos os dias às 10:00:
- O cronjob chama o link.
- O Render acorda automaticamente.
- O sistema verifica quais as despesas a vencer de acordo com os dias configurados nas definições.
- Envia notificação Web Push aos dispositivos registados.

---

## 3. Variáveis de Ambiente no Render

| Variável | Valor Padrão / Recomendado |
| :--- | :--- |
| `VAPID_PUBLIC_KEY` | `BHw5zSZANmAYkq15Zk6iUvaSsTf5mH5_Hd60JfTwm7S9QZ2LTUnaYN1jRpkmT7btJUAYsNtHbKUlTiBNG7nf0WA` |
| `VAPID_PRIVATE_KEY` | `O3wzjwQ82bBvojgD-IAGExTUZHLvSgERtP1Kq_mJtdU` |
| `VAPID_SUBJECT` | `mailto:admin@despesas.app` |
| `CRON_SECRET` | Qualquer palavra-passe forte (ex: `despesas-cron-2026-secret`) |
| `FRONTEND_URL` | `https://despesa-app.vercel.app` |


const webpush = require('web-push');

// Chaves padrão caso não definidas nas variáveis de ambiente
const DEFAULT_VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BHw5zSZANmAYkq15Zk6iUvaSsTf5mH5_Hd60JfTwm7S9QZ2LTUnaYN1jRpkmT7btJUAYsNtHbKUlTiBNG7nf0WA';
const DEFAULT_VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'O3wzjwQ82bBvojgD-IAGExTUZHLvSgERtP1Kq_mJtdU';
const DEFAULT_VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@despesas.app';

let isConfigured = false;

try {
  webpush.setVapidDetails(
    DEFAULT_VAPID_SUBJECT,
    DEFAULT_VAPID_PUBLIC_KEY,
    DEFAULT_VAPID_PRIVATE_KEY
  );
  isConfigured = true;
  console.log('Web Push (VAPID) configured successfully');
} catch (error) {
  console.error('Failed to configure Web Push:', error.message);
}

function getPublicKey() {
  return DEFAULT_VAPID_PUBLIC_KEY;
}

/**
 * Envia uma notificação Web Push para uma subscrição específica.
 * @param {Object} subscription - Objeto com endpoint e chaves (p256dh, auth)
 * @param {Object} payload - Objeto com { title, body, icon, url, data }
 */
async function sendPushNotification(subscription, payload = {}) {
  if (!isConfigured) {
    console.warn('Web Push not configured');
    return { success: false, error: 'Web Push not configured' };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  };

  const notificationPayload = JSON.stringify({
    title: payload.title || 'Despesas',
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    url: payload.url || '/',
    data: payload.data || {}
  });

  try {
    const result = await webpush.sendNotification(pushSubscription, notificationPayload);
    return { success: true, statusCode: result.statusCode };
  } catch (error) {
    console.error(`Web Push send error for ${subscription.endpoint?.slice(0, 30)}...:`, error.message);
    
    // Status 404 (Not Found) ou 410 (Gone) significa que a subscrição expirou ou o utilizador revogou a permissão no browser
    const isExpired = error.statusCode === 404 || error.statusCode === 410;

    return {
      success: false,
      isExpired,
      statusCode: error.statusCode,
      error: error.message
    };
  }
}

module.exports = {
  isConfigured: () => isConfigured,
  getPublicKey,
  sendPushNotification
};

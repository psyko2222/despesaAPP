import { useState, useEffect } from 'react';
import { pushAPI } from '@/lib/api';

// Converte a chave VAPID base64url num Uint8Array exigido pela API PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSupportAndSubscription();
  }, []);

  const checkSupportAndSubscription = async () => {
    setLoading(true);
    try {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsSupported(supported);

      if (!supported) {
        setLoading(false);
        return;
      }

      setPermission(Notification.permission);

      // Espera pelo Service Worker estar pronto
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setIsSubscribed(Boolean(subscription));
    } catch (err: any) {
      console.error('Erro ao verificar suporte a notificações:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Notificações não são suportadas neste navegador.');
      return false;
    }

    setActionLoading(true);
    setError(null);

    try {
      // 1. Pedir permissão ao utilizador no browser
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setError('Permissão de notificações não foi concedida.');
        return false;
      }

      // 2. Obter a chave pública VAPID do backend
      const { data } = await pushAPI.getPublicKey();
      if (!data?.publicKey) {
        throw new Error('Chave pública de notificações não encontrada no servidor');
      }

      // 3. Subscrever no Service Worker
      const registration = await navigator.serviceWorker.ready;
      
      // Se já existia uma subscrição antiga, desregista primeiro para garantir
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Falha ao gerar chaves de subscrição no browser');
      }

      // 4. Enviar a subscrição para o backend
      await pushAPI.subscribe({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      console.error('Erro ao ativar notificações:', err);
      setError(err.message || 'Erro ao ativar notificações');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    setActionLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await pushAPI.unsubscribe(subscription.endpoint);
      }

      setIsSubscribed(false);
      return true;
    } catch (err: any) {
      console.error('Erro ao desativar notificações:', err);
      setError(err.message || 'Erro ao desativar notificações');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const sendTestNotification = async (): Promise<boolean> => {
    setActionLoading(true);
    setError(null);

    try {
      await pushAPI.test();
      return true;
    } catch (err: any) {
      console.error('Erro ao enviar notificação de teste:', err);
      setError(err.response?.data?.error || 'Erro ao enviar notificação de teste');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    actionLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refreshStatus: checkSupportAndSubscription,
  };
}


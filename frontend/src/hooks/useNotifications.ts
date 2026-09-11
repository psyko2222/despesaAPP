import { useState, useEffect } from 'react';
import { requestNotificationPermission, onMessageListener, areNotificationsSupported } from '@/lib/firebase-config';
import { notificationsAPI } from '@/lib/api';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    setSupported(areNotificationsSupported());

    // Get current permission status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }

    // Load saved token from localStorage
    const savedToken = localStorage.getItem('fcm_token');
    if (savedToken) {
      setToken(savedToken);
    }

    // Set up message listener
    const unsubscribe = onMessageListener();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const requestPermission = async () => {
    if (!supported) {
      setError('Notifications not supported in this browser');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const fcmToken = await requestNotificationPermission();
      
      if (fcmToken) {
        setToken(fcmToken);
        setPermission('granted');
        localStorage.setItem('fcm_token', fcmToken);
        
        // Register token with backend
        await notificationsAPI.registerToken(fcmToken);
        
        return true;
      } else {
        setPermission('denied');
        setError('Permission denied');
        return false;
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      setError('Failed to request permission');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeToken = async () => {
    try {
      await notificationsAPI.removeToken();
      setToken(null);
      localStorage.removeItem('fcm_token');
      return true;
    } catch (err) {
      console.error('Error removing token:', err);
      setError('Failed to remove token');
      return false;
    }
  };

  return {
    permission,
    token,
    supported,
    loading,
    error,
    requestPermission,
    removeToken
  };
}
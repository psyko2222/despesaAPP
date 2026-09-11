import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, Messaging, getToken, onMessage } from 'firebase/messaging';

// Register service worker for Firebase messaging
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Firebase messaging service worker registered:', registration);
    })
    .catch((error) => {
      console.error('Firebase messaging service worker registration failed:', error);
    });
}

const firebaseConfig = {
  apiKey: "AIzaSyBNAkheigBUQV0P18VO-uvw_fiASFNDufPBzpLiErC3xsPpiIBthkF1ooP2da25tBQHs37KLNU2APtQfGHoeYlPg",
  authDomain: "despesas-app-a2375.firebaseapp.com",
  projectId: "despesas-app-a2375",
  storageBucket: "despesas-app-a2375.appspot.com",
  messagingSenderId: "106487684306",
  appId: "1:106487684306:web:1a2b3c4d5e6f7g8h"
};

// Initialize Firebase
let app: FirebaseApp;
let messaging: Messaging;

if (typeof window !== 'undefined' && !getApps().length) {
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
}

export { app, messaging };

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    if (!messaging) {
      console.error('Firebase messaging is not initialized');
      return null;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted');
      
      const token = await getToken(messaging, {
        vapidKey: 'BNAkheigBUQV0P18VO-uvw_fiASFNDufPBzpLiErC3xsPpiIBthkF1ooP2da25tBQHs37KLNU2APtQfGHoeYlPg'
      });
      
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
};

// Listen for incoming messages
export const onMessageListener = () => {
  if (!messaging) {
    console.error('Firebase messaging is not initialized');
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    
    // Show notification when app is in foreground
    if (payload.notification) {
      const { title, body, icon } = payload.notification;
      
      if (Notification.permission === 'granted') {
        new Notification(title || 'Nova Notificação', {
          body: body || '',
          icon: icon || '/icon-192.png'
        });
      }
    }
  });
};

// Check if notifications are supported
export const areNotificationsSupported = (): boolean => {
  return typeof window !== 'undefined' && 
         'Notification' in window && 
         'serviceWorker' in navigator && 
         'PushManager' in window;
};
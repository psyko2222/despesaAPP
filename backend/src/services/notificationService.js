const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
let db = null;
let messaging = null;

function initializeFirebase() {
  try {
    let serviceAccount;
    
    // Try to load from environment variable first (Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('Firebase credentials loaded from environment variable');
      } catch (parseError) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError.message);
        return false;
      }
    } else {
      // Fallback to file (local development)
      try {
        const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
        serviceAccount = require(serviceAccountPath);
        console.log('Firebase credentials loaded from file');
      } catch (fileError) {
        console.error('Firebase service account file not found:', fileError.message);
        console.log('Push notifications will not be available');
        return false;
      }
    }
    
    const firebaseConfig = {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    };
    
    admin.initializeApp(firebaseConfig);
    
    db = admin.firestore();
    messaging = admin.messaging();
    
    console.log('Firebase Admin initialized successfully');
    console.log('Project ID:', serviceAccount.project_id);
    
    return true;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error.message);
    console.log('Push notifications will not be available');
    return false;
  }
}

// Initialize on module load
const isFirebaseInitialized = initializeFirebase();

function isConfigured() {
  return isFirebaseInitialized && messaging !== null;
}

// Send push notification to a specific device
async function sendPushNotification(token, { title, body, data = {} }) {
  if (!isConfigured()) {
    console.log('Push notification not sent: Firebase not configured');
    return { success: false, message: 'Firebase not configured' };
  }

  try {
    const message = {
      notification: {
        title,
        body
      },
      data,
      token
    };

    const response = await messaging.send(message);
    console.log('Push notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Push notification error:', error.message);
    
    // If token is invalid, return specific error
    if (error.code === 'messaging/registration-token-not-registered') {
      return { success: false, message: 'Invalid token', code: 'INVALID_TOKEN' };
    }
    
    return { success: false, message: error.message };
  }
}

// Send push notification to multiple devices
async function sendMulticastNotification(tokens, { title, body, data = {} }) {
  if (!isConfigured()) {
    console.log('Multicast notification not sent: Firebase not configured');
    return { success: false, message: 'Firebase not configured' };
  }

  try {
    const message = {
      notification: {
        title,
        body
      },
      data,
      tokens
    };

    const response = await messaging.sendMulticast(message);
    
    console.log('Multicast notification sent:', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });
    
    // Extract invalid tokens for cleanup
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[idx]);
      }
    });
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens
    };
  } catch (error) {
    console.error('Multicast notification error:', error.message);
    return { success: false, message: error.message };
  }
}

// Send notification to a topic
async function sendTopicNotification(topic, { title, body, data = {} }) {
  if (!isConfigured()) {
    console.log('Topic notification not sent: Firebase not configured');
    return { success: false, message: 'Firebase not configured' };
  }

  try {
    const message = {
      notification: {
        title,
        body
      },
      data,
      topic
    };

    const response = await messaging.send(message);
    console.log('Topic notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Topic notification error:', error.message);
    return { success: false, message: error.message };
  }
}

// Subscribe device to topic
async function subscribeToTopic(token, topic) {
  if (!isConfigured()) {
    console.log('Topic subscription failed: Firebase not configured');
    return { success: false, message: 'Firebase not configured' };
  }

  try {
    const response = await messaging.subscribeToTopic(token, topic);
    console.log('Subscribed to topic:', topic, response.successCount);
    return { success: true, successCount: response.successCount };
  } catch (error) {
    console.error('Topic subscription error:', error.message);
    return { success: false, message: error.message };
  }
}

// Unsubscribe device from topic
async function unsubscribeFromTopic(token, topic) {
  if (!isConfigured()) {
    console.log('Topic unsubscription failed: Firebase not configured');
    return { success: false, message: 'Firebase not configured' };
  }

  try {
    const response = await messaging.unsubscribeFromTopic(token, topic);
    console.log('Unsubscribed from topic:', topic, response.successCount);
    return { success: true, successCount: response.successCount };
  } catch (error) {
    console.error('Topic unsubscription error:', error.message);
    return { success: false, message: error.message };
  }
}

// Validate FCM token
async function validateToken(token) {
  if (!isConfigured()) {
    return false;
  }

  try {
    // Send a test message to validate the token
    const message = {
      data: { test: 'validation' },
      token
    };

    await messaging.send(message);
    return true;
  } catch (error) {
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('Token is invalid:', token);
      return false;
    }
    console.error('Token validation error:', error.message);
    return false;
  }
}

module.exports = {
  isConfigured,
  sendPushNotification,
  sendMulticastNotification,
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  validateToken
};
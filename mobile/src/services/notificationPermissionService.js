import { Platform, Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationPermissionService {
  constructor() {
    this.permissionStatus = null;
    this.setupNotificationHandlers();
  }

  // Setup notification handlers
  setupNotificationHandlers() {
    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  // Request notification permission
  async requestPermission() {
    try {
      console.log('🔔 Requesting notification permission...');
      
      // Check if permission is already granted
      const currentStatus = await this.getPermissionStatus();
      if (currentStatus === 'granted') {
        console.log('✅ Notification permission already granted');
        return { granted: true, status: 'granted' };
      }

      // Request permission
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });

      this.permissionStatus = status;
      await this.savePermissionStatus(status);

      console.log(`🔔 Notification permission status: ${status}`);

      if (status === 'granted') {
        console.log('✅ Notification permission granted');
        return { granted: true, status };
      } else {
        console.log('❌ Notification permission denied');
        return { granted: false, status };
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return { granted: false, status: 'error', error: error.message };
    }
  }

  // Get current permission status
  async getPermissionStatus() {
    try {
      if (this.permissionStatus) {
        return this.permissionStatus;
      }

      const { status } = await Notifications.getPermissionsAsync();
      this.permissionStatus = status;
      await this.savePermissionStatus(status);
      
      return status;
    } catch (error) {
      console.error('❌ Error getting notification permission status:', error);
      return 'unknown';
    }
  }

  // Save permission status to storage
  async savePermissionStatus(status) {
    try {
      await AsyncStorage.setItem('notification_permission_status', status);
    } catch (error) {
      console.error('❌ Error saving permission status:', error);
    }
  }

  // Load permission status from storage
  async loadPermissionStatus() {
    try {
      const status = await AsyncStorage.getItem('notification_permission_status');
      if (status) {
        this.permissionStatus = status;
      }
      return status;
    } catch (error) {
      console.error('❌ Error loading permission status:', error);
      return null;
    }
  }

  // Check if permission is granted
  async isPermissionGranted() {
    const status = await this.getPermissionStatus();
    return status === 'granted';
  }

  // Show permission request dialog with explanation
  async showPermissionDialog() {
    return new Promise((resolve) => {
      Alert.alert(
        '🔔 Notification Permission Required',
        'This app needs notification permission to show WhatsApp connection status alerts and important updates. Please allow notifications to get the best experience.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve({ granted: false, status: 'denied' }),
          },
          {
            text: 'Allow Notifications',
            onPress: async () => {
              const result = await this.requestPermission();
              resolve(result);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  // Show settings dialog if permission is denied
  async showSettingsDialog() {
    return new Promise((resolve) => {
      Alert.alert(
        '🔔 Notifications Disabled',
        'Notifications are currently disabled. To receive WhatsApp status alerts, please enable notifications in your device settings.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Open Settings',
            onPress: async () => {
              await this.openAppSettings();
              resolve(true);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  // Open app settings
  async openAppSettings() {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('❌ Error opening app settings:', error);
    }
  }

  // Send a test notification
  async sendTestNotification() {
    try {
      const hasPermission = await this.isPermissionGranted();
      if (!hasPermission) {
        throw new Error('Notification permission not granted');
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 WhatsApp Status Test',
          body: 'This is a test notification to verify that notifications are working properly.',
          data: { type: 'test' },
        },
        trigger: null, // Send immediately
      });

      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return false;
    }
  }

  // Send WhatsApp status notification
  async sendWhatsAppStatusNotification(title, message, status) {
    try {
      const hasPermission = await this.isPermissionGranted();
      if (!hasPermission) {
        console.log('⚠️ Cannot send notification: permission not granted');
        return false;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data: { 
            type: 'whatsapp_status',
            status,
            timestamp: new Date().toISOString()
          },
        },
        trigger: null, // Send immediately
      });

      console.log('✅ WhatsApp status notification sent');
      return true;
    } catch (error) {
      console.error('❌ Error sending WhatsApp status notification:', error);
      return false;
    }
  }

  // Send connection status change notification
  async sendConnectionStatusNotification(previousStatus, newStatus, sessionId = 'default') {
    try {
      console.log(`🔔 Attempting to send notification: ${previousStatus} → ${newStatus} for session ${sessionId}`);
      
      const hasPermission = await this.isPermissionGranted();
      console.log(`🔔 Permission status: ${hasPermission}`);
      
      if (!hasPermission) {
        console.log('⚠️ Cannot send notification: permission not granted');
        return false;
      }

      // Only send notification if status actually changed
      if (previousStatus === newStatus) {
        console.log(`🔔 Status unchanged (${previousStatus}), skipping notification`);
        return true;
      }

      let title, body;
      
      // Determine notification based on status change
      if (newStatus === 'connected' && previousStatus !== 'connected') {
        title = '✅ WhatsApp Connected';
        body = `Session ${sessionId} is now connected and ready`;
      } else if (newStatus === 'disconnected' && previousStatus === 'connected') {
        title = '❌ WhatsApp Disconnected';
        body = `Session ${sessionId} has been disconnected`;
      } else if (newStatus === 'reconnecting' && previousStatus === 'connected') {
        title = '🔄 WhatsApp Reconnecting';
        body = `Session ${sessionId} lost connection, attempting to reconnect...`;
      } else if (newStatus === 'failed' && previousStatus !== 'failed') {
        title = '⚠️ WhatsApp Connection Failed';
        body = `Session ${sessionId} failed to connect. Please check your connection.`;
      } else if (newStatus === 'connecting' && previousStatus !== 'connecting') {
        title = '🔄 WhatsApp Connecting';
        body = `Session ${sessionId} is establishing connection...`;
      } else {
        // For other status changes, send a general notification
        title = '📱 WhatsApp Status Changed';
        body = `Session ${sessionId}: ${previousStatus} → ${newStatus}`;
      }

      console.log(`🔔 Sending notification: "${title}" - "${body}"`);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'whatsapp_status_change',
            sessionId,
            previousStatus,
            newStatus,
            timestamp: new Date().toISOString()
          },
        },
        trigger: null, // Send immediately
      });

      console.log(`🔔 Connection status change notification sent successfully! ID: ${notificationId}`);
      console.log(`🔔 Notification: ${previousStatus} → ${newStatus} for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending connection status change notification:', error);
      console.error('❌ Error details:', error.message, error.stack);
      return false;
    }
  }

  // Test notification function for debugging
  async sendTestStatusNotification() {
    try {
      console.log('🔔 Sending test status notification...');
      
      const hasPermission = await this.isPermissionGranted();
      console.log(`🔔 Permission status for test: ${hasPermission}`);
      
      if (!hasPermission) {
        console.log('⚠️ Cannot send test notification: permission not granted');
        return false;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Test Status Notification',
          body: 'This is a test notification to verify status notifications are working',
          data: {
            type: 'test_status_notification',
            timestamp: new Date().toISOString()
          },
        },
        trigger: null, // Send immediately
      });

      console.log(`🔔 Test status notification sent successfully! ID: ${notificationId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending test status notification:', error);
      return false;
    }
  }

  // Initialize permission service
  async initialize() {
    try {
      await this.loadPermissionStatus();
      console.log('🔔 Notification permission service initialized');
    } catch (error) {
      console.error('❌ Error initializing notification permission service:', error);
    }
  }
}

// Export singleton instance
export default new NotificationPermissionService();

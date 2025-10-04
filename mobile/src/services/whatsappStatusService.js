import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import notificationPermissionService from './notificationPermissionService';

class WhatsAppStatusService {
  constructor() {
    this.statusListeners = new Map();
    this.eventSource = null;
    this.isMonitoring = false;
    this.currentUserId = null;
    this.statusCache = new Map();
  }

  // Start monitoring WhatsApp status for a user
  async startMonitoring(userId) {
    if (this.isMonitoring && this.currentUserId === userId) {
      return; // Already monitoring this user
    }

    this.stopMonitoring(); // Stop any existing monitoring
    this.currentUserId = userId;
    this.isMonitoring = true;

    try {
      // Set up Server-Sent Events connection
      const baseUrl = await this.getBaseUrl();
      const eventSourceUrl = `${baseUrl}/api/whatsapp/status-stream/${userId}`;
      
      this.eventSource = new EventSource(eventSourceUrl);
      
      this.eventSource.onopen = () => {
        console.log('📡 WhatsApp status stream connected');
        this.notifyListeners('connection_status', { status: 'connected' });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleStatusUpdate(data);
        } catch (error) {
          console.error('Error parsing status update:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('📡 WhatsApp status stream error:', error);
        this.notifyListeners('connection_status', { status: 'error', error });
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.isMonitoring) {
            this.startMonitoring(userId);
          }
        }, 5000);
      };

    } catch (error) {
      console.error('Error starting WhatsApp status monitoring:', error);
      this.notifyListeners('connection_status', { status: 'error', error });
    }
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isMonitoring = false;
    this.currentUserId = null;
    console.log('📡 WhatsApp status monitoring stopped');
  }

  // Handle status updates from server
  handleStatusUpdate(data) {
    const { type, userId, sessionId, status, timestamp } = data;
    
    if (type === 'status_change') {
      // Update cache
      const key = sessionId ? `${userId}_${sessionId}` : userId;
      this.statusCache.set(key, {
        status,
        timestamp,
        sessionId
      });

      // Notify listeners
      this.notifyListeners('status_change', {
        userId,
        sessionId,
        status,
        timestamp
      });

      // Show notification for status changes
      this.showStatusNotification(userId, sessionId, status);
    }
  }

  // Show notification for status changes
  async showStatusNotification(userId, sessionId, status) {
    const sessionName = sessionId === 'default' ? 'Default Session' : `Session ${sessionId}`;
    
    let title, message, type;
    
    switch (status) {
      case 'connected':
        title = '✅ WhatsApp Connected';
        message = `${sessionName} is now connected`;
        type = 'success';
        break;
      case 'disconnected':
        title = '❌ WhatsApp Disconnected';
        message = `${sessionName} has disconnected`;
        type = 'error';
        break;
      case 'reconnecting':
        title = '🔄 WhatsApp Reconnecting';
        message = `${sessionName} is reconnecting...`;
        type = 'warning';
        break;
      case 'failed':
        title = '⚠️ WhatsApp Connection Failed';
        message = `${sessionName} connection failed`;
        type = 'error';
        break;
      default:
        return;
    }

    // Send push notification
    await notificationPermissionService.sendWhatsAppStatusNotification(title, message, status);

    // Notify listeners about the notification
    this.notifyListeners('notification', {
      title,
      message,
      type,
      userId,
      sessionId,
      status
    });
  }

  // Add status listener
  addStatusListener(key, callback) {
    if (!this.statusListeners.has(key)) {
      this.statusListeners.set(key, []);
    }
    this.statusListeners.get(key).push(callback);
  }

  // Remove status listener
  removeStatusListener(key, callback) {
    const listeners = this.statusListeners.get(key);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Notify all listeners
  notifyListeners(eventType, data) {
    this.statusListeners.forEach((listeners, key) => {
      listeners.forEach(callback => {
        try {
          callback(eventType, data);
        } catch (error) {
          console.error('Error in status listener:', error);
        }
      });
    });
  }

  // Get current status for a session
  getCurrentStatus(userId, sessionId = null) {
    const key = sessionId ? `${userId}_${sessionId}` : userId;
    return this.statusCache.get(key);
  }

  // Get all statuses for a user
  getAllStatuses(userId) {
    const statuses = {};
    for (const [key, status] of this.statusCache) {
      if (key.startsWith(`${userId}_`)) {
        const sessionId = key.split('_')[1];
        statuses[sessionId] = status;
      }
    }
    return statuses;
  }

  // Get base URL from storage or use default
  async getBaseUrl() {
    try {
      const storedUrl = await AsyncStorage.getItem('api_base_url');
      return storedUrl || 'https://whatsapp-automation-app-production.up.railway.app';
    } catch (error) {
      console.error('Error getting base URL:', error);
      return 'https://whatsapp-automation-app-production.up.railway.app';
    }
  }

  // Manual status check
  async checkStatus(userId, sessionId = null) {
    try {
      const baseUrl = await this.getBaseUrl();
      const url = sessionId 
        ? `${baseUrl}/api/whatsapp/status/${userId}?sessionId=${sessionId}`
        : `${baseUrl}/api/whatsapp/status/${userId}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to get status');
      }
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new WhatsAppStatusService();

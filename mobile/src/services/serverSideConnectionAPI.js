import { resolveApiBaseUrl } from './apiBase';

/**
 * Server-Side Connection API
 * 
 * This API is designed for the new architecture where:
 * - App only initiates connections and checks status
 * - Server maintains connections independently
 * - Server sends status updates every 30 seconds
 */

class ServerSideConnectionAPI {
  constructor() {
    this.baseUrl = null;
    this.statusListeners = new Map();
    this.eventSource = null;
  }

  // Get base URL
  async getBaseUrl() {
    if (!this.baseUrl) {
      this.baseUrl = await resolveApiBaseUrl();
    }
    return this.baseUrl;
  }

  // Initiate a WhatsApp connection (server will maintain it)
  async initiateConnection(userId, sessionId = 'default') {
    try {
      const baseUrl = await this.getBaseUrl();
      const endpoint = `${baseUrl}/api/whatsapp/initiate/${userId}/${sessionId}`;
      
      console.log('🚀 Initiating server-side connection:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🚀 Initiate connection result:', result);
      
      return {
        success: result.success,
        message: result.message,
        status: result.status,
        userId: result.userId,
        sessionId: result.sessionId
      };
    } catch (error) {
      console.error('Error initiating server-side connection:', error);
      throw error;
    }
  }

  // Get current status of all connections
  async getStatusAll(userId) {
    try {
      const baseUrl = await this.getBaseUrl();
      const endpoint = `${baseUrl}/api/whatsapp/status-all/${userId}`;
      
      console.log('📊 Getting status for all connections:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Status result:', result);
      
      return result;
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  }

  // Start listening to real-time status updates
  async startStatusStream(userId, onStatusUpdate) {
    try {
      const baseUrl = await this.getBaseUrl();
      const endpoint = `${baseUrl}/api/whatsapp/status-stream/${userId}`;
      
      console.log('📡 Starting status stream:', endpoint);
      
      // Close existing stream if any
      if (this.eventSource) {
        this.eventSource.close();
      }
      
      // Check if EventSource is available (web environment)
      if (typeof EventSource !== 'undefined') {
        console.log('📡 Using EventSource for web');
        this.eventSource = new EventSource(endpoint);
        
        this.eventSource.onopen = () => {
          console.log('📡 Status stream connected');
          onStatusUpdate && onStatusUpdate({
            type: 'connection_status',
            status: 'connected',
            timestamp: new Date().toISOString()
          });
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📡 Received status update:', data);
            onStatusUpdate && onStatusUpdate(data);
          } catch (error) {
            console.error('Error parsing status update:', error);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('📡 Status stream error:', error);
          onStatusUpdate && onStatusUpdate({
            type: 'connection_status',
            status: 'error',
            error: error,
            timestamp: new Date().toISOString()
          });
          
          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
              console.log('📡 Attempting to reconnect status stream...');
              this.startStatusStream(userId, onStatusUpdate);
            }
          }, 5000);
        };
      } else {
        // React Native environment - use polling
        console.log('📡 Using polling for React Native');
        this.startPolling(userId, onStatusUpdate);
      }

      return this.eventSource || { close: () => this.stopPolling() };
    } catch (error) {
      console.error('Error starting status stream:', error);
      throw error;
    }
  }

  // Polling implementation for React Native
  startPolling(userId, onStatusUpdate) {
    // Clear existing polling if any
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    console.log('📡 Starting status polling for React Native');
    
    // Send initial connection status
    onStatusUpdate && onStatusUpdate({
      type: 'connection_status',
      status: 'connected',
      timestamp: new Date().toISOString()
    });
    
    // Start polling every 5 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        const status = await this.getStatusAll(userId);
        if (status.success && status.sessions) {
          onStatusUpdate && onStatusUpdate({
            type: 'status',
            status: status,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('📡 Status polling error:', error);
        onStatusUpdate && onStatusUpdate({
          type: 'connection_status',
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, 5000); // Poll every 5 seconds
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      console.log('📡 Stopping status polling');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Stop listening to status updates
  stopStatusStream() {
    if (this.eventSource) {
      console.log('📡 Stopping status stream');
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Also stop polling if it's running
    this.stopPolling();
  }

  // Disconnect a specific session (server will handle cleanup)
  async disconnectSession(userId, sessionId = 'default') {
    try {
      const baseUrl = await this.getBaseUrl();
      const endpoint = `${baseUrl}/api/whatsapp/disconnect/${userId}/${sessionId}`;
      
      console.log('🔌 Disconnecting session:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🔌 Disconnect result:', result);
      
      return result;
    } catch (error) {
      console.error('Error disconnecting session:', error);
      throw error;
    }
  }

  // Check if status stream is active
  isStatusStreamActive() {
    if (this.eventSource) {
      return this.eventSource.readyState === EventSource.OPEN;
    }
    return this.pollingInterval !== null;
  }

  // Get status stream state
  getStatusStreamState() {
    if (this.eventSource) {
      switch (this.eventSource.readyState) {
        case EventSource.CONNECTING:
          return 'connecting';
        case EventSource.OPEN:
          return 'open';
        case EventSource.CLOSED:
          return 'closed';
        default:
          return 'unknown';
      }
    }
    
    if (this.pollingInterval) {
      return 'polling';
    }
    
    return 'not_initialized';
  }
}

// Export singleton instance
const serverSideConnectionAPI = new ServerSideConnectionAPI();
export default serverSideConnectionAPI;

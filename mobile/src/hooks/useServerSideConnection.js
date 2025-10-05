import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import serverSideConnectionAPI from '../services/serverSideConnectionAPI';
import notificationPermissionService from '../services/notificationPermissionService';

/**
 * Hook for managing server-side WhatsApp connections
 * 
 * This hook provides:
 * - Connection initiation
 * - Real-time status updates
 * - Automatic reconnection
 * - Status monitoring
 */
export const useServerSideConnection = (userId, sessionId = 'default') => {
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    isConnecting: false,
    status: 'disconnected',
    lastUpdate: null,
    error: null
  });
  
  const [statusStreamActive, setStatusStreamActive] = useState(false);
  const [availableSessions, setAvailableSessions] = useState({});
  
  const statusUpdateRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const previousStatusRef = useRef('disconnected');
  const connectingStartTimeRef = useRef(null);
  const connectingDelayTimeoutRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const lastKnownStatusRef = useRef('disconnected'); // Track last known status for comparison
  const statusCheckIntervalRef = useRef(null); // Interval for 10-minute status checks

  // Show error alert for connection failures
  const showConnectionErrorAlert = useCallback(() => {
    Alert.alert(
      'Connection Failed',
      'Failed to connect. Please clean session and try again.',
      [
        {
          text: 'OK',
          style: 'default'
        }
      ]
    );
  }, []);

  // Simple notification function for status changes
  const sendStatusChangeNotification = useCallback(async (previousStatus, newStatus, sessionId) => {
    console.log(`🔔 Sending status change notification: ${previousStatus} → ${newStatus}`);
    const result = await notificationPermissionService.sendConnectionStatusNotification(
      previousStatus,
      newStatus,
      sessionId
    );
    console.log(`🔔 Notification result: ${result}`);
    return result;
  }, []);

  // 10-minute status check function
  const performStatusCheck = useCallback(async () => {
    if (!userId || !sessionId) return;
    
    try {
      console.log('🔍 Performing 10-minute status check...');
      
      // Get current status from server
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/whatsapp/status/${userId}/${sessionId}`);
      if (!response.ok) {
        console.error('Failed to get status for check');
        return;
      }
      
      const data = await response.json();
      
      // Determine current status
      let currentStatus = 'disconnected';
      if (data.connected && data.wsReady) {
        currentStatus = 'connected';
      } else if (data.connecting) {
        currentStatus = 'connecting';
      } else if (data.qrCode) {
        currentStatus = 'qr_required';
      } else if (data.error) {
        currentStatus = 'error';
      }
      
      const lastKnownStatus = lastKnownStatusRef.current;
      
      console.log(`🔍 Status check: last known = ${lastKnownStatus}, current = ${currentStatus}`);
      
      // Only notify if status has changed
      if (currentStatus !== lastKnownStatus) {
        console.log(`🔔 Status changed from ${lastKnownStatus} to ${currentStatus} - sending notification`);
        await sendStatusChangeNotification(lastKnownStatus, currentStatus, sessionId);
        lastKnownStatusRef.current = currentStatus;
      } else {
        console.log(`🔍 Status unchanged (${currentStatus}) - no notification needed`);
      }
      
    } catch (error) {
      console.error('Error during status check:', error);
    }
  }, [userId, sessionId, sendStatusChangeNotification]);

  // Start 10-minute status checking
  const startStatusChecking = useCallback(() => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
    }
    
    console.log('🔄 Starting 10-minute status checking...');
    statusCheckIntervalRef.current = setInterval(performStatusCheck, 10 * 60 * 1000); // 10 minutes
    
    // Perform initial check
    performStatusCheck();
  }, [performStatusCheck]);

  // Stop 10-minute status checking
  const stopStatusChecking = useCallback(() => {
    if (statusCheckIntervalRef.current) {
      console.log('🔄 Stopping 10-minute status checking...');
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
  }, []);

  // Handle status transitions with delay logic
  const updateStatusWithDelay = useCallback((newStatus, statusData) => {
    const currentStatus = connectionStatus.status;
    const now = Date.now();
    
    console.log(`🔄 Status transition: ${currentStatus} → ${newStatus} (delay logic)`);
    
    // If transitioning to connecting, start the delay timer
    if (newStatus === 'connecting' && currentStatus !== 'connecting') {
      connectingStartTimeRef.current = now;
      console.log('🔄 Starting connecting status with delay');
      
      // Clear any existing delay timeout
      if (connectingDelayTimeoutRef.current) {
        clearTimeout(connectingDelayTimeoutRef.current);
        connectingDelayTimeoutRef.current = null;
      }
    }
    
    // If currently connecting and trying to transition to disconnected
    if (currentStatus === 'connecting' && newStatus === 'disconnected') {
      const connectingDuration = now - (connectingStartTimeRef.current || now);
      const minConnectingDuration = 3000; // 3 seconds minimum
      
      console.log(`🔄 Connecting duration: ${connectingDuration}ms, minimum: ${minConnectingDuration}ms`);
      
      if (connectingDuration < minConnectingDuration) {
        console.log(`🔄 DELAYING disconnect transition (${connectingDuration}ms < ${minConnectingDuration}ms)`);
        
        // Set a timeout to allow the transition after the minimum duration
        connectingDelayTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Minimum connecting duration reached, allowing disconnect');
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            status: 'disconnected',
            lastUpdate: new Date().toISOString(),
            error: null,
            qrCode: statusData.qrCode || null,
            wsReady: statusData.wsReady || false,
            socketState: statusData.socketState || 'unknown'
          }));
          previousStatusRef.current = 'disconnected';
        }, minConnectingDuration - connectingDuration);
        
        return; // Don't update status yet
      } else {
        console.log('🔄 Connecting duration sufficient, allowing immediate disconnect');
      }
    }
    
    // If transitioning away from connecting, clear the delay timer
    if (currentStatus === 'connecting' && newStatus !== 'connecting') {
      if (connectingDelayTimeoutRef.current) {
        console.log('🔄 Clearing delay timeout - transitioning away from connecting');
        clearTimeout(connectingDelayTimeoutRef.current);
        connectingDelayTimeoutRef.current = null;
      }
      connectingStartTimeRef.current = null;
    }
    
    // Update status immediately for non-delayed transitions
    console.log(`🔄 Updating status immediately: ${newStatus}`);
    setConnectionStatus(prev => ({
      ...prev,
      isConnected: newStatus === 'connected',
      isConnecting: newStatus === 'connecting' || newStatus === 'reconnecting',
      status: newStatus,
      lastUpdate: new Date().toISOString(),
      error: newStatus === 'error' ? (statusData.error || 'Connection failed') : null,
      qrCode: statusData.qrCode || null,
      wsReady: statusData.wsReady || false,
      socketState: statusData.socketState || 'unknown'
    }));
    
    previousStatusRef.current = newStatus;
  }, [connectionStatus.status]);

  // Handle status updates from server
  const handleStatusUpdate = useCallback(async (data) => {
    console.log('🔄 Status update received:', data);
    
    if (data.type === 'status_change') {
      const newStatus = data.status;
      const previousStatus = previousStatusRef.current;
      
      // Update status with delay logic
      updateStatusWithDelay(newStatus, data);
      
      // Update last known status for 10-minute checks (but not during refresh)
      if (!isRefreshingRef.current) {
        lastKnownStatusRef.current = newStatus;
        console.log(`🔍 Updated last known status to: ${newStatus}`);
      } else {
        console.log(`🔍 Status change during refresh (${previousStatus} → ${newStatus}), not updating last known status`);
      }
    } else if (data.type === 'status') {
      // Initial status or periodic update
      if (data.status && data.status.sessions) {
        setAvailableSessions(data.status.sessions);
        
        // Update current session status
        const currentSessionStatus = data.status.sessions[sessionId];
        if (currentSessionStatus) {
          const previousStatus = previousStatusRef.current;
          
          // Use delay logic for status updates
          updateStatusWithDelay(currentSessionStatus, {});
          
          // Send notification for status change (initial status)
          if (previousStatus !== currentSessionStatus && previousStatus !== 'unknown') {
            console.log(`🔔 Hook: Initial status change from ${previousStatus} to ${currentSessionStatus}, sending notification...`);
            const notificationResult = await notificationPermissionService.sendConnectionStatusNotification(
              previousStatus,
              currentSessionStatus,
              sessionId
            );
            console.log(`🔔 Hook: Initial notification result: ${notificationResult}`);
          }
        }
      }
    } else if (data.type === 'connection_status') {
      setStatusStreamActive(data.status === 'connected');
      
      if (data.status === 'error') {
        console.error('📡 Status stream error:', data.error);
        // Attempt to reconnect after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (userId) {
            startStatusStream();
          }
        }, 5000);
      }
    }
  }, [sessionId, userId]);

  // Start status stream
  const startStatusStream = useCallback(async () => {
    if (!userId) return;
    
    try {
      console.log('📡 Starting status stream for user:', userId);
      await serverSideConnectionAPI.startStatusStream(userId, handleStatusUpdate);
      setStatusStreamActive(true);
    } catch (error) {
      console.error('Error starting status stream:', error);
      setStatusStreamActive(false);
    }
  }, [userId, handleStatusUpdate]);

  // Stop status stream
  const stopStatusStream = useCallback(() => {
    console.log('📡 Stopping status stream');
    serverSideConnectionAPI.stopStatusStream();
    setStatusStreamActive(false);
  }, []);

  // Initiate connection
  const initiateConnection = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Start with connecting status using delay logic
      updateStatusWithDelay('connecting', {});
      
      const result = await serverSideConnectionAPI.initiateConnection(userId, sessionId);
      
      if (result.success) {
        console.log('✅ Connection initiated successfully:', result);
        // Don't immediately update status - let polling handle it after delay
        // The server might return 'disconnected' initially while connection is being established
        console.log('🔄 Connection initiated, letting polling mechanism handle status updates');
        
        // Start status polling after a delay to allow connection to establish
        setTimeout(() => {
          console.log('🔄 Starting delayed status check after connection initiation');
          getCurrentStatus();
          
          // Start more frequent polling to catch WebSocket becoming ready
          const pollInterval = setInterval(() => {
            console.log('🔄 Frequent polling to catch WebSocket ready state');
            getCurrentStatus();
          }, 1000); // Poll every 1 second
          
          // Stop frequent polling after 30 seconds
          setTimeout(() => {
            clearInterval(pollInterval);
            console.log('🔄 Stopping frequent polling after 30 seconds');
          }, 30000);
        }, 2000); // 2 second delay
      } else {
        throw new Error(result.message || 'Failed to initiate connection');
      }
    } catch (error) {
      console.error('Error initiating connection:', error);
      // Use delay logic for error status
      updateStatusWithDelay('error', { error: error.message });
      // Show error alert
      showConnectionErrorAlert();
    }
  }, [userId, sessionId, updateStatusWithDelay, showConnectionErrorAlert, getCurrentStatus]);

  // Disconnect session
  const disconnectSession = useCallback(async () => {
    if (!userId) return;
    
    try {
      const result = await serverSideConnectionAPI.disconnectSession(userId, sessionId);
      
      if (result.success) {
        console.log('✅ Session disconnected successfully:', result);
        // Use delay logic for disconnect status
        updateStatusWithDelay('disconnected', {});
      }
    } catch (error) {
      console.error('Error disconnecting session:', error);
    }
  }, [userId, sessionId, updateStatusWithDelay]);

  // Get current status - using the same accurate logic as send message screen
  const getCurrentStatus = useCallback(async () => {
    if (!userId || !sessionId) return;
    
    try {
      console.log('🔍 Getting current status for user:', userId, 'session:', sessionId);
      
      // Use the accurate session-specific endpoint (same as send message screen)
      const baseUrl = await serverSideConnectionAPI.getBaseUrl();
      const url = `${baseUrl}/api/whatsapp/status/${userId}/${sessionId}`;
      console.log('🔍 Checking specific session status at URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Specific session status response:', data);
      
      // Determine status based on the accurate data
      let currentStatus = 'disconnected';
      if (data.connected && data.wsReady) {
        currentStatus = 'connected';
      } else if (data.connecting) {
        currentStatus = 'connecting';
      } else if (data.qrCode) {
        currentStatus = 'qr_required'; // QR code is available for scanning
      } else if (data.error) {
        currentStatus = 'error'; // Connection error
      } else if (data.connected && !data.wsReady) {
        // Connection is established but WebSocket not ready yet - still consider it connecting
        currentStatus = 'connecting';
        console.log('🔄 Connection established but WebSocket not ready yet, treating as connecting');
      }
      
      console.log(`🔄 Hook: Determined status for ${sessionId}: ${currentStatus} (connected: ${data.connected}, wsReady: ${data.wsReady}, hasQR: ${!!data.qrCode})`);
      
      const previousStatus = previousStatusRef.current;
      
      // Special handling: if we're currently "connecting" and server says "disconnected",
      // don't override immediately - let the delay logic handle it
      if (connectionStatus.status === 'connecting' && currentStatus === 'disconnected') {
        console.log('🔄 Currently connecting, not overriding with disconnected status from server');
        return; // Don't update status, let delay logic handle it
      }
      
      // Special handling: if we're currently "connecting" and server says "connecting" (WebSocket not ready),
      // this is normal - keep the connecting status
      if (connectionStatus.status === 'connecting' && currentStatus === 'connecting') {
        console.log('🔄 Currently connecting, server confirms connecting status (WebSocket not ready yet)');
        // Don't return here - let the status update proceed to maintain the connecting state
      }
      
      // Update status with delay logic
      updateStatusWithDelay(currentStatus, data);
      
      // Update last known status for 10-minute checks (but not during refresh)
      if (!isRefreshingRef.current) {
        lastKnownStatusRef.current = currentStatus;
        console.log(`🔍 Updated last known status to: ${currentStatus}`);
      } else {
        console.log(`🔍 Status check change during refresh (${previousStatus} → ${currentStatus}), not updating last known status`);
      }
      
    } catch (error) {
      console.error('Error getting current status:', error);
    }
  }, [userId, sessionId, connectionStatus.status]);

  // Manual status refresh function
  const refreshStatus = useCallback(async () => {
    console.log('🔄 Manual status refresh requested');
    isRefreshingRef.current = true;
    try {
      await getCurrentStatus();
    } finally {
      // Reset refreshing flag after a delay to allow status to stabilize
      setTimeout(() => {
        isRefreshingRef.current = false;
        console.log('🔄 Refresh flag reset');
      }, 2000);
    }
  }, [getCurrentStatus]);

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      console.log('🚀 Initializing server-side connection for user:', userId);
      
      // Initialize last known status based on current connection status
      if (connectionStatus.isConnected) {
        lastKnownStatusRef.current = 'connected';
      } else {
        lastKnownStatusRef.current = 'disconnected';
      }
      console.log(`🔍 Initialized last known status: ${lastKnownStatusRef.current}`);
      
      // Get initial status
      getCurrentStatus();
      
      // Start status stream
      startStatusStream();
      
      // Start 10-minute status checking
      startStatusChecking();
    }
    
    return () => {
      stopStatusStream();
      stopStatusChecking();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [userId, getCurrentStatus, startStatusStream, stopStatusStream, startStatusChecking, stopStatusChecking, connectionStatus.isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStatusStream();
      stopStatusChecking();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectingDelayTimeoutRef.current) {
        clearTimeout(connectingDelayTimeoutRef.current);
      }
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, [stopStatusStream, stopStatusChecking]);

  return {
    // Connection state
    connectionStatus,
    statusStreamActive,
    availableSessions,
    
    // Actions
    initiateConnection,
    disconnectSession,
    getCurrentStatus,
    refreshStatus,
    startStatusStream,
    stopStatusStream,
    
    // Utilities
    isConnected: connectionStatus.isConnected,
    isConnecting: connectionStatus.isConnecting,
    hasError: !!connectionStatus.error,
    lastUpdate: connectionStatus.lastUpdate
  };
};

export default useServerSideConnection;

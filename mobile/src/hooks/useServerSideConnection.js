import { useState, useEffect, useCallback, useRef } from 'react';
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
    status: 'unknown',
    lastUpdate: null,
    error: null
  });
  
  const [statusStreamActive, setStatusStreamActive] = useState(false);
  const [availableSessions, setAvailableSessions] = useState({});
  
  const statusUpdateRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const previousStatusRef = useRef('unknown');

  // Handle status updates from server
  const handleStatusUpdate = useCallback(async (data) => {
    console.log('🔄 Status update received:', data);
    
    if (data.type === 'status_change') {
      const newStatus = data.status;
      const previousStatus = previousStatusRef.current;
      
      // Update status
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: newStatus === 'connected',
        isConnecting: newStatus === 'connecting' || newStatus === 'reconnecting',
        status: newStatus,
        lastUpdate: new Date().toISOString(),
        error: newStatus === 'failed' ? 'Connection failed' : null
      }));
      
      // Send notification for status change
      if (previousStatus !== newStatus) {
        console.log(`🔔 Hook: Status changed from ${previousStatus} to ${newStatus}, sending notification...`);
        const notificationResult = await notificationPermissionService.sendConnectionStatusNotification(
          previousStatus,
          newStatus,
          sessionId
        );
        console.log(`🔔 Hook: Notification result: ${notificationResult}`);
        previousStatusRef.current = newStatus;
      } else {
        console.log(`🔔 Hook: Status unchanged (${newStatus}), no notification needed`);
      }
    } else if (data.type === 'status') {
      // Initial status or periodic update
      if (data.status && data.status.sessions) {
        setAvailableSessions(data.status.sessions);
        
        // Update current session status
        const currentSessionStatus = data.status.sessions[sessionId];
        if (currentSessionStatus) {
          const previousStatus = previousStatusRef.current;
          
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: currentSessionStatus === 'connected',
            isConnecting: currentSessionStatus === 'connecting' || currentSessionStatus === 'reconnecting',
            status: currentSessionStatus,
            lastUpdate: new Date().toISOString(),
            error: currentSessionStatus === 'failed' ? 'Connection failed' : null
          }));
          
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
          previousStatusRef.current = currentSessionStatus;
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
      setConnectionStatus(prev => ({ ...prev, isConnecting: true, error: null }));
      
      const result = await serverSideConnectionAPI.initiateConnection(userId, sessionId);
      
      if (result.success) {
        console.log('✅ Connection initiated successfully:', result);
        setConnectionStatus(prev => ({
          ...prev,
          isConnecting: false,
          status: result.status,
          lastUpdate: new Date().toISOString()
        }));
      } else {
        throw new Error(result.message || 'Failed to initiate connection');
      }
    } catch (error) {
      console.error('Error initiating connection:', error);
      setConnectionStatus(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message
      }));
    }
  }, [userId, sessionId]);

  // Disconnect session
  const disconnectSession = useCallback(async () => {
    if (!userId) return;
    
    try {
      const result = await serverSideConnectionAPI.disconnectSession(userId, sessionId);
      
      if (result.success) {
        console.log('✅ Session disconnected successfully:', result);
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          status: 'disconnected',
          lastUpdate: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error disconnecting session:', error);
    }
  }, [userId, sessionId]);

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
      } else if (data.connected && !data.wsReady) {
        currentStatus = 'disconnected'; // WebSocket not ready
      }
      
      console.log(`🔄 Hook: Determined status for ${sessionId}: ${currentStatus} (connected: ${data.connected}, wsReady: ${data.wsReady}, hasQR: ${!!data.qrCode})`);
      
      const previousStatus = previousStatusRef.current;
      
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: currentStatus === 'connected',
        isConnecting: currentStatus === 'connecting' || currentStatus === 'reconnecting',
        status: currentStatus,
        lastUpdate: new Date().toISOString(),
        error: currentStatus === 'failed' ? 'Connection failed' : null,
        qrCode: data.qrCode || null,
        wsReady: data.wsReady || false,
        socketState: data.socketState || 'unknown'
      }));
      
      // Send notification for status change
      if (previousStatus !== currentStatus && previousStatus !== 'unknown') {
        console.log(`🔔 Hook: Status check change from ${previousStatus} to ${currentStatus}, sending notification...`);
        const notificationResult = await notificationPermissionService.sendConnectionStatusNotification(
          previousStatus,
          currentStatus,
          sessionId
        );
        console.log(`🔔 Hook: Status check notification result: ${notificationResult}`);
      }
      previousStatusRef.current = currentStatus;
      
    } catch (error) {
      console.error('Error getting current status:', error);
    }
  }, [userId, sessionId]);

  // Manual status refresh function
  const refreshStatus = useCallback(async () => {
    console.log('🔄 Manual status refresh requested');
    await getCurrentStatus();
  }, [getCurrentStatus]);

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      console.log('🚀 Initializing server-side connection for user:', userId);
      
      // Get initial status
      getCurrentStatus();
      
      // Start status stream
      startStatusStream();
    }
    
    return () => {
      stopStatusStream();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [userId, getCurrentStatus, startStatusStream, stopStatusStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStatusStream();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [stopStatusStream]);

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

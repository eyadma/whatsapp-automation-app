import { useState, useEffect, useCallback, useRef } from 'react';
import serverSideConnectionAPI from '../services/serverSideConnectionAPI';

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

  // Handle status updates from server
  const handleStatusUpdate = useCallback((data) => {
    console.log('🔄 Status update received:', data);
    
    if (data.type === 'status_change') {
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: data.status === 'connected',
        isConnecting: data.status === 'connecting' || data.status === 'reconnecting',
        status: data.status,
        lastUpdate: new Date().toISOString(),
        error: data.status === 'failed' ? 'Connection failed' : null
      }));
    } else if (data.type === 'status') {
      // Initial status or periodic update
      if (data.status && data.status.sessions) {
        setAvailableSessions(data.status.sessions);
        
        // Update current session status
        const currentSessionStatus = data.status.sessions[sessionId];
        if (currentSessionStatus) {
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: currentSessionStatus === 'connected',
            isConnecting: currentSessionStatus === 'connecting' || currentSessionStatus === 'reconnecting',
            status: currentSessionStatus,
            lastUpdate: new Date().toISOString(),
            error: currentSessionStatus === 'failed' ? 'Connection failed' : null
          }));
        }
      }
    } else if (data.sessions) {
      // Direct sessions data from status-all endpoint
      setAvailableSessions(data.sessions);
      
      // Update current session status
      const currentSessionData = data.sessions[sessionId];
      if (currentSessionData) {
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: currentSessionData.connected || currentSessionData.status === 'connected',
          isConnecting: currentSessionData.connecting || currentSessionData.status === 'connecting' || currentSessionData.status === 'reconnecting',
          status: currentSessionData.status,
          qrCode: currentSessionData.qrCode || null,
          lastUpdate: new Date().toISOString(),
          error: currentSessionData.status === 'failed' ? 'Connection failed' : null
        }));
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

  // Get current status
  const getCurrentStatus = useCallback(async () => {
    if (!userId) return;
    
    try {
      const result = await serverSideConnectionAPI.getStatusAll(userId);
      
      if (result.success) {
        setAvailableSessions(result.sessions || {});
        
        const currentSessionStatus = result.sessions?.[sessionId];
        if (currentSessionStatus) {
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: currentSessionStatus === 'connected',
            isConnecting: currentSessionStatus === 'connecting' || currentSessionStatus === 'reconnecting',
            status: currentSessionStatus,
            lastUpdate: new Date().toISOString()
          }));
        }
      }
    } catch (error) {
      console.error('Error getting current status:', error);
    }
  }, [userId, sessionId]);

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

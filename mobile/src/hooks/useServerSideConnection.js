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
        console.log('🔍 Hook: Processing status type update:', {
          hasStatus: !!data.status,
          hasSessions: !!data.status.sessions,
          sessionsType: typeof data.status.sessions,
          sessionsKeys: Object.keys(data.status.sessions || {}),
          sessionsLength: Object.keys(data.status.sessions || {}).length
        });
        
        setAvailableSessions(data.status.sessions);
        
        // Check if sessions are empty (server restarted)
        if (Object.keys(data.status.sessions).length === 0) {
          console.log('🔍 Hook: Empty sessions received via status type, setting to disconnected (server likely restarted)');
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            status: 'disconnected',
            qrCode: null,
            lastUpdate: new Date().toISOString(),
            error: null
          }));
          return;
        }
        
        // Update current session status
        const currentSessionData = data.status.sessions[sessionId];
        if (currentSessionData) {
          console.log(`🔍 Hook: Processing status update for ${sessionId}:`, {
            connected: currentSessionData.connected,
            connecting: currentSessionData.connecting,
            status: currentSessionData.status,
            connectionType: currentSessionData.connectionType,
            hasQR: !!currentSessionData.qrCode
          });
          
          // Determine the actual status based on connection data
          let actualStatus = currentSessionData.status;
          if (currentSessionData.connected) {
            actualStatus = 'connected';
          } else if (currentSessionData.connecting) {
            if (currentSessionData.qrCode) {
              actualStatus = 'qr_required';
            } else {
              actualStatus = 'connecting';
            }
          }
          
          console.log(`🔍 Hook: Determined actual status: ${actualStatus}`);
          
          setConnectionStatus(prev => {
            const newConnectionStatus = {
              ...prev,
              isConnected: currentSessionData.connected || actualStatus === 'connected',
              isConnecting: currentSessionData.connecting || actualStatus === 'connecting' || actualStatus === 'qr_required',
              status: actualStatus,
              qrCode: currentSessionData.qrCode || null,
              lastUpdate: new Date().toISOString(),
              error: actualStatus === 'failed' ? 'Connection failed' : null
            };
            
            console.log('🔍 Hook: Setting new connection status:', {
              isConnected: newConnectionStatus.isConnected,
              isConnecting: newConnectionStatus.isConnecting,
              status: newConnectionStatus.status,
              hasQRCode: !!newConnectionStatus.qrCode,
              qrCodeLength: newConnectionStatus.qrCode ? newConnectionStatus.qrCode.length : 0
            });
            
            return newConnectionStatus;
          });
        }
      }
    } else if (data.sessions) {
      // Direct sessions data from status-all endpoint
      console.log('🔍 Hook: Processing sessions data:', {
        hasSessions: !!data.sessions,
        sessionsType: typeof data.sessions,
        sessionsKeys: Object.keys(data.sessions || {}),
        sessionsLength: Object.keys(data.sessions || {}).length
      });
      
      setAvailableSessions(data.sessions);
      
      // Check if sessions are empty (server restarted)
      if (Object.keys(data.sessions).length === 0) {
        console.log('🔍 Hook: Empty sessions received, setting to disconnected (server likely restarted)');
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          status: 'disconnected',
          qrCode: null,
          lastUpdate: new Date().toISOString(),
          error: null
        }));
        return;
      }
      
      // Update current session status
      const currentSessionData = data.sessions[sessionId];
      if (currentSessionData) {
        console.log(`🔍 Hook: Processing session data for ${sessionId}:`, {
          connected: currentSessionData.connected,
          connecting: currentSessionData.connecting,
          status: currentSessionData.status,
          connectionType: currentSessionData.connectionType,
          hasQR: !!currentSessionData.qrCode,
          qrCodeLength: currentSessionData.qrCode ? currentSessionData.qrCode.length : 0,
          qrCodePreview: currentSessionData.qrCode ? currentSessionData.qrCode.substring(0, 50) + '...' : null
        });
        
        // Determine the actual status based on connection data
        let actualStatus = currentSessionData.status;
        if (currentSessionData.connected) {
          actualStatus = 'connected';
        } else if (currentSessionData.connecting) {
          if (currentSessionData.qrCode) {
            actualStatus = 'qr_required';
          } else {
            actualStatus = 'connecting';
          }
        }
        
        console.log(`🔍 Hook: Determined actual status: ${actualStatus}`);
        
        setConnectionStatus(prev => {
          const newConnectionStatus = {
            ...prev,
            isConnected: currentSessionData.connected || actualStatus === 'connected',
            isConnecting: currentSessionData.connecting || actualStatus === 'connecting' || actualStatus === 'qr_required',
            status: actualStatus,
            qrCode: currentSessionData.qrCode || null,
            lastUpdate: new Date().toISOString(),
            error: actualStatus === 'failed' ? 'Connection failed' : null
          };
          
          console.log(`🔍 Hook: Setting new connection status:`, {
            isConnected: newConnectionStatus.isConnected,
            isConnecting: newConnectionStatus.isConnecting,
            status: newConnectionStatus.status,
            hasQRCode: !!newConnectionStatus.qrCode,
            qrCodeLength: newConnectionStatus.qrCode ? newConnectionStatus.qrCode.length : 0
          });
          
          return newConnectionStatus;
        });
      } else {
        // Session doesn't exist in current response - check if we have other sessions
        const availableSessionIds = Object.keys(data.sessions);
        if (availableSessionIds.length > 0) {
          console.log(`🔍 Hook: Current session ${sessionId} not found, but other sessions available:`, availableSessionIds);
          // If we have other sessions but not the current one, we might need to update the session
          // For now, keep the current status but log the situation
        } else {
          console.log(`🔍 Hook: No sessions available for ${sessionId}`);
        }
      }
    } else if (data.type === 'connection_status') {
      setStatusStreamActive(data.status === 'connected');
      
      if (data.status === 'error') {
        console.error('📡 Status stream error:', data.error);
        setConnectionStatus(prev => ({
          ...prev,
          error: data.error,
          lastUpdate: new Date().toISOString()
        }));
        // Attempt to reconnect after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (userId) {
            startStatusStream();
          }
        }, 5000);
      } else {
        // Update connection status based on the status string
        console.log(`🔍 Hook: Processing connection_status update: ${data.status}`);
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: data.status === 'connected',
          isConnecting: data.status === 'connecting' || data.status === 'reconnecting',
          status: data.status,
          lastUpdate: new Date().toISOString(),
          error: data.status === 'error' ? data.error : null
        }));
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
        } else if (Object.keys(result.sessions || {}).length === 0) {
          // No sessions available - server likely restarted, set to disconnected
          console.log('🔍 Hook: No sessions available, setting to disconnected (server likely restarted)');
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            status: 'disconnected',
            qrCode: null,
            lastUpdate: new Date().toISOString(),
            error: null
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
    lastUpdate: connectionStatus.lastUpdate,
    qrCode: connectionStatus.qrCode
  };
};

export default useServerSideConnection;

import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Button, TextInput, Divider, Chip, useTheme, Portal, Modal, Title } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../context/AppContext';
import { whatsappAPI } from '../../services/api';
import { supabase } from '../../services/supabase';
import WebCompatibleButton from '../components/WebCompatibleButton';

const WebWhatsAppScreen = ({ navigation }) => {
  const { userId, theme, t } = useContext(AppContext);
  const paperTheme = useTheme();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    isConnecting: false,
    qrCode: null,
    connectionType: 'unknown',
  });
  const [previousConnectionStatus, setPreviousConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionSwitching, setSessionSwitching] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      loadSessions();
      // Poll for status updates every 2 seconds (silent updates)
      const interval = setInterval(() => {
        if (selectedSession) {
          checkConnectionStatus(false);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  // Auto-refresh when screen comes into focus (e.g., after creating a session)
  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        console.log('🔄 WhatsApp screen focused - refreshing sessions');
        loadSessions();
      }
    }, [userId])
  );
  
  // Check connection status when selected session changes
  useEffect(() => {
    if (selectedSession) {
      console.log('🔄 Session changed to:', selectedSession.session_name);
      checkConnectionStatus(true); // Check status for new session with logging
    }
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      const { data: sessionsData, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const realSessions = sessionsData || [];
      setSessions(realSessions);
      
      // Set first session as default if none selected
      if (realSessions.length > 0 && !selectedSession) {
        setSelectedSession(realSessions[0]);
      } else if (realSessions.length === 0) {
        // No sessions available, reset connection status
        setSelectedSession(null);
        setConnectionStatus({
          isConnected: false,
          isConnecting: false,
          qrCode: null,
          connectionType: 'unknown',
        });
        setPreviousConnectionStatus(null);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const checkConnectionStatus = async (isManualRefresh = false) => {
    try {
      if (!selectedSession) return;

      if (isManualRefresh) {
        console.log('🔄 Manual refresh - checking connection status for:', selectedSession.session_name);
      }

      const result = await whatsappAPI.getStatus(userId, selectedSession.session_id);
      
      if (result.success) {
        const newStatus = {
          isConnected: result.data.connected,
          isConnecting: result.data.connecting,
          qrCode: result.data.qrCode,
          connectionType: result.data.connectionType || 'unknown',
        };

        // Only update if status actually changed
        if (JSON.stringify(newStatus) !== JSON.stringify(connectionStatus)) {
          console.log('📊 Connection status changed:', newStatus);
          setConnectionStatus(newStatus);
          
          // Show connection success message
          if (previousConnectionStatus && 
              !previousConnectionStatus.isConnected && 
              newStatus.isConnected) {
            Alert.alert(t('success'), t('whatsAppConnectedSuccessfully'));
          }
          
          setPreviousConnectionStatus(newStatus);
        }
      } else {
        console.error('❌ Failed to get connection status:', result.error);
        if (isManualRefresh) {
          Alert.alert(t('error'), result.error || 'Failed to check connection status');
        }
      }
    } catch (error) {
      console.error('❌ Error checking connection status:', error);
      if (isManualRefresh) {
        Alert.alert(t('error'), 'Error checking connection status');
      }
    }
  };

  const connectSession = async () => {
    try {
      setSessionSwitching(true);
      console.log('🔄 Connecting session:', selectedSession.session_name);
      
      const result = await whatsappAPI.connectSession(userId, selectedSession.session_id);
      
      if (result.success) {
        console.log('✅ Connection initiated successfully');
        Alert.alert(t('success'), t('connectionInitiated'));
        
        // Start checking for QR code
        setTimeout(() => {
          checkConnectionStatus(true);
        }, 1000);
      } else {
        console.error('❌ Failed to connect session:', result.error);
        Alert.alert(t('error'), result.error || 'Failed to connect session');
      }
    } catch (error) {
      console.error('❌ Error connecting session:', error);
      Alert.alert(t('error'), 'Error connecting session');
    } finally {
      setSessionSwitching(false);
    }
  };

  const disconnectSession = async () => {
    try {
      setSessionSwitching(true);
      console.log('🔄 Disconnecting session:', selectedSession.session_name);
      
      const result = await whatsappAPI.disconnectSession(userId, selectedSession.session_id);
      
      if (result.success) {
        console.log('✅ Session disconnected successfully');
        Alert.alert(t('success'), t('sessionDisconnectedSuccessfully'));
        
        // Update connection status
        setConnectionStatus({
          isConnected: false,
          isConnecting: false,
          qrCode: null,
          connectionType: 'unknown',
        });
      } else {
        console.error('❌ Failed to disconnect session:', result.error);
        Alert.alert(t('error'), result.error || 'Failed to disconnect session');
      }
    } catch (error) {
      console.error('❌ Error disconnecting session:', error);
      Alert.alert(t('error'), 'Error disconnecting session');
    } finally {
      setSessionSwitching(false);
    }
  };

  const generateQRCode = async () => {
    try {
      setQrLoading(true);
      console.log('🔄 Generating QR code for session:', selectedSession.session_name);
      
      const result = await whatsappAPI.generateQRCode(userId, selectedSession.session_id);
      
      if (result.success) {
        console.log('✅ QR code generated successfully');
        setQrCodeData(result.data.qrCode);
        setShowQRModal(true);
      } else {
        console.error('❌ Failed to generate QR code:', result.error);
        Alert.alert(t('error'), result.error || 'Failed to generate QR code');
      }
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      Alert.alert(t('error'), 'Error generating QR code');
    } finally {
      setQrLoading(false);
    }
  };

  const deleteSession = async () => {
    Alert.alert(
      t('confirmDelete'),
      t('confirmDeleteDesc'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setSessionSwitching(true);
              console.log('🔄 Deleting session:', selectedSession.session_name);
              
              const result = await whatsappAPI.deleteSession(userId, selectedSession.session_id);
              
              if (result.success) {
                console.log('✅ Session deleted successfully');
                Alert.alert(t('success'), t('sessionDeletedSuccessfully'));
                
                // Reload sessions
                await loadSessions();
              } else {
                console.error('❌ Failed to delete session:', result.error);
                Alert.alert(t('error'), result.error || 'Failed to delete session');
              }
            } catch (error) {
              console.error('❌ Error deleting session:', error);
              Alert.alert(t('error'), 'Error deleting session');
            } finally {
              setSessionSwitching(false);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = () => {
    if (connectionStatus.isConnecting) return '#FF9800';
    if (connectionStatus.isConnected) return '#4CAF50';
    return '#F44336';
  };

  const getStatusText = () => {
    if (connectionStatus.isConnecting) return t('connecting');
    if (connectionStatus.isConnected) return t('connected');
    return t('disconnected');
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: paperTheme.colors.background,
      padding: 16,
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: paperTheme.colors.onSurfaceVariant,
    },
    card: {
      marginBottom: 16,
      backgroundColor: paperTheme.colors.surface,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
    },
    divider: {
      marginVertical: 12,
    },
    sessionsContainer: {
      marginBottom: 20,
    },
    sessionCard: {
      marginBottom: 12,
      backgroundColor: paperTheme.colors.surface,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sessionName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
    },
    sessionInfo: {
      fontSize: 14,
      color: paperTheme.colors.onSurfaceVariant,
      marginBottom: 4,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    statusText: {
      fontSize: 14,
      color: paperTheme.colors.onSurfaceVariant,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap',
    },
    connectionSection: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: paperTheme.colors.surfaceVariant,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: paperTheme.colors.outline,
    },
    connectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    connectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: paperTheme.colors.onSurface,
    },
    connectionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    connectionIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    connectionStatus: {
      fontSize: 14,
      fontWeight: '500',
    },
    qrModal: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    qrContent: {
      backgroundColor: paperTheme.colors.surface,
      padding: 20,
      borderRadius: 12,
      width: '90%',
      maxWidth: 400,
    },
    qrTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 16,
      color: paperTheme.colors.onSurface,
    },
    qrCode: {
      width: '100%',
      height: 300,
      backgroundColor: '#fff',
      borderRadius: 8,
      marginBottom: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    qrText: {
      fontSize: 16,
      textAlign: 'center',
      color: paperTheme.colors.onSurfaceVariant,
      marginBottom: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noSessionsContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    noSessionsText: {
      fontSize: 18,
      color: paperTheme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: 8,
    },
    noSessionsSubtext: {
      fontSize: 14,
      color: paperTheme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: 20,
    },
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={{ color: paperTheme.colors.onSurface }}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>{t('whatsappConnection')}</Text>
        <Text style={dynamicStyles.subtitle}>
          {t('manageMultipleAccounts')}
        </Text>
      </View>

      <WebCompatibleButton
        onPress={loadSessions}
        mode="outlined"
        icon="refresh"
        style={{ marginBottom: 16 }}
      >
        {t('refresh')}
      </WebCompatibleButton>

      {sessions.length > 0 ? (
        <ScrollView style={dynamicStyles.sessionsContainer}>
          {sessions.map((session) => (
            <Card key={session.session_id} style={dynamicStyles.sessionCard}>
              <Card.Content>
                <View style={dynamicStyles.sessionHeader}>
                  <Text style={dynamicStyles.sessionName}>
                    {session.session_name}
                  </Text>
                  <View style={dynamicStyles.statusContainer}>
                    <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor() }]} />
                    <Text style={dynamicStyles.statusText}>
                      {getStatusText()}
                    </Text>
                  </View>
                </View>

                {session.session_alias && (
                  <Text style={dynamicStyles.sessionInfo}>
                    {t('alias')}: {session.session_alias}
                  </Text>
                )}

                {session.phone_number && (
                  <Text style={dynamicStyles.sessionInfo}>
                    {t('phone')}: {session.phone_number}
                  </Text>
                )}

                <Text style={dynamicStyles.sessionInfo}>
                  {t('type')}: {session.connection_type || 'Unknown'}
                </Text>

                <Text style={dynamicStyles.sessionInfo}>
                  {t('created')}: {new Date(session.created_at).toLocaleDateString()}
                </Text>

                <View style={dynamicStyles.buttonContainer}>
                  {!connectionStatus.isConnected ? (
                    <WebCompatibleButton
                      onPress={connectSession}
                      mode="contained"
                      icon="link"
                      disabled={sessionSwitching}
                      loading={sessionSwitching}
                    >
                      {t('connect')}
                    </WebCompatibleButton>
                  ) : (
                    <WebCompatibleButton
                      onPress={disconnectSession}
                      mode="outlined"
                      icon="link-off"
                      disabled={sessionSwitching}
                      loading={sessionSwitching}
                    >
                      {t('disconnect')}
                    </WebCompatibleButton>
                  )}

                  <WebCompatibleButton
                    onPress={generateQRCode}
                    mode="outlined"
                    icon="qr-code"
                    disabled={qrLoading}
                    loading={qrLoading}
                  >
                    {t('generateQRCode')}
                  </WebCompatibleButton>

                  <WebCompatibleButton
                    onPress={checkConnectionStatus}
                    mode="outlined"
                    icon="refresh"
                    disabled={sessionSwitching}
                  >
                    {t('refresh')}
                  </WebCompatibleButton>

                  <WebCompatibleButton
                    onPress={deleteSession}
                    mode="outlined"
                    icon="delete"
                    disabled={sessionSwitching}
                    style={{ borderColor: '#F44336' }}
                    labelStyle={{ color: '#F44336' }}
                  >
                    {t('delete')}
                  </WebCompatibleButton>
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <View style={dynamicStyles.noSessionsContainer}>
          <Text style={dynamicStyles.noSessionsText}>{t('noSessionsFound')}</Text>
          <Text style={dynamicStyles.noSessionsSubtext}>
            {t('createSessionToGetStarted')}
          </Text>
          <WebCompatibleButton
            mode="contained"
            onPress={() => navigation.navigate('Sessions')}
            icon="plus"
          >
            {t('createFirstSession')}
          </WebCompatibleButton>
        </View>
      )}

      {/* Connection Status Section */}
      {selectedSession && (
        <Card style={dynamicStyles.card}>
          <Card.Content>
            <View style={dynamicStyles.connectionSection}>
              <View style={dynamicStyles.connectionHeader}>
                <Text style={dynamicStyles.connectionTitle}>
                  {selectedSession.session_name} - {t('connectionStatus')}
                </Text>
                <View style={dynamicStyles.connectionActions}>
                  <View style={[
                    dynamicStyles.connectionIndicator,
                    { backgroundColor: getStatusColor() }
                  ]} />
                  <Text style={[
                    dynamicStyles.connectionStatus,
                    { color: getStatusColor() }
                  ]}>
                    {getStatusText()}
                  </Text>
                </View>
              </View>
              
              {connectionStatus.qrCode && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: paperTheme.colors.onSurfaceVariant, marginBottom: 8 }}>
                    {t('qrCodeInstructions')}
                  </Text>
                  <WebCompatibleButton
                    onPress={() => {
                      setQrCodeData(connectionStatus.qrCode);
                      setShowQRModal(true);
                    }}
                    mode="outlined"
                    icon="qr-code"
                  >
                    {t('viewQRCode')}
                  </WebCompatibleButton>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* QR Code Modal */}
      <Portal>
        <Modal
          visible={showQRModal}
          onDismiss={() => setShowQRModal(false)}
          contentContainerStyle={dynamicStyles.qrModal}
        >
          <View style={dynamicStyles.qrContent}>
            <Text style={dynamicStyles.qrTitle}>{t('whatsAppQRCode')}</Text>
            
            {qrLoading ? (
              <View style={dynamicStyles.qrCode}>
                <Text style={{ color: paperTheme.colors.onSurfaceVariant }}>
                  {t('loading')}...
                </Text>
              </View>
            ) : qrCodeData ? (
              <View style={dynamicStyles.qrCode}>
                <Text style={{ color: '#000', fontSize: 12, textAlign: 'center' }}>
                  QR Code: {qrCodeData.substring(0, 50)}...
                </Text>
                <Text style={{ color: '#666', fontSize: 10, marginTop: 8, textAlign: 'center' }}>
                  (QR Code visualization would be here)
                </Text>
              </View>
            ) : (
              <View style={dynamicStyles.qrCode}>
                <Text style={{ color: '#666' }}>{t('qrCodeNotAvailable')}</Text>
              </View>
            )}

            <Text style={dynamicStyles.qrText}>
              {t('qrCodeInstructions')}
            </Text>

            <WebCompatibleButton
              onPress={() => setShowQRModal(false)}
              mode="contained"
            >
              {t('close')}
            </WebCompatibleButton>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

export default WebWhatsAppScreen;
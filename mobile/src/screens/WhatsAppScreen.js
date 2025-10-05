import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  I18nManager,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Button, TextInput, Divider, Chip, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { AppContext } from '../context/AppContext';
import { whatsappAPI } from '../services/api';
import { supabase } from '../services/supabase';
import WebCompatibleButton from '../web/components/WebCompatibleButton';
import useServerSideConnection from '../hooks/useServerSideConnection';

const WhatsAppScreen = ({ navigation }) => {
  const { userId, theme, t } = useContext(AppContext);
  const paperTheme = useTheme();
  
  // Use web-compatible button on web, regular button on mobile
  const CompatibleButton = Platform.OS === 'web' ? WebCompatibleButton : Button;
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionSwitching, setSessionSwitching] = useState(false);
  
  // Use the new server-side connection hook
  const {
    connectionStatus,
    initiateConnection,
    disconnectSession,
    isConnected,
    isConnecting,
    hasError,
    lastUpdate
  } = useServerSideConnection(userId, selectedSession?.session_id || 'default');


  useEffect(() => {
    if (userId) {
      loadSessions();
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
      // Connection status is now handled by the useServerSideConnection hook
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
        // Connection status is now handled by the useServerSideConnection hook
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  // Connection status is now handled by the useServerSideConnection hook
  // No need for manual status checking - the hook provides real-time updates

  const handleConnect = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('pleaseSelectSessionFirst'));
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔗 Starting WhatsApp connection for session:', selectedSession.session_id);
      console.log('📱 Session details:', {
        sessionId: selectedSession.session_id,
        sessionName: selectedSession.session_name,
        phoneNumber: selectedSession.phone_number
      });
      
      // Use the new server-side connection hook
      await initiateConnection();
      
      Alert.alert(t('success'), t('whatsappConnectionInitiated'));
    } catch (error) {
      console.error('❌ Connection error:', error);
      Alert.alert(t('error'), t('failedToConnectWhatsApp').replace('{error}', error.message));
    } finally {
      setLoading(false);
    }
  };


  const handleDisconnect = async () => {
    Alert.alert(
      t('disconnectWhatsApp'),
      t('sureToDisconnect'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('disconnect'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              if (!selectedSession) {
                Alert.alert(t('error'), t('noSessionSelectedError'));
                return;
              }
              
              // Use the new server-side connection hook
              await disconnectSession();
              Alert.alert(t('success'), t('whatsappDisconnectedSuccessfully'));
            } catch (error) {
              Alert.alert(t('error'), t('failedToDisconnect').replace('{error}', error.message));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateQR = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('pleaseSelectSessionFirst'));
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔍 Generating QR code for session:', selectedSession.session_id);
      
      const response = await whatsappAPI.generateQR(userId, selectedSession.session_id);
      console.log('📱 Generate QR response:', response);
      
      if (response.data && response.data.qrCode) {
        // QR code generation is handled by the server-side connection
        // Connection status is now managed by the useServerSideConnection hook
        
        Alert.alert(t('success'), t('qrCodeGeneratedSuccessfully'));
        
        // Connection status is now handled by the useServerSideConnection hook
        // No need for manual status checking
      } else {
        Alert.alert(t('error'), t('failedToGenerateQR'));
      }
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      Alert.alert(t('error'), t('failedToGenerateQRWithError').replace('{error}', error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCleanSession = async () => {
    Alert.alert(
      t('cleanSession'),
      t('cleanSessionMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('cleanSessionButton'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              if (!selectedSession) {
                Alert.alert(t('error'), t('noSessionSelectedError'));
                return;
              }
              
              console.log('🧹 Cleaning session:', selectedSession.session_id);
              
              const response = await whatsappAPI.cleanSession(userId);
              console.log('🧹 Clean session response:', response);
              
              // Connection status is now handled by the useServerSideConnection hook
              
              Alert.alert(t('success'), t('sessionCleanedSuccessfully'));
            } catch (error) {
              console.error('❌ Error cleaning session:', error);
              Alert.alert(t('error'), t('failedToCleanSession').replace('{error}', error.message));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('noSessionSelectedError'));
      return;
    }

    Alert.alert(
      t('deleteSession'),
      t('deleteSessionMessage').replace('{sessionName}', selectedSession.session_name),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              console.log('🗑️ Deleting session:', selectedSession.session_id);
              
              // Delete session from database
              const { error } = await supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('session_id', selectedSession.session_id)
                .eq('user_id', userId);

              if (error) throw error;

              // Connection status is now handled by the useServerSideConnection hook
              
              // Clear selected session
              setSelectedSession(null);
              
              // Reload sessions to update the list
              await loadSessions();
              
              Alert.alert(t('success'), t('sessionDeletedSuccessfully'));
            } catch (error) {
              console.error('❌ Error deleting session:', error);
              Alert.alert(t('error'), t('failedToDeleteSession').replace('{error}', error.message));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };




  const getStatusColor = () => {
    if (!selectedSession) return '#999';
    if (sessionSwitching) return '#FFA500';
    if (isConnected) return '#25D366';
    if (isConnecting) return '#FFA500';
    return '#FF3B30';
  };

  const getStatusText = () => {
    if (!selectedSession) return t('noSession');
    if (sessionSwitching) return t('switching');
    if (isConnected) {
      return t('whatsappConnected');
    }
    if (isConnecting) {
      return t('connectingToWhatsApp');
    }
    if (hasError) {
      return t('connectionError');
    }
    return t('whatsappDisconnected');
  };

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <ScrollView style={dynamicStyles.container}>
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.header}>
            <Ionicons name="logo-whatsapp" size={40} color="#25D366" />
            <Text style={dynamicStyles.title}>{t('whatsappConnection')}</Text>
          </View>
          
          <Divider style={dynamicStyles.divider} />
          
          {/* Session Selector */}
          {sessions.length > 0 ? (
            <View style={dynamicStyles.sessionSelectorContainer}>
              <Text style={dynamicStyles.sessionSelectorLabel}>{t('selectSession')}</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={dynamicStyles.sessionSelectorScroll}
                contentContainerStyle={dynamicStyles.sessionSelectorContent}
              >
                {sessions.map((session) => (
                  <TouchableOpacity
                    key={session.session_id}
                    onPress={async () => {
                      setSessionSwitching(true);
                      setSelectedSession(session);
                      // Connection status is now handled by the useServerSideConnection hook
                      
                      // Small delay to show the switching state
                      setTimeout(() => {
                        setSessionSwitching(false);
                      }, 500);
                    }}
                    style={[
                      dynamicStyles.sessionChip,
                      selectedSession?.session_id === session.session_id && dynamicStyles.sessionChipSelected
                    ]}
                  >
                    <Text style={[
                      dynamicStyles.sessionChipText,
                      selectedSession?.session_id === session.session_id && dynamicStyles.sessionChipTextSelected
                    ]}>
                      {session.session_name}
                    </Text>
                    {session.is_default && (
                      <Chip 
                        icon="star" 
                        style={dynamicStyles.defaultChip}
                        textStyle={dynamicStyles.defaultChipText}
                      >
                        {t('default')}
                      </Chip>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={dynamicStyles.noSessionsContainer}>
              <Text style={dynamicStyles.noSessionsText}>{t('noSessionsFound')}</Text>
              <Text style={dynamicStyles.noSessionsSubtext}>
                {t('createSessionToGetStarted')}
              </Text>
              <CompatibleButton
                mode="contained"
                onPress={() => navigation.navigate('Sessions')}
                style={dynamicStyles.createSessionButton}
                labelStyle={dynamicStyles.createSessionButtonLabel}
                icon="plus"
              >
                Create Session
              </CompatibleButton>
            </View>
          )}
          
          {/* Connection Status */}
          <View style={dynamicStyles.statusContainer}>
            <Text style={dynamicStyles.statusLabel}>
              {selectedSession ? `${selectedSession.session_name} ${t('status')}:` : t('noSessionSelectedStatus')}
            </Text>
            {selectedSession ? (
              <View style={dynamicStyles.statusRow}>
                <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[dynamicStyles.statusText, { color: getStatusColor() }]}>
                  {sessionSwitching ? t('switching') : getStatusText()}
                </Text>
              </View>
            ) : (
              <Text style={[dynamicStyles.statusText, { color: paperTheme.colors.onSurfaceVariant }]}>
                {t('selectSessionToViewStatus')}
              </Text>
            )}
          </View>
          
          {/* Selected Session Info */}
          {selectedSession && (
            <View style={dynamicStyles.selectedSessionInfo}>
              <Text style={dynamicStyles.selectedSessionLabel}>{t('activeSession')}</Text>
              <Text style={dynamicStyles.selectedSessionName}>{selectedSession.session_name}</Text>
              <Text style={dynamicStyles.selectedSessionDetails}>
                {selectedSession.phone_number ? `${t('phone')}: ${selectedSession.phone_number}` : t('noPhoneNumber')}
              </Text>
            </View>
          )}


          {/* QR Code Display */}
          {connectionStatus.qrCode && (
            <View style={dynamicStyles.qrContainer}>
              <Text style={dynamicStyles.qrTitle}>Scan QR Code to Connect</Text>
              <View style={dynamicStyles.qrWrapper}>
                <QRCode
                  value={connectionStatus.qrCode}
                  size={250}
                  color="black"
                  backgroundColor="white"
                  onError={(error) => {
                    console.log('❌ QR Code Error:', error);
                  }}
                  onLoad={() => {
                    console.log('✅ QR Code loaded successfully');
                  }}
                />
              </View>
              <Text style={dynamicStyles.qrInstructions}>
                Open WhatsApp on your phone and scan this QR code
              </Text>
              <Text style={dynamicStyles.qrDebug}>
                QR Code Length: {connectionStatus.qrCode.length} characters
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={dynamicStyles.buttonContainer}>
            {!isConnected && !isConnecting ? (
              <CompatibleButton
                mode="contained"
                onPress={handleConnect}
                loading={loading}
                disabled={loading || !selectedSession}
                style={[dynamicStyles.button, dynamicStyles.connectButton]}
                labelStyle={dynamicStyles.buttonLabel}
              >
                {selectedSession ? t('connectWhatsApp') : t('selectSessionFirst')}
              </CompatibleButton>
            ) : (
              <CompatibleButton
                mode="contained"
                onPress={handleDisconnect}
                loading={loading}
                disabled={loading || !selectedSession}
                style={[dynamicStyles.button, dynamicStyles.disconnectButton]}
                labelStyle={dynamicStyles.buttonLabel}
              >
                {t('disconnectWhatsApp')}
              </CompatibleButton>
            )}
          </View>

          {/* Utility Buttons */}
          <View style={dynamicStyles.utilityButtonsContainer}>
            <TouchableOpacity
              onPress={() => {}} // Status is now handled by the hook
              disabled={loading || !selectedSession}
              style={[dynamicStyles.customButton, dynamicStyles.refreshButton]}
            >
              <Ionicons name="refresh" size={14} color="#007AFF" style={{ marginRight: 4 }} />
              <View style={dynamicStyles.textContainer}>
                <Text
                  style={[
                    dynamicStyles.customButtonText,
                    { writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' }
                  ]}
                >
                  {t('refreshStatus')}
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleCleanSession}
              disabled={loading || !selectedSession}
              style={[dynamicStyles.customButton, dynamicStyles.cleanSessionButton]}
            >
              <Ionicons name="refresh-circle" size={14} color="#FF6B35" style={{ marginRight: 4 }} />
              <View style={dynamicStyles.textContainer}>
                <Text
                  style={[
                    dynamicStyles.customButtonText,
                    { writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' }
                  ]}
                >
                  {t('cleanSession')}
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleDeleteSession}
              disabled={loading || !selectedSession}
              style={[dynamicStyles.customButton, dynamicStyles.deleteButton]}
            >
              <Ionicons name="trash" size={14} color="#FF3B30" style={{ marginRight: 4 }} />
              <View style={dynamicStyles.textContainer}>
                <Text
                  style={[
                    dynamicStyles.customButtonText,
                    { writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' }
                  ]}
                >
                  {t('deleteSession')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>




          {/* Generate QR Button */}
            {!isConnected && !isConnecting && (
            <View style={dynamicStyles.generateQRContainer}>
              <CompatibleButton
                mode="contained"
                onPress={handleGenerateQR}
                loading={loading}
                disabled={loading || !selectedSession}
                style={[dynamicStyles.button, dynamicStyles.generateQRButton]}
                labelStyle={dynamicStyles.buttonLabel}
              >
                <Ionicons name="qr-code" size={20} color="white" style={{ marginRight: 8 }} />
                {t('generateQRCode')}
              </CompatibleButton>
            </View>
          )}


        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 4,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
    color: theme.colors.onSurface,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: theme.colors.outline,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    color: theme.colors.onSurface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  userInfo: {
    marginBottom: 16,
  },
  userLabel: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  userId: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.surfaceVariant,
    padding: 8,
    borderRadius: 4,
  },
  serverButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: 16,
  },
  connectionInfo: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: theme.colors.primaryContainer,
    borderRadius: 8,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onPrimaryContainer,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.onPrimaryContainer,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 24,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.outline,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.onSurface,
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrInstructions: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  qrDebug: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  qrErrorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.errorContainer,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  qrErrorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onErrorContainer,
    marginTop: 8,
    marginBottom: 4,
  },
  qrErrorSubtext: {
    fontSize: 12,
    color: theme.colors.onErrorContainer,
    textAlign: 'center',
    marginBottom: 2,
  },
  buttonContainer: {
    marginVertical: 20,
  },
  button: {
    paddingVertical: 8,
  },
  connectButton: {
    backgroundColor: '#25D366',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  utilityButtonsContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  customButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderRadius: 4,
    backgroundColor: 'transparent',
    minWidth: 80,
  },
  refreshButton: {
    borderColor: '#007AFF',
  },
  deleteButton: {
    borderColor: '#FF3B30',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customButtonText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    color: theme.colors.onSurface,
    textAlignVertical: 'center',
    includeFontPadding: false,
    textBreakStrategy: 'simple',
    minWidth: 0,
    flexShrink: 1,
  },
  generateQRContainer: {
    marginTop: 16,
  },
  generateQRButton: {
    backgroundColor: '#25D366',
  },
  cleanSessionContainer: {
    marginTop: 12,
  },
  cleanSessionButton: {
    borderColor: '#FF6B35',
  },
  testConnectionContainer: {
    marginTop: 12,
  },
  testButton: {
    borderColor: '#007AFF',
  },
  debugButton: {
    borderColor: '#FF6B35',
    marginTop: 8,
  },
  instructions: {
    marginTop: 20,
    padding: 16,
    backgroundColor: theme.colors.secondaryContainer,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.onSecondaryContainer,
  },
  instructionsText: {
    fontSize: 14,
    color: theme.colors.onSecondaryContainer,
    lineHeight: 20,
  },
  // Session Selector Styles
  sessionSelectorContainer: {
    marginBottom: 20,
  },
  sessionSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  sessionSelectorScroll: {
    maxHeight: 60,
  },
  sessionSelectorContent: {
    paddingHorizontal: 4,
  },
  sessionChip: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 100,
    alignItems: 'center',
  },
  sessionChipSelected: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  sessionChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
  },
  sessionChipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  defaultChip: {
    backgroundColor: '#FFD700',
    marginTop: 4,
    height: 20,
  },
  defaultChipText: {
    fontSize: 10,
    color: '#B8860B',
    fontWeight: '600',
  },
  selectedSessionInfo: {
    backgroundColor: theme.colors.primaryContainer,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  selectedSessionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onPrimaryContainer,
    marginBottom: 4,
  },
  selectedSessionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onPrimaryContainer,
    marginBottom: 4,
  },
  selectedSessionDetails: {
    fontSize: 14,
    color: theme.colors.onPrimaryContainer,
  },
  noSessionsContainer: {
    backgroundColor: theme.colors.tertiaryContainer,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    alignItems: 'center',
    marginBottom: 20,
  },
  noSessionsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onTertiaryContainer,
    marginBottom: 8,
    textAlign: 'center',
  },
  noSessionsSubtext: {
    fontSize: 14,
    color: theme.colors.onTertiaryContainer,
    textAlign: 'center',
    marginBottom: 16,
  },
  createSessionButton: {
    backgroundColor: '#25D366',
    marginTop: 8,
  },
  createSessionButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default WhatsAppScreen; 
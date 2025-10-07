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
  ActivityIndicator,
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

const EnhancedWhatsAppScreen = ({ navigation }) => {
  const { userId, theme, t } = useContext(AppContext);
  const paperTheme = useTheme();
  
  // Use web-compatible button on web, regular button on mobile
  const CompatibleButton = Platform.OS === 'web' ? WebCompatibleButton : Button;
  
  // State management
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionSwitching, setSessionSwitching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [lastStatusUpdate, setLastStatusUpdate] = useState(null);
  
  // Use the new server-side connection hook
  const {
    connectionStatus,
    initiateConnection,
    disconnectSession,
    isConnected,
    isConnecting: hookIsConnecting,
    hasError,
    lastUpdate,
    qrCode
  } = useServerSideConnection(userId, selectedSession?.session_id || 'default');

  // Auto-update status when screen opens
  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        console.log('🔄 Enhanced WhatsApp screen focused - auto-updating status');
        loadSessions();
        setLastStatusUpdate(new Date().toISOString());
      }
    }, [userId])
  );

  // Load sessions on component mount
  useEffect(() => {
    if (userId) {
      loadSessions();
    }
  }, [userId]);

  // Handle connection status changes
  useEffect(() => {
    console.log('🔄 Enhanced WhatsApp Screen - Connection status changed:', {
      isConnected,
      isConnecting: hookIsConnecting,
      hasError,
      qrCode: !!qrCode,
      qrCodeLength: qrCode ? qrCode.length : 0,
      qrCodePreview: qrCode ? qrCode.substring(0, 50) + '...' : null,
      status: connectionStatus.status,
      showQRCode: showQRCode
    });

    // Update local state based on hook state
    setIsConnecting(hookIsConnecting);
    
    // Show QR code when available
    if (qrCode && !isConnected) {
      console.log('📱 Enhanced WhatsApp Screen - Setting showQRCode to true');
      setShowQRCode(true);
    } else if (isConnected) {
      console.log('📱 Enhanced WhatsApp Screen - Setting showQRCode to false (connected)');
      setShowQRCode(false);
    } else if (!qrCode) {
      console.log('📱 Enhanced WhatsApp Screen - Setting showQRCode to false (no QR code)');
      setShowQRCode(false);
    }

    // Reset connection attempted flag when connected
    if (isConnected) {
      setConnectionAttempted(false);
    }
  }, [isConnected, hookIsConnecting, hasError, qrCode, connectionStatus.status]);

  const loadSessions = async () => {
    try {
      setLoading(true);
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
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert(t('error'), 'Failed to load sessions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = async (session) => {
    if (sessionSwitching || isConnecting) return;
    
    setSessionSwitching(true);
    setSelectedSession(session);
    setShowQRCode(false);
    
    // Small delay to show the switching state
    setTimeout(() => {
      setSessionSwitching(false);
    }, 500);
  };

  const handleConnect = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('pleaseSelectSessionFirst'));
      return;
    }
    
    if (isConnecting) {
      Alert.alert(t('info'), 'Connection already in progress. Please wait...');
      return;
    }
    
    setConnectionAttempted(true);
    setIsConnecting(true);
    
    try {
      console.log('🔗 Starting WhatsApp connection for session:', selectedSession.session_id);
      
      // Use the new server-side connection hook
      await initiateConnection();
      
      // Connection status will be updated by the hook
      console.log('✅ Connection initiated successfully');
    } catch (error) {
      console.error('❌ Connection error:', error);
      Alert.alert(
        t('error'), 
        `Failed to connect WhatsApp: ${error.message}\n\nPlease try again or check your internet connection.`
      );
      setConnectionAttempted(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('noSessionSelectedError'));
      return;
    }

    Alert.alert(
      t('disconnectWhatsApp'),
      `Are you sure you want to disconnect "${selectedSession.session_name}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('disconnect'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await disconnectSession();
              setShowQRCode(false);
              setConnectionAttempted(false);
              Alert.alert(t('success'), t('whatsappDisconnectedSuccessfully'));
            } catch (error) {
              Alert.alert(t('error'), `Failed to disconnect: ${error.message}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelConnection = async () => {
    if (!isConnecting) return;
    
    Alert.alert(
      'Cancel Connection',
      'Are you sure you want to cancel the current connection attempt?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectSession();
              setIsConnecting(false);
              setConnectionAttempted(false);
              setShowQRCode(false);
              Alert.alert('Success', 'Connection attempt cancelled');
            } catch (error) {
              console.error('Error cancelling connection:', error);
              Alert.alert('Error', 'Failed to cancel connection: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    if (loading || isConnecting) return;
    
    setLoading(true);
    try {
      await loadSessions();
      setLastStatusUpdate(new Date().toISOString());
      Alert.alert('Success', 'Status refreshed successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanSession = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('noSessionSelectedError'));
      return;
    }

    Alert.alert(
      t('cleanSession'),
      `This will clear all session data for "${selectedSession.session_name}". You will need to scan QR code again. Continue?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('cleanSessionButton'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await whatsappAPI.cleanSession(userId);
              setShowQRCode(false);
              setConnectionAttempted(false);
              Alert.alert(t('success'), t('sessionCleanedSuccessfully'));
            } catch (error) {
              Alert.alert(t('error'), `Failed to clean session: ${error.message}`);
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
      `Are you sure you want to permanently delete "${selectedSession.session_name}"? This action cannot be undone.`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Delete session from database
              const { error } = await supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('session_id', selectedSession.session_id)
                .eq('user_id', userId);

              if (error) throw error;

              // Clear selected session and reload
              setSelectedSession(null);
              setShowQRCode(false);
              setConnectionAttempted(false);
              await loadSessions();
              
              Alert.alert(t('success'), t('sessionDeletedSuccessfully'));
            } catch (error) {
              Alert.alert(t('error'), `Failed to delete session: ${error.message}`);
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
    if (hasError) return '#FF3B30';
    return '#FF3B30';
  };

  const getStatusText = () => {
    if (!selectedSession) return 'No Session Selected';
    if (sessionSwitching) return 'Switching Session...';
    if (isConnected) return 'Connected ✅';
    if (isConnecting) {
      if (showQRCode) return 'Scan QR Code 📱';
      return 'Connecting...';
    }
    if (hasError) return 'Connection Error ❌';
    return 'Disconnected ❌';
  };

  const getStatusDescription = () => {
    if (!selectedSession) return 'Please select a session to view status';
    if (sessionSwitching) return 'Switching to selected session';
    if (isConnected) return 'WhatsApp is connected and ready to send messages';
    if (isConnecting) {
      if (showQRCode) return 'Scan the QR code with your WhatsApp mobile app';
      return 'Establishing connection to WhatsApp servers';
    }
    if (hasError) return 'Connection failed. Please try again or check your internet connection';
    return 'WhatsApp is not connected. Press Connect to start';
  };

  const isButtonDisabled = (buttonType) => {
    if (loading) return true;
    if (isConnecting && buttonType !== 'cancel') return true;
    if (!selectedSession && buttonType !== 'refresh') return true;
    return false;
  };

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <View style={dynamicStyles.container}>
      <Card style={dynamicStyles.card}>
        <Card.Content style={dynamicStyles.cardContent}>
          {/* Compact Header */}
          <View style={dynamicStyles.header}>
            <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
            <Text style={dynamicStyles.title}>WhatsApp</Text>
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isButtonDisabled('refresh')}
              style={[
                dynamicStyles.refreshButton,
                isButtonDisabled('refresh') && dynamicStyles.buttonDisabled
              ]}
            >
              <Ionicons 
                name="refresh" 
                size={18} 
                color={isButtonDisabled('refresh') ? '#999' : '#007AFF'} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Compact Session Selector */}
          <View style={dynamicStyles.sessionSection}>
            {sessions.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={dynamicStyles.sessionSelector}
                contentContainerStyle={dynamicStyles.sessionSelectorContent}
              >
                {sessions.map((session) => (
                  <TouchableOpacity
                    key={session.session_id}
                    onPress={() => handleSessionSelect(session)}
                    disabled={isButtonDisabled('session')}
                    style={[
                      dynamicStyles.sessionChip,
                      selectedSession?.session_id === session.session_id && dynamicStyles.sessionChipSelected,
                      isButtonDisabled('session') && dynamicStyles.sessionChipDisabled
                    ]}
                  >
                    <Text style={[
                      dynamicStyles.sessionChipText,
                      selectedSession?.session_id === session.session_id && dynamicStyles.sessionChipTextSelected
                    ]}>
                      {session.session_name}
                    </Text>
                    {session.is_default && (
                      <View style={dynamicStyles.defaultBadge}>
                        <Text style={dynamicStyles.defaultBadgeText}>★</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={dynamicStyles.noSessionsContainer}>
                <Text style={dynamicStyles.noSessionsText}>No Sessions</Text>
                <CompatibleButton
                  mode="contained"
                  onPress={() => navigation.navigate('Sessions')}
                  style={dynamicStyles.createSessionButton}
                  icon="plus"
                  compact
                >
                  Create
                </CompatibleButton>
              </View>
            )}
          </View>

          {/* Inline Status and Session Info */}
          <View style={dynamicStyles.statusSection}>
            <View style={dynamicStyles.statusRow}>
              <View style={dynamicStyles.statusIndicator}>
                <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[dynamicStyles.statusText, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
              </View>
              {selectedSession && (
                <View style={dynamicStyles.sessionInfoInline}>
                  <Text style={dynamicStyles.sessionInfoText}>
                    {selectedSession.session_name}
                  </Text>
                  {selectedSession.phone_number && (
                    <Text style={dynamicStyles.sessionInfoSubtext}>
                      {selectedSession.phone_number}
                    </Text>
                  )}
                </View>
              )}
            </View>
            <Text style={dynamicStyles.statusDescription}>
              {getStatusDescription()}
            </Text>
          </View>

          {/* QR Code Display - Scrollable when shown */}
          {showQRCode && qrCode && (
            <ScrollView style={dynamicStyles.qrScrollContainer} showsVerticalScrollIndicator={false}>
              <View style={dynamicStyles.qrSection}>
                <Text style={dynamicStyles.qrTitle}>Scan QR Code</Text>
                <View style={dynamicStyles.qrContainer}>
                  <View style={dynamicStyles.qrWrapper}>
                    <QRCode
                      value={qrCode}
                      size={200}
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
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </Text>
                  <Text style={dynamicStyles.qrInstructions}>
                    Then scan this QR code
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {/* Compact Action Buttons */}
          <View style={dynamicStyles.actionsSection}>
            {/* Main Connect/Disconnect Button */}
            <CompatibleButton
              mode="contained"
              onPress={isConnected ? handleDisconnect : handleConnect}
              loading={loading || isConnecting}
              disabled={isButtonDisabled('connect')}
              style={[
                dynamicStyles.mainButton,
                isConnected ? dynamicStyles.disconnectButton : dynamicStyles.connectButton,
                isButtonDisabled('connect') && dynamicStyles.buttonDisabled
              ]}
              icon={isConnected ? "close" : "link"}
              compact
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </CompatibleButton>

            {/* Cancel Connection Button */}
            {isConnecting && (
              <CompatibleButton
                mode="outlined"
                onPress={handleCancelConnection}
                style={[dynamicStyles.cancelButton, dynamicStyles.cancelButton]}
                icon="stop"
                compact
              >
                Cancel
              </CompatibleButton>
            )}

            {/* Compact Utility Buttons */}
            <View style={dynamicStyles.utilityButtonsContainer}>
              <TouchableOpacity
                onPress={handleCleanSession}
                disabled={isButtonDisabled('clean')}
                style={[
                  dynamicStyles.utilityButton,
                  dynamicStyles.cleanUtilityButton,
                  isButtonDisabled('clean') && dynamicStyles.buttonDisabled
                ]}
              >
                <Ionicons 
                  name="refresh-circle" 
                  size={14} 
                  color={isButtonDisabled('clean') ? '#999' : '#FF6B35'} 
                />
                <Text style={[
                  dynamicStyles.utilityButtonText,
                  isButtonDisabled('clean') && dynamicStyles.utilityButtonTextDisabled
                ]}>
                  Clean
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleDeleteSession}
                disabled={isButtonDisabled('delete')}
                style={[
                  dynamicStyles.utilityButton,
                  dynamicStyles.deleteUtilityButton,
                  isButtonDisabled('delete') && dynamicStyles.buttonDisabled
                ]}
              >
                <Ionicons 
                  name="trash" 
                  size={14} 
                  color={isButtonDisabled('delete') ? '#999' : '#FF3B30'} 
                />
                <Text style={[
                  dynamicStyles.utilityButtonText,
                  isButtonDisabled('delete') && dynamicStyles.utilityButtonTextDisabled
                ]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Compact Progress Indicator */}
          {isConnecting && !showQRCode && (
            <View style={dynamicStyles.progressSection}>
              <ActivityIndicator size="small" color="#25D366" />
              <Text style={dynamicStyles.progressText}>
                {showQRCode ? 'Waiting for QR scan...' : 'Connecting...'}
              </Text>
            </View>
          )}

          {/* Compact Error Display */}
          {hasError && (
            <View style={dynamicStyles.errorSection}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={dynamicStyles.errorText}>
                Connection failed. Try again.
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 12,
  },
  card: {
    flex: 1,
    elevation: 2,
    backgroundColor: theme.colors.surface,
  },
  cardContent: {
    padding: 16,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    flex: 1,
    marginLeft: 8,
  },
  sessionSection: {
    marginBottom: 12,
  },
  statusSection: {
    marginBottom: 12,
  },
  actionsSection: {
    marginBottom: 8,
  },
  // Session Selector Styles
  sessionSelector: {
    maxHeight: 50,
  },
  sessionSelectorContent: {
    paddingHorizontal: 2,
  },
  sessionChip: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 80,
    alignItems: 'center',
    position: 'relative',
  },
  sessionChipSelected: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  sessionChipDisabled: {
    opacity: 0.5,
  },
  sessionChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
  },
  sessionChipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  defaultBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultBadgeText: {
    fontSize: 10,
    color: '#B8860B',
    fontWeight: 'bold',
  },
  noSessionsContainer: {
    backgroundColor: theme.colors.tertiaryContainer,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noSessionsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.onTertiaryContainer,
  },
  createSessionButton: {
    backgroundColor: '#25D366',
  },
  // Status Styles
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  sessionInfoInline: {
    alignItems: 'flex-end',
  },
  sessionInfoText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.onSurface,
  },
  sessionInfoSubtext: {
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
  refreshButton: {
    padding: 6,
    borderRadius: 4,
  },
  // Session Info Styles
  sessionInfoContainer: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  sessionInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
  },
  sessionInfoValue: {
    fontSize: 14,
    color: theme.colors.onSurface,
    fontWeight: '500',
  },
  // QR Code Styles
  qrScrollContainer: {
    maxHeight: 300,
    marginBottom: 12,
  },
  qrSection: {
    marginBottom: 8,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: theme.colors.onSurface,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  qrInstructions: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 2,
  },
  // Button Styles
  mainButton: {
    marginBottom: 8,
  },
  connectButton: {
    backgroundColor: '#25D366',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButton: {
    borderColor: '#FF3B30',
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  utilityButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  utilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cleanUtilityButton: {
    borderColor: '#FF6B35',
  },
  deleteUtilityButton: {
    borderColor: '#FF3B30',
  },
  utilityButtonText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 3,
    color: theme.colors.onSurface,
  },
  utilityButtonTextDisabled: {
    color: '#999',
  },
  // Progress Styles
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.onSurface,
    marginLeft: 8,
  },
  // Error Styles
  errorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: theme.colors.errorContainer,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.error,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.onErrorContainer,
    marginLeft: 6,
  },
});

export default EnhancedWhatsAppScreen;

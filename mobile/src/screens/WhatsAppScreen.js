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
import { supabase } from '../services/supabase';
import { resolveApiBaseUrl } from '../services/apiBase';
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
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // Use the new server-side connection hook
  const {
    connectionStatus,
    initiateConnection,
    disconnectSession,
    refreshStatus,
    isConnected,
    isConnecting,
    hasError,
    lastUpdate,
    availableSessions
  } = useServerSideConnection(userId, selectedSession?.session_id);

  useEffect(() => {
    if (userId) {
      loadSessions();
    }
  }, [userId]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        console.log('🔄 WhatsApp screen focused - refreshing sessions');
        loadSessions();
      }
    }, [userId])
  );

  const loadSessions = async () => {
    try {
      setLoading(true);
      
      // Get user's sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

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
      Alert.alert('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('pleaseSelectSessionFirst'));
      return;
    }

    try {
      console.log('🔄 Initiating connection for session:', selectedSession.session_id);
      await initiateConnection();
    } catch (error) {
      console.error('Error connecting:', error);
      Alert.alert(t('error'), t('failedToConnectWhatsApp').replace('{error}', error.message));
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
            try {
              if (!selectedSession) {
                Alert.alert(t('error'), t('noSessionSelectedError'));
                return;
              }
              
              console.log('🔄 Disconnecting session:', selectedSession.session_id);
              await disconnectSession();
              Alert.alert(t('success'), t('whatsappDisconnectedSuccessfully'));
            } catch (error) {
              console.error('Error disconnecting:', error);
              Alert.alert(t('error'), t('failedToDisconnect').replace('{error}', error.message));
            }
          },
        },
      ]
    );
  };

  const handleResolveConflict = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('noSessionSelectedError'));
      return;
    }

    Alert.alert(
      'Resolve Session Conflict',
      'This will clear the conflicting session and allow you to reconnect. Continue?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Resolve',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔧 Resolving conflict for session:', selectedSession.session_id);
              
              // Get the correct base URL using the same logic as other services
              const baseUrl = await resolveApiBaseUrl();
              const url = `${baseUrl}/api/whatsapp/resolve-conflict/${userId}/${selectedSession.session_id}`;
              
              console.log('🔧 Resolving conflict at URL:', url);
              
              const response = await fetch(url, { 
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
              });
              
              if (response.ok) {
                const result = await response.json();
                console.log('✅ Conflict resolved:', result);
                Alert.alert(t('success'), 'Conflict resolved! You can now reconnect.');
              } else {
                const errorText = await response.text();
                console.error('❌ Server error response:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
              }
            } catch (error) {
              console.error('Error resolving conflict:', error);
              Alert.alert(t('error'), 'Failed to resolve conflict. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleClearSession = async () => {
    if (!selectedSession) {
      Alert.alert(t('error'), t('noSessionSelectedError'));
      return;
    }

    Alert.alert(
      t('cleanSession'),
      t('cleanSessionMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('cleanSessionButton'),
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🧹 Cleaning session:', selectedSession.session_id);
              
              // Get the correct base URL using the same logic as other services
              const baseUrl = await resolveApiBaseUrl();
              const url = `${baseUrl}/api/whatsapp/resolve-conflict/${userId}/${selectedSession.session_id}`;
              
              console.log('🧹 Cleaning session at URL:', url);
              
              // Call the server to clean the session
              const response = await fetch(url, { 
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
              });
              
              if (response.ok) {
                const result = await response.json();
                console.log('✅ Session cleaned:', result);
                Alert.alert(t('success'), t('sessionCleanedSuccessfully'));
                
                // Reload sessions to refresh the list
                await loadSessions();
              } else {
                const errorText = await response.text();
                console.error('❌ Server error response:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
              }
            } catch (error) {
              console.error('❌ Error cleaning session:', error);
              Alert.alert(t('error'), t('failedToCleanSession').replace('{error}', error.message));
            }
          },
        },
      ]
    );
  };

  const handleRefreshStatus = async () => {
    try {
      console.log('🔄 Manually refreshing status...');
      
      // Use the hook's refreshStatus function
      await refreshStatus();
      
      // Also reload sessions to get fresh data
      await loadSessions();
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const getStatusColor = () => {
    if (!selectedSession) return '#999';
    if (sessionSwitching) return '#FFA500';
    if (connectionStatus?.status === 'conflict') return '#FF5722';
    if (connectionStatus?.status === 'qr_required') return '#9C27B0'; // Purple for QR code
    if (isConnected) return '#25D366';
    if (isConnecting) return '#FFA500';
    return '#FF3B30';
  };

  const getStatusText = () => {
    if (!selectedSession) return t('noSession');
    if (sessionSwitching) return t('switching');
    if (connectionStatus?.status === 'conflict') return 'Session Conflict';
    if (connectionStatus?.status === 'conflict_resolved') return 'Conflict Resolved';
    if (connectionStatus?.status === 'qr_required') return 'QR Code Required';
    if (isConnected) {
      if (connectionStatus?.connectionType === 'saved_session') {
        return t('whatsappConnected');
      } else {
        return t('connected');
      }
    }
    if (isConnecting) {
      if (connectionStatus?.connectionType === 'qr_required') {
        return t('scanQRCodePlease');
      } else {
        return t('connecting');
      }
    }
    return t('disconnected');
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
              
              {/* Debug Info Toggle */}
              <TouchableOpacity
                onPress={() => setShowDebugInfo(!showDebugInfo)}
                style={dynamicStyles.debugToggle}
              >
                <Text style={dynamicStyles.debugToggleText}>
                  {showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
                </Text>
              </TouchableOpacity>
              
              {/* Debug Information */}
              {showDebugInfo && (
                <View style={dynamicStyles.debugContainer}>
                  <Text style={dynamicStyles.debugTitle}>Debug Information:</Text>
                  <Text style={dynamicStyles.debugText}>
                    Hook Status: {connectionStatus?.status || 'unknown'}
                  </Text>
                  <Text style={dynamicStyles.debugText}>
                    Hook Connected: {isConnected ? 'true' : 'false'}
                  </Text>
                  <Text style={dynamicStyles.debugText}>
                    Hook Connecting: {isConnecting ? 'true' : 'false'}
                  </Text>
                  <Text style={dynamicStyles.debugText}>
                    Hook Error: {hasError ? 'true' : 'false'}
                  </Text>
                  <Text style={dynamicStyles.debugText}>
                    Last Update: {lastUpdate || 'never'}
                  </Text>
                  <Text style={dynamicStyles.debugText}>
                    Available Sessions: {Object.keys(availableSessions).length}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Conflict Resolution UI */}
          {connectionStatus?.status === 'conflict' && (
            <View style={dynamicStyles.conflictContainer}>
              <Text style={dynamicStyles.conflictText}>
                ⚠️ Another device is connected to this WhatsApp account
              </Text>
              <CompatibleButton
                mode="contained"
                onPress={handleResolveConflict}
                style={dynamicStyles.resolveButton}
                icon="alert-circle"
              >
                Resolve Conflict
              </CompatibleButton>
            </View>
          )}

          {connectionStatus?.status === 'conflict_resolved' && (
            <View style={dynamicStyles.conflictResolvedContainer}>
              <Text style={dynamicStyles.conflictResolvedText}>
                ✅ Conflict resolved! You can now reconnect.
              </Text>
            </View>
          )}

          {/* QR Code Display */}
          {(connectionStatus?.qrCode || connectionStatus?.status === 'qr_required') && (
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
            {!isConnected && !isConnecting && connectionStatus?.status !== 'conflict' && connectionStatus?.status !== 'qr_required' ? (
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
                disabled={loading || !selectedSession || !isConnected}
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
              onPress={handleRefreshStatus}
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
              onPress={handleClearSession}
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
              onPress={() => navigation.navigate('Sessions')}
              disabled={loading}
              style={[dynamicStyles.customButton, dynamicStyles.manageSessionsButton]}
            >
              <Ionicons name="settings" size={14} color="#007AFF" style={{ marginRight: 4 }} />
              <View style={dynamicStyles.textContainer}>
                <Text
                  style={[
                    dynamicStyles.customButtonText,
                    { writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' }
                  ]}
                >
                  {t('manageSessions')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
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
  debugToggle: {
    marginTop: 8,
    padding: 4,
  },
  debugToggleText: {
    fontSize: 12,
    color: theme.colors.onPrimaryContainer,
    textDecorationLine: 'underline',
  },
  debugContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  conflictContainer: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  conflictText: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 12,
    textAlign: 'center',
  },
  resolveButton: {
    backgroundColor: '#FF5722',
  },
  conflictResolvedContainer: {
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  conflictResolvedText: {
    fontSize: 14,
    color: '#2E7D32',
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
  cleanSessionButton: {
    borderColor: '#FF6B35',
  },
  manageSessionsButton: {
    borderColor: '#007AFF',
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
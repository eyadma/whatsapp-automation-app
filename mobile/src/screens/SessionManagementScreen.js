import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Animated,
  Share,
  Modal as RNModal,
} from 'react-native';
import { Clipboard } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  Modal,
  Portal,
  Chip,
  List,
  Divider,
  FAB,
  IconButton,
  ProgressBar,
  Switch,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { whatsappAPI } from '../services/api';
import { resolveApiBaseUrl } from '../services/apiBase';

// Safe QR Code library import
let QRCode;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch (error) {
  console.warn('QR Code library not available:', error);
  QRCode = null;
}

const { width, height } = Dimensions.get('window');

const SessionManagementScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({});
  const [qrCodeData, setQrCodeData] = useState(null);
  const [selectedQRCode, setSelectedQRCode] = useState(null);
  const [newSessionData, setNewSessionData] = useState({
    name: '',
    alias: '',
    phoneNumber: '',
    connectionType: 'mobile',
    maxConnections: 5,
  });
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    connectedSessions: 0,
    totalMessagesToday: 0,
    totalConnectionTimeToday: 0,
  });

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    if (userId) {
      loadSessions();
      startAnimations();
      checkConnectionStatuses();
    }
  }, [userId]);

  useEffect(() => {
    // Poll connection status every 5 seconds
    const interval = setInterval(() => {
      if (userId && sessions.length > 0) {
        checkConnectionStatuses();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, sessions]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      
      // Fetch real sessions from database
      const { data: sessionsData, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const realSessions = sessionsData || [];
      
      setStats({
        totalSessions: realSessions.length,
        activeSessions: realSessions.filter(s => s.is_active).length,
        connectedSessions: realSessions.filter(s => s.status === 'connected').length,
        totalMessagesToday: 0,
        totalConnectionTimeToday: 0,
      });

      setSessions(realSessions);
      
      // Set active session if there's a default
      const defaultSession = realSessions.find(s => s.is_default);
      if (defaultSession) {
        setActiveSessionId(defaultSession.session_id);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load sessions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatuses = async () => {
    try {
      // Fetch real connection statuses from API
      const statuses = {};
      
      for (const session of sessions) {
        try {
          const response = await fetch(`${await resolveApiBaseUrl()}/api/whatsapp/status/${userId}/${session.session_id}`);
          if (response.ok) {
            const data = await response.json();
            statuses[session.session_id] = {
              isConnected: data.connected || false,
              isConnecting: data.connecting || false,
              qrCode: data.qrCode || null
            };
          } else {
            statuses[session.session_id] = {
              isConnected: false,
              isConnecting: false,
              qrCode: null
            };
          }
        } catch (error) {
          console.error(`Error checking status for session ${session.session_id}:`, error);
          statuses[session.session_id] = {
            isConnected: false,
            isConnecting: false,
            qrCode: null
          };
        }
      }
      
      setConnectionStatus(statuses);
    } catch (error) {
      console.error('Error checking connection statuses:', error);
    }
  };

  const showQRCode = (sessionId, qrCode) => {
    if (!sessionId || !qrCode || !qrCode.trim()) {
      Alert.alert('Error', 'Invalid QR code data');
      return;
    }
    
    try {
      setSelectedQRCode({ sessionId, qrCode });
      setShowQRModal(true);
    } catch (error) {
      console.error('Error showing QR code:', error);
      Alert.alert('Error', 'Failed to display QR code');
    }
  };

  const shareQRCode = async () => {
    if (!selectedQRCode || !selectedQRCode.qrCode || !selectedQRCode.sessionId) {
      Alert.alert('Error', 'Invalid QR code data');
      return;
    }
    
    try {
      // Share the QR code data as text with session information
      const sessionName = sessions.find(s => s.session_id === selectedQRCode.sessionId)?.session_name || selectedQRCode.sessionId;
      
      await Share.share({
        message: `WhatsApp QR Code\n\nSession: ${sessionName}\nSession ID: ${selectedQRCode.sessionId}\n\nQR Code Data: ${selectedQRCode.qrCode}\n\nScan this QR code with WhatsApp to connect your account.`,
        title: 'WhatsApp QR Code'
      });
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  const copyQRCodeData = async () => {
    if (!selectedQRCode || !selectedQRCode.qrCode) {
      Alert.alert('Error', 'Invalid QR code data');
      return;
    }
    
    try {
      await Clipboard.setString(selectedQRCode.qrCode);
      Alert.alert('Success', 'QR Code data copied to clipboard!');
    } catch (error) {
      console.error('Error copying QR code data:', error);
      Alert.alert('Error', 'Failed to copy QR code data');
    }
  };

  const generateQRCode = async (sessionId) => {
    try {
      setLoading(true);
      
      // Call the WhatsApp API to generate QR code for this session
      const response = await whatsappAPI.generateQR(userId, sessionId);
      
      if (response && response.data && response.data.qrCode && response.data.qrCode.trim()) {
        setQrCodeData(prev => ({
          ...prev,
          [sessionId]: response.data.qrCode
        }));
        
        Alert.alert('Success', 'QR Code generated successfully!');
      } else {
        throw new Error('No valid QR code received from server');
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    await checkConnectionStatuses();
    setRefreshing(false);
  };

  const createNewSession = async () => {
    try {
      if (!newSessionData.name.trim()) {
        Alert.alert('Error', 'Session name is required');
        return;
      }

      // Create session in database
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .insert([{
          session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          session_name: newSessionData.name,
          session_alias: newSessionData.alias || generateAlias(newSessionData.name),
          phone_number: newSessionData.phoneNumber,
          connection_type: newSessionData.connectionType,
          max_connections: newSessionData.maxConnections,
          is_default: sessions.length === 0, // First session becomes default
          is_active: true,
          status: 'disconnected'
        }])
        .select()
        .single();

      if (error) throw error;

      setShowCreateModal(false);
      setNewSessionData({
        name: '',
        alias: '',
        phoneNumber: '',
        connectionType: 'mobile',
        maxConnections: 5,
      });
      
      Alert.alert('Success', 'Session created successfully!');
      
      // Refresh sessions from database
      await loadSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create session: ' + error.message);
    }
  };

  const generateAlias = (name) => {
    if (!name) return 'S' + Math.random().toString(36).substr(2, 3).toUpperCase();
    
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 3).toUpperCase();
    }
    
    return words.map(word => word.charAt(0)).join('').toUpperCase();
  };

  const setDefaultSession = async (sessionId) => {
    try {
      // Update database to set this session as default
      await supabase
        .from('whatsapp_sessions')
        .update({ is_default: false })
        .eq('user_id', userId);

      await supabase
        .from('whatsapp_sessions')
        .update({ is_default: true })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      setActiveSessionId(sessionId);
      Alert.alert('Success', 'Default session updated!');
      
      // Refresh sessions from database
      await loadSessions();
    } catch (error) {
      console.error('Error setting default session:', error);
      Alert.alert('Error', 'Failed to update default session');
    }
  };

  const connectSession = async (sessionId) => {
    try {
      Alert.alert(
        'Connect Session',
        'This will connect the selected WhatsApp session. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect',
            onPress: async () => {
              try {
                setLoading(true);
                
                // Call the WhatsApp API to connect this specific session
                await whatsappAPI.connect(userId, sessionId);
                
                // Update session status in database
                await supabase
                  .from('whatsapp_sessions')
                  .update({ 
                    status: 'connecting',
                    last_activity: new Date().toISOString()
                  })
                  .eq('session_id', sessionId);

                Alert.alert('Success', 'Session connection initiated! Please scan the QR code.');
                await checkConnectionStatuses();
                await loadSessions();
              } catch (error) {
                console.error('Error connecting session:', error);
                Alert.alert('Error', 'Failed to connect session: ' + error.message);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in connectSession:', error);
      Alert.alert('Error', 'Failed to initiate connection');
    }
  };

  const disconnectSession = async (sessionId) => {
    try {
      Alert.alert(
        'Disconnect Session',
        'Are you sure you want to disconnect this session?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                
                // Call the WhatsApp API to disconnect this specific session
                await whatsappAPI.disconnect(userId, sessionId);
                
                // Update session status in database
                await supabase
                  .from('whatsapp_sessions')
                  .update({ 
                    status: 'disconnected',
                    last_activity: new Date().toISOString()
                  })
                  .eq('session_id', sessionId);

                Alert.alert('Success', 'Session disconnected successfully!');
                await checkConnectionStatuses();
                await loadSessions();
              } catch (error) {
                console.error('Error disconnecting session:', error);
                Alert.alert('Error', 'Failed to disconnect session: ' + error.message);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in disconnectSession:', error);
      Alert.alert('Error', 'Failed to disconnect session');
    }
  };

  const deleteSession = async (sessionId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this session? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('session_id', sessionId)
                .eq('user_id', userId);

              if (error) throw error;

              // If this was the active session, clear it
              if (activeSessionId === sessionId) {
                setActiveSessionId(null);
              }

              Alert.alert('Success', 'Session deleted successfully!');
              
              // Refresh sessions from database
              await loadSessions();
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const selectSessionForMessaging = (sessionId) => {
    setActiveSessionId(sessionId);
    
    // Update the default session in database
    setDefaultSession(sessionId);
    
    Alert.alert(
      'Session Selected',
      'This session is now set as your default for sending messages. You can change this anytime.',
      [{ text: 'OK' }]
    );
  };

  // Get the current active session for messaging
  const getActiveSession = () => {
    return sessions.find(s => s.session_id === activeSessionId);
  };

  // Check if a session is ready for messaging (connected and active)
  const isSessionReadyForMessaging = (sessionId) => {
    const session = sessions.find(s => s.session_id === sessionId);
    const connectionStatus = getConnectionStatus(sessionId);
    return session && session.is_active && connectionStatus.isConnected;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#25D366';
      case 'connecting': return '#FF9500';
      case 'disconnected': return '#FF3B30';
      case 'qr_expired': return '#FF6B35';
      case 'inactive': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return 'checkmark-circle';
      case 'connecting': return 'sync';
      case 'disconnected': return 'close-circle';
      case 'qr_expired': return 'time';
      case 'inactive': return 'pause-circle';
      default: return 'help-circle';
    }
  };

  const getConnectionTypeIcon = (type) => {
    switch (type) {
      case 'mobile': return 'phone-portrait';
      case 'business': return 'business';
      case 'api': return 'code';
      default: return 'phone-portrait';
    }
  };

  const getConnectionStatus = (sessionId) => {
    return connectionStatus[sessionId] || { isConnected: false, isConnecting: false };
  };

  const renderSessionCard = (session, index) => {
    const isDefault = session.is_default;
    const isActive = session.session_id === activeSessionId;
    const statusColor = getStatusColor(session.status);
    const statusIcon = getStatusIcon(session.status);
    const typeIcon = getConnectionTypeIcon(session.connection_type);
    const sessionConnectionStatus = getConnectionStatus(session.session_id);
    const isConnected = sessionConnectionStatus.isConnected;
    const isConnecting = sessionConnectionStatus.isConnecting;

    return (
      <Animated.View
        key={session.session_id}
        style={[
          dynamicStyles.sessionCardContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <Card style={[
          dynamicStyles.sessionCard, 
          isDefault && dynamicStyles.defaultSessionCard,
          isActive && dynamicStyles.activeSessionCard
        ]}>
          <Card.Content>
            {/* Session Header */}
            <View style={dynamicStyles.sessionHeader}>
              <View style={dynamicStyles.sessionInfo}>
                <View style={dynamicStyles.sessionNameContainer}>
                  <Text style={dynamicStyles.sessionName}>{session.session_name}</Text>
                  {isDefault && (
                    <Chip icon="star" style={dynamicStyles.defaultChip}>
                      Default
                    </Chip>
                  )}
                  {isActive && (
                    <Chip icon="check" style={dynamicStyles.activeChip}>
                      Active
                    </Chip>
                  )}
                </View>
                <Text style={dynamicStyles.sessionAlias}>{session.session_alias}</Text>
              </View>
              
              <View style={dynamicStyles.sessionStatus}>
                <View style={[dynamicStyles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[dynamicStyles.statusText, { color: statusColor }]}>
                  {isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}
                </Text>
              </View>
            </View>

            {/* Session Details */}
            <View style={dynamicStyles.sessionDetails}>
              <View style={dynamicStyles.detailRow}>
                <Ionicons name={typeIcon} size={16} color="#666" />
                <Text style={dynamicStyles.detailText}>{session.connection_type}</Text>
              </View>
              
              {session.phone_number && (
                <View style={dynamicStyles.detailRow}>
                  <Ionicons name="call" size={16} color="#666" />
                  <Text style={dynamicStyles.detailText}>{session.phone_number}</Text>
                </View>
              )}
              
              <View style={dynamicStyles.detailRow}>
                <Ionicons name="time" size={16} color="#666" />
                <Text style={dynamicStyles.detailText}>
                  Created: {new Date(session.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {/* Connection Controls */}
            <View style={dynamicStyles.connectionControls}>
              {!isConnected && !isConnecting ? (
                <Button
                  mode="contained"
                  onPress={() => connectSession(session.session_id)}
                  style={[dynamicStyles.actionButton, dynamicStyles.connectButton]}
                  icon="wifi"
                  compact
                  loading={loading}
                  disabled={loading}
                >
                  Connect
                </Button>
              ) : (
                <Button
                  mode="outlined"
                  onPress={() => disconnectSession(session.session_id)}
                  style={[dynamicStyles.actionButton, dynamicStyles.disconnectButton]}
                  icon="wifi-off"
                  compact
                  loading={loading}
                  disabled={loading}
                  textColor="#FF3B30"
                >
                  Disconnect
                </Button>
              )}
            </View>

                        {/* QR Code Display */}
            {isConnecting && (
              <View style={dynamicStyles.qrCodeContainer}>
                {qrCodeData && qrCodeData[session.session_id] && qrCodeData[session.session_id].trim() ? (
                  <>
                    <Text style={dynamicStyles.qrCodeTitle}>Scan QR Code to Connect</Text>
                    <TouchableOpacity
                      style={dynamicStyles.qrCodeWrapper}
                      onPress={() => showQRCode(session.session_id, qrCodeData[session.session_id])}
                      activeOpacity={0.7}
                    >
                      {(() => {
                        if (!QRCode) {
                          return (
                            <View style={dynamicStyles.qrCodeErrorContainer}>
                              <Ionicons name="alert-circle" size={48} color="#FF3B30" />
                              <Text style={dynamicStyles.qrCodeErrorText}>QR Library Unavailable</Text>
                            </View>
                          );
                        }
                        
                        try {
                          return (
                            <QRCode
                              value={qrCodeData[session.session_id] || ''}
                              size={120}
                              color="black"
                              backgroundColor="white"
                              onError={(error) => {
                                console.log('❌ QR Code Error:', error);
                              }}
                              onLoad={() => {
                                console.log('✅ QR Code loaded successfully');
                              }}
                            />
                          );
                        } catch (error) {
                          console.error('Error rendering QR code:', error);
                          return (
                            <View style={dynamicStyles.qrCodeErrorContainer}>
                              <Ionicons name="alert-circle" size={48} color="#FF3B30" />
                              <Text style={dynamicStyles.qrCodeErrorText}>QR Code Error</Text>
                            </View>
                          );
                        }
                      })()}
                      <View style={[dynamicStyles.qrCodeOverlay, { opacity: 0.3 }]}>
                        <Ionicons name="expand" size={24} color="#666" />
                        <Text style={dynamicStyles.qrCodeTapText}>Tap to zoom</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={dynamicStyles.qrCodeInstructions}>
                      Open WhatsApp on your phone and scan this QR code
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={dynamicStyles.qrCodeTitle}>QR Code Not Available</Text>
                    <Text style={dynamicStyles.qrCodeInstructions}>
                      Click the button below to generate a QR code for this session
                    </Text>
                    <Button
                      mode="contained"
                      onPress={() => generateQRCode(session.session_id)}
                      style={dynamicStyles.generateQRButton}
                      icon="qr-code"
                      loading={loading}
                      disabled={loading}
                    >
                      Generate QR Code
                    </Button>
                  </>
                )}
              </View>
            )}

            {/* Session Actions */}
            <View style={dynamicStyles.sessionActions}>
              {!isDefault && (
                <Button
                  mode="outlined"
                  onPress={() => setDefaultSession(session.session_id)}
                  style={dynamicStyles.actionButton}
                  icon="star"
                  compact
                >
                  Set Default
                </Button>
              )}
              
              {!isActive && (
                <Button
                  mode="contained"
                  onPress={() => selectSessionForMessaging(session.session_id)}
                  style={[dynamicStyles.actionButton, dynamicStyles.selectButton]}
                  icon="check"
                  compact
                >
                  Use for Messages
                </Button>
              )}
              
              <Button
                mode="outlined"
                onPress={() => {
                  setSelectedSession(session);
                  setShowSessionModal(true);
                }}
                style={dynamicStyles.actionButton}
                icon="cog"
                compact
              >
                Settings
              </Button>
              
              <Button
                mode="outlined"
                onPress={() => deleteSession(session.session_id)}
                style={dynamicStyles.actionButton}
                icon="delete"
                compact
                textColor="#FF3B30"
              >
                Delete
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    );
  };

  const renderStatsCard = () => (
    <Animated.View
      style={[
        dynamicStyles.statsCardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={dynamicStyles.statsGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Card style={dynamicStyles.statsCard}>
          <Card.Content>
            <Title style={dynamicStyles.statsTitle}>Session Overview</Title>
            
            <View style={dynamicStyles.statsGrid}>
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statNumber}>{stats.totalSessions}</Text>
                <Text style={dynamicStyles.statLabel}>Total Sessions</Text>
              </View>
              
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statNumber}>{stats.connectedSessions}</Text>
                <Text style={dynamicStyles.statLabel}>Connected</Text>
              </View>
              
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statNumber}>{stats.totalMessagesToday}</Text>
                <Text style={dynamicStyles.statLabel}>{t('messagesToday')}</Text>
              </View>
              
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statNumber}>{stats.totalConnectionTimeToday}m</Text>
                <Text style={dynamicStyles.statLabel}>{t('connectionTime')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </LinearGradient>
    </Animated.View>
  );

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        style={dynamicStyles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={dynamicStyles.header}>
          <Title style={dynamicStyles.headerTitle}>WhatsApp Sessions</Title>
          <Paragraph style={dynamicStyles.headerSubtitle}>
            Manage multiple WhatsApp accounts and connections
          </Paragraph>
        </View>

        {/* Active Session Info */}
        {activeSessionId && (
          <Card style={dynamicStyles.activeSessionInfoCard}>
            <Card.Content>
              <View style={dynamicStyles.activeSessionInfo}>
                <Ionicons name="chatbubbles" size={24} color="#4CAF50" />
                <View style={dynamicStyles.activeSessionText}>
                  <Text style={dynamicStyles.activeSessionTitle}>Active for Messaging</Text>
                  <Text style={dynamicStyles.activeSessionName}>
                    {sessions.find(s => s.session_id === activeSessionId)?.session_name || 'Unknown Session'}
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={() => setShowConnectionModal(true)}
                  style={dynamicStyles.changeSessionButton}
                  icon="swap-horizontal"
                  compact
                >
                  Change
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Stats Card */}
        {renderStatsCard()}

        {/* Sessions List */}
        <View style={dynamicStyles.sessionsContainer}>
          <View style={dynamicStyles.sessionsHeader}>
            <Text style={dynamicStyles.sessionsTitle}>Your Sessions</Text>
            <Text style={dynamicStyles.sessionsSubtitle}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} configured
            </Text>
          </View>

          {loading ? (
            <View style={dynamicStyles.loadingContainer}>
              <ProgressBar indeterminate color="#667eea" />
              <Text style={dynamicStyles.loadingText}>Loading sessions...</Text>
            </View>
          ) : sessions.length === 0 ? (
            <Card style={dynamicStyles.emptyStateCard}>
              <Card.Content style={dynamicStyles.emptyStateContent}>
                <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
                <Title style={dynamicStyles.emptyStateTitle}>No Sessions Yet</Title>
                <Paragraph style={dynamicStyles.emptyStateText}>
                  Create your first WhatsApp session to start managing multiple accounts
                </Paragraph>
                <Button
                  mode="contained"
                  onPress={() => setShowCreateModal(true)}
                  style={dynamicStyles.createFirstButton}
                  icon="add"
                >
                  Create First Session
                </Button>
              </Card.Content>
            </Card>
          ) : (
            sessions.map((session, index) => renderSessionCard(session, index))
          )}
        </View>
      </ScrollView>

      {/* Create Session Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => setShowCreateModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <Title style={dynamicStyles.modalTitle}>Create New Session</Title>
            
            <TextInput
              label="Session Name"
              value={newSessionData.name}
              onChangeText={(text) => setNewSessionData({ ...newSessionData, name: text })}
              placeholder="e.g., Business Account, Support Team"
              style={dynamicStyles.modalInput}
              mode="outlined"
            />
            
            <TextInput
              label="Session Alias (Optional)"
              value={newSessionData.alias}
              onChangeText={(text) => setNewSessionData({ ...newSessionData, alias: text })}
              placeholder="e.g., MB, ST, DS"
              style={dynamicStyles.modalInput}
              mode="outlined"
            />
            
            <TextInput
              label="Phone Number (Optional)"
              value={newSessionData.phoneNumber}
              onChangeText={(text) => setNewSessionData({ ...newSessionData, phoneNumber: text })}
              placeholder="+972501234567"
              style={dynamicStyles.modalInput}
              mode="outlined"
              keyboardType="phone-pad"
            />
            
            <View style={dynamicStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowCreateModal(false)}
                style={dynamicStyles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={createNewSession}
                style={dynamicStyles.modalButton}
                icon="plus"
              >
                Create Session
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Session Details Modal */}
      <Portal>
        <Modal
          visible={showSessionModal}
          onDismiss={() => setShowSessionModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <Title style={dynamicStyles.modalTitle}>
              {selectedSession?.session_name} Settings
            </Title>
            
            {selectedSession && (
              <View style={dynamicStyles.sessionDetailsModal}>
                <View style={dynamicStyles.detailRowModal}>
                  <Text style={dynamicStyles.detailLabel}>Status:</Text>
                  <View style={dynamicStyles.statusContainer}>
                    <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor(selectedSession.status) }]} />
                    <Text style={dynamicStyles.statusText}>{selectedSession.status}</Text>
                  </View>
                </View>
                
                <View style={dynamicStyles.detailRowModal}>
                  <Text style={dynamicStyles.detailLabel}>Type:</Text>
                  <Text style={dynamicStyles.detailValue}>{selectedSession.connection_type}</Text>
                </View>
                
                <View style={dynamicStyles.detailRowModal}>
                  <Text style={dynamicStyles.detailLabel}>Created:</Text>
                  <Text style={dynamicStyles.detailValue}>
                    {new Date(selectedSession.created_at).toLocaleDateString()}
                  </Text>
                </View>
                
                {selectedSession.phone_number && (
                  <View style={dynamicStyles.detailRowModal}>
                    <Text style={dynamicStyles.detailLabel}>Phone:</Text>
                    <Text style={dynamicStyles.detailValue}>{selectedSession.phone_number}</Text>
                  </View>
                )}
              </View>
            )}
            
            <View style={dynamicStyles.modalActions}>
              <Button
                mode="contained"
                onPress={() => setShowSessionModal(false)}
                style={dynamicStyles.modalButton}
              >
                Close
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Session Selection Modal */}
      <Portal>
        <Modal
          visible={showConnectionModal}
          onDismiss={() => setShowConnectionModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <Title style={dynamicStyles.modalTitle}>Select Session for Messaging</Title>
            
            <Text style={dynamicStyles.modalSubtitle}>
              Choose which WhatsApp session to use for sending messages:
            </Text>
            
            <View style={dynamicStyles.sessionSelectionList}>
              {sessions.map((session) => {
                const isCurrentlyActive = session.session_id === activeSessionId;
                const connectionStatus = getConnectionStatus(session.session_id);
                const isConnected = connectionStatus.isConnected;
                
                return (
                  <TouchableOpacity
                    key={session.session_id}
                    style={[
                      dynamicStyles.sessionSelectionItem,
                      isCurrentlyActive && dynamicStyles.sessionSelectionItemActive
                    ]}
                    onPress={() => {
                      selectSessionForMessaging(session.session_id);
                      setShowConnectionModal(false);
                    }}
                  >
                    <View style={dynamicStyles.sessionSelectionInfo}>
                      <Text style={dynamicStyles.sessionSelectionName}>{session.session_name}</Text>
                      <Text style={dynamicStyles.sessionSelectionAlias}>{session.session_alias}</Text>
                    </View>
                    
                    <View style={dynamicStyles.sessionSelectionStatus}>
                      {isCurrentlyActive && (
                        <Chip icon="check" style={dynamicStyles.activeChip}>
                          Active
                        </Chip>
                      )}
                      
                      <View style={dynamicStyles.connectionIndicator}>
                        <View style={[
                          dynamicStyles.connectionDot,
                          { backgroundColor: isConnected ? '#25D366' : '#FF3B30' }
                        ]} />
                        <Text style={dynamicStyles.connectionText}>
                          {isConnected ? 'Connected' : 'Disconnected'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={dynamicStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowConnectionModal(false)}
                style={dynamicStyles.modalButton}
              >
                Cancel
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* QR Code Zoom Modal */}
      <RNModal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={dynamicStyles.qrModalOverlay}>
          <View style={dynamicStyles.qrModalContent}>
            <View style={dynamicStyles.qrModalHeader}>
              <Text style={dynamicStyles.qrModalTitle}>WhatsApp QR Code</Text>
              <TouchableOpacity
                onPress={() => setShowQRModal(false)}
                style={dynamicStyles.qrModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedQRCode && (
              <View style={dynamicStyles.qrModalBody}>
                <Text style={dynamicStyles.qrModalSubtitle}>
                  Session: {sessions.find(s => s.session_id === selectedQRCode.sessionId)?.session_name || selectedQRCode.sessionId}
                </Text>
                
                <View style={dynamicStyles.qrModalQRContainer}>
                  {(() => {
                    if (!QRCode) {
                      return (
                        <View style={dynamicStyles.qrModalErrorContainer}>
                          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
                          <Text style={dynamicStyles.qrModalErrorText}>QR Library Unavailable</Text>
                          <Text style={dynamicStyles.qrModalErrorSubtext}>Please install react-native-qrcode-svg</Text>
                        </View>
                      );
                    }
                    
                    try {
                      return (
                        <QRCode
                          value={selectedQRCode.qrCode || ''}
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
                      );
                    } catch (error) {
                      console.error('Error rendering modal QR code:', error);
                      return (
                        <View style={dynamicStyles.qrModalErrorContainer}>
                          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
                          <Text style={dynamicStyles.qrModalErrorText}>QR Code Error</Text>
                          <Text style={dynamicStyles.qrModalErrorSubtext}>Unable to display QR code</Text>
                        </View>
                      );
                    }
                  })()}
                </View>
                
                <Text style={dynamicStyles.qrModalInstructions}>
                  Open WhatsApp on your phone and scan this QR code to connect
                </Text>
                
                <View style={dynamicStyles.qrModalActions}>
                  <Button
                    mode="outlined"
                    onPress={copyQRCodeData}
                    style={[dynamicStyles.qrModalActionButton, dynamicStyles.qrModalActionButtonLeft]}
                    icon="copy"
                  >
                    Copy Data
                  </Button>
                  <Button
                    mode="contained"
                    onPress={shareQRCode}
                    style={[dynamicStyles.qrModalActionButton, dynamicStyles.qrModalActionButtonRight]}
                    icon="share"
                  >
                    Share
                  </Button>
                </View>
              </View>
            )}
          </View>
        </View>
      </RNModal>

      {/* FAB for creating new sessions */}
      {sessions.length > 0 && (
        <FAB
          icon="plus"
          style={dynamicStyles.fab}
          onPress={() => setShowCreateModal(true)}
          label="New Session"
        />
      )}
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 22,
  },
  statsCardContainer: {
    margin: 20,
    marginTop: 0,
  },
  statsGradient: {
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statsCard: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  sessionsContainer: {
    padding: 20,
  },
  sessionsHeader: {
    marginBottom: 20,
  },
  sessionsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sessionsSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  sessionCardContainer: {
    marginBottom: 16,
  },
  sessionCard: {
    elevation: 4,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  defaultSessionCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  activeSessionCard: {
    borderWidth: 2,
    borderColor: '#4CAF50', // A green border for active sessions
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginRight: 8,
  },
  defaultChip: {
    backgroundColor: '#FFD700',
  },
  activeChip: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  sessionAlias: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  sessionStatus: {
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sessionDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginLeft: 8,
  },
  sessionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  connectButton: {
    backgroundColor: '#25D366',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
  },
  selectButton: {
    backgroundColor: '#4CAF50',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  emptyStateCard: {
    marginTop: 40,
    elevation: 0,
    backgroundColor: theme.colors.surfaceVariant,
  },
  emptyStateContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createFirstButton: {
    borderRadius: 25,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    margin: 20,
    borderRadius: 16,
    padding: 0,
    elevation: 8,
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  sessionDetailsModal: {
    marginBottom: 24,
  },
  detailRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  detailValue: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionControls: {
    marginTop: 16,
    marginBottom: 16,
  },
  activeSessionInfoCard: {
    margin: 20,
    marginTop: 0,
    marginBottom: 10,
    backgroundColor: theme.colors.primaryContainer,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  activeSessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeSessionText: {
    flex: 1,
    marginLeft: 12,
  },
  activeSessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onPrimaryContainer,
    marginBottom: 2,
  },
  activeSessionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onPrimaryContainer,
  },
  changeSessionButton: {
    borderColor: theme.colors.primary,
  },
  modalSubtitle: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  sessionSelectionList: {
    marginBottom: 20,
  },
  sessionSelectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  sessionSelectionItemActive: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.primary,
  },
  sessionSelectionInfo: {
    flex: 1,
  },
  sessionSelectionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  sessionSelectionAlias: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  sessionSelectionStatus: {
    alignItems: 'flex-end',
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  // QR Code Styles
  qrCodeContainer: {
    marginTop: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  qrCodeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 12,
    textAlign: 'center',
  },
  qrCodeWrapper: {
    position: 'relative',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  qrCodeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  qrCodeTapText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
    fontWeight: '600',
  },
  qrCodeInstructions: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  generateQRButton: {
    marginTop: 16,
    borderRadius: 25,
  },
  qrCodeErrorContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
  },
  qrCodeErrorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 8,
    textAlign: 'center',
  },
  // QR Modal Styles
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 0,
    width: '90%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  qrModalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceVariant,
  },
  qrModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  qrModalSubtitle: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrModalQRContainer: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    minHeight: 290,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalErrorContainer: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 16,
  },
  qrModalErrorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  qrModalErrorSubtext: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
    textAlign: 'center',
  },
  qrModalInstructions: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  qrModalActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  qrModalActionButton: {
    borderRadius: 25,
    flex: 1,
  },
  qrModalActionButtonLeft: {
    borderColor: '#667eea',
  },
  qrModalActionButtonRight: {
    backgroundColor: '#667eea',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#667eea',
  },
});

export default SessionManagementScreen;

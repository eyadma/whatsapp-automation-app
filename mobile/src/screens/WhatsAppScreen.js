import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Button, TextInput, Divider, Chip, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { AppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';
import WebCompatibleButton from '../web/components/WebCompatibleButton';
import useServerSideConnection from '../hooks/useServerSideConnection';
import NotificationDebugger from '../components/NotificationDebugger';

const WhatsAppScreen = ({ navigation }) => {
  const { userId, theme, t } = useContext(AppContext);
  const paperTheme = useTheme();
  
  // Use web-compatible button on web, regular button on mobile
  const CompatibleButton = Platform.OS === 'web' ? WebCompatibleButton : Button;
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  
  // Use the new server-side connection hook
  const {
    connectionStatus,
    initiateConnection,
    disconnectSession,
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

      setSessions(sessionsData || []);
      
      // Set first session as default if none selected
      if (sessionsData && sessionsData.length > 0 && !selectedSession) {
        setSelectedSession(sessionsData[0]);
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
      Alert.alert('Error', 'Please select a session first');
      return;
    }

    try {
      console.log('🔄 Initiating connection for session:', selectedSession.session_id);
      await initiateConnection();
    } catch (error) {
      console.error('Error connecting:', error);
      Alert.alert('Error', 'Failed to connect to WhatsApp');
    }
  };

  const handleDisconnect = async () => {
    if (!selectedSession) {
      Alert.alert('Error', 'No session selected');
      return;
    }

    try {
      console.log('🔄 Disconnecting session:', selectedSession.session_id);
      await disconnectSession();
    } catch (error) {
      console.error('Error disconnecting:', error);
      Alert.alert('Error', 'Failed to disconnect from WhatsApp');
    }
  };

  const getStatusColor = () => {
    if (isConnected) return '#4CAF50';
    if (isConnecting) return '#FF9800';
    if (hasError) return '#F44336';
    return '#9E9E9E';
  };

  const getStatusText = () => {
    if (isConnected) return 'Connected';
    if (isConnecting) return 'Connecting...';
    if (hasError) return 'Error';
    return 'Disconnected';
  };

  const renderQRCode = () => {
    if (connectionStatus?.qrCode) {
      return (
        <View style={styles.qrContainer}>
          <Text style={styles.qrTitle}>Scan QR Code with WhatsApp</Text>
          <QRCode
            value={connectionStatus.qrCode}
            size={200}
            backgroundColor="white"
            color="black"
          />
          <Text style={styles.qrInstructions}>
            Open WhatsApp → Settings → Linked Devices → Link a Device
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderConnectionStatus = () => {
    return (
      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
          
          {selectedSession && (
            <Text style={styles.sessionInfo}>
              Session: {selectedSession.session_name}
            </Text>
          )}
          
          {lastUpdate && (
            <Text style={styles.lastUpdate}>
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </Text>
          )}
          
          {hasError && (
            <Text style={styles.errorText}>
              Error: {connectionStatus?.error || 'Unknown error'}
            </Text>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderSessionSelector = () => {
    if (sessions.length === 0) {
      return (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.noSessionsText}>
              No WhatsApp sessions found. Create a session first.
            </Text>
            <CompatibleButton
              mode="contained"
              onPress={() => navigation.navigate('SessionManagement')}
              style={styles.button}
            >
              Manage Sessions
            </CompatibleButton>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Select Session:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.session_id}
                style={[
                  styles.sessionChip,
                  selectedSession?.session_id === session.session_id && styles.selectedSessionChip
                ]}
                onPress={() => setSelectedSession(session)}
              >
                <Text style={[
                  styles.sessionChipText,
                  selectedSession?.session_id === session.session_id && styles.selectedSessionChipText
                ]}>
                  {session.session_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card.Content>
      </Card>
    );
  };

  const renderConnectionControls = () => {
    if (!selectedSession) return null;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Connection Controls:</Text>
          
          <View style={styles.buttonRow}>
            <CompatibleButton
              mode="contained"
              onPress={handleConnect}
              disabled={isConnecting || isConnected}
              style={[styles.button, styles.connectButton]}
              icon="wifi"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </CompatibleButton>
            
            <CompatibleButton
              mode="outlined"
              onPress={handleDisconnect}
              disabled={!isConnected}
              style={[styles.button, styles.disconnectButton]}
              icon="wifi-off"
            >
              Disconnect
            </CompatibleButton>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderDebugger = () => {
    if (!showDebugger) return null;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.debuggerHeader}>
            <Text style={styles.sectionTitle}>🔔 Notification Debugger</Text>
            <CompatibleButton
              mode="text"
              onPress={() => setShowDebugger(false)}
              style={styles.closeButton}
            >
              Close
            </CompatibleButton>
          </View>
          <NotificationDebugger />
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading sessions...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WhatsApp Connection</Text>
        <CompatibleButton
          mode="text"
          onPress={() => setShowDebugger(!showDebugger)}
          style={styles.debugButton}
          icon="bug"
        >
          Debug
        </CompatibleButton>
      </View>

      {renderConnectionStatus()}
      {renderSessionSelector()}
      {renderConnectionControls()}
      {renderQRCode()}
      {renderDebugger()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  debugButton: {
    minWidth: 80,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  statusCard: {
    margin: 16,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sessionInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  noSessionsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  sessionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  selectedSessionChip: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  sessionChipText: {
    fontSize: 14,
    color: '#333',
  },
  selectedSessionChipText: {
    color: 'white',
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    borderColor: '#F44336',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    elevation: 2,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  debuggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    minWidth: 60,
  },
});

export default WhatsAppScreen;

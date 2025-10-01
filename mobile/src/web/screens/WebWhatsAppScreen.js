import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';

const WebWhatsAppScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading sessions:', error);
        Alert.alert('Error', 'Failed to load sessions');
        return;
      }

      setSessions(data || []);
      
      // Set the first session as selected by default
      if (data && data.length > 0) {
        setSelectedSession(data[0]);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (session) => {
    setSelectedSession(session);
    setShowQRCode(false);
    setQrCodeData(null);
  };

  const handleConnectSession = async (session) => {
    try {
      // Simulate connection process
      Alert.alert(
        'Connect Session',
        `Connect to ${session.session_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect',
            onPress: async () => {
              try {
                // Update session status to connecting
                const { error } = await supabase
                  .from('whatsapp_sessions')
                  .update({ status: 'connecting' })
                  .eq('id', session.id);

                if (error) {
                  console.error('Error updating session status:', error);
                  return;
                }

                // Simulate QR code generation
                setQrCodeData({
                  sessionId: session.id,
                  qrCode: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMwMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIFFSIGNvZGUgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==',
                });
                setShowQRCode(true);
                
                Alert.alert('Connection Initiated', 'Please scan the QR code with your WhatsApp app');
              } catch (error) {
                console.error('Error connecting session:', error);
                Alert.alert('Error', 'Failed to connect session');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error connecting session:', error);
      Alert.alert('Error', 'Failed to connect session');
    }
  };

  const handleDisconnectSession = async (session) => {
    Alert.alert(
      'Disconnect Session',
      `Disconnect ${session.session_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('whatsapp_sessions')
                .update({ status: 'disconnected' })
                .eq('id', session.id);

              if (error) {
                console.error('Error disconnecting session:', error);
                Alert.alert('Error', 'Failed to disconnect session');
                return;
              }

              Alert.alert('Success', 'Session disconnected successfully');
              setShowQRCode(false);
              setQrCodeData(null);
              loadSessions();
            } catch (error) {
              console.error('Error disconnecting session:', error);
              Alert.alert('Error', 'Failed to disconnect session');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'disconnected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          WhatsApp Connection
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Manage your WhatsApp sessions and connections
        </WebCompatibleParagraph>
      </View>

      {/* Sessions List */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Your Sessions ({sessions.length})
          </WebCompatibleTitle>
          
          {sessions.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleParagraph style={dynamicStyles.emptyText}>
                No sessions found. Create a session to get started.
              </WebCompatibleParagraph>
              <WebCompatibleButton
                mode="contained"
                onPress={() => navigation.navigate('Sessions')}
                style={dynamicStyles.createButton}
              >
                Create Session
              </WebCompatibleButton>
            </View>
          ) : (
            <View style={dynamicStyles.sessionsList}>
              {sessions.map(session => (
                <View key={session.id} style={dynamicStyles.sessionItem}>
                  <View style={dynamicStyles.sessionInfo}>
                    <Text style={dynamicStyles.sessionName}>
                      {session.session_name}
                    </Text>
                    {session.session_alias && (
                      <Text style={dynamicStyles.sessionAlias}>
                        Alias: {session.session_alias}
                      </Text>
                    )}
                    {session.phone_number && (
                      <Text style={dynamicStyles.sessionPhone}>
                        Phone: {session.phone_number}
                      </Text>
                    )}
                    <View style={dynamicStyles.sessionStatus}>
                      <View style={[
                        dynamicStyles.statusDot,
                        { backgroundColor: getStatusColor(session.status) }
                      ]} />
                      <Text style={dynamicStyles.statusText}>
                        {getStatusText(session.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={dynamicStyles.sessionActions}>
                    {session.status === 'disconnected' ? (
                      <WebCompatibleButton
                        mode="contained"
                        onPress={() => handleConnectSession(session)}
                        style={dynamicStyles.actionButton}
                      >
                        Connect
                      </WebCompatibleButton>
                    ) : (
                      <WebCompatibleButton
                        mode="outlined"
                        onPress={() => handleDisconnectSession(session)}
                        style={dynamicStyles.actionButton}
                      >
                        Disconnect
                      </WebCompatibleButton>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Selected Session Details */}
      {selectedSession && (
        <WebCompatibleCard style={dynamicStyles.section}>
          <WebCompatibleCard.Content>
            <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
              Session Details
            </WebCompatibleTitle>
            
            <View style={dynamicStyles.detailsContainer}>
              <View style={dynamicStyles.detailRow}>
                <Text style={dynamicStyles.detailLabel}>Session Name:</Text>
                <Text style={dynamicStyles.detailValue}>{selectedSession.session_name}</Text>
              </View>
              {selectedSession.session_alias && (
                <View style={dynamicStyles.detailRow}>
                  <Text style={dynamicStyles.detailLabel}>Alias:</Text>
                  <Text style={dynamicStyles.detailValue}>{selectedSession.session_alias}</Text>
                </View>
              )}
              {selectedSession.phone_number && (
                <View style={dynamicStyles.detailRow}>
                  <Text style={dynamicStyles.detailLabel}>Phone:</Text>
                  <Text style={dynamicStyles.detailValue}>{selectedSession.phone_number}</Text>
                </View>
              )}
              <View style={dynamicStyles.detailRow}>
                <Text style={dynamicStyles.detailLabel}>Status:</Text>
                <View style={dynamicStyles.statusContainer}>
                  <View style={[
                    dynamicStyles.statusDot,
                    { backgroundColor: getStatusColor(selectedSession.status) }
                  ]} />
                  <Text style={dynamicStyles.detailValue}>
                    {getStatusText(selectedSession.status)}
                  </Text>
                </View>
              </View>
              <View style={dynamicStyles.detailRow}>
                <Text style={dynamicStyles.detailLabel}>Created:</Text>
                <Text style={dynamicStyles.detailValue}>
                  {new Date(selectedSession.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>
      )}

      {/* QR Code Display */}
      {showQRCode && qrCodeData && (
        <WebCompatibleCard style={dynamicStyles.section}>
          <WebCompatibleCard.Content>
            <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
              QR Code for Connection
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.qrDescription}>
              Scan this QR code with your WhatsApp app to connect
            </WebCompatibleParagraph>
            
            <View style={dynamicStyles.qrContainer}>
              <img 
                src={qrCodeData.qrCode} 
                alt="WhatsApp QR Code"
                style={dynamicStyles.qrImage}
              />
            </View>
            
            <View style={dynamicStyles.qrActions}>
              <WebCompatibleButton
                mode="outlined"
                onPress={() => setShowQRCode(false)}
                style={dynamicStyles.qrButton}
              >
                Close
              </WebCompatibleButton>
            </View>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>
      )}

      {/* Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Actions
          </WebCompatibleTitle>
          
          <View style={dynamicStyles.actionsContainer}>
            <WebCompatibleButton
              mode="contained"
              onPress={() => navigation.navigate('Sessions')}
              style={dynamicStyles.actionButton}
            >
              Manage Sessions
            </WebCompatibleButton>
            <WebCompatibleButton
              mode="outlined"
              onPress={loadSessions}
              style={dynamicStyles.actionButton}
            >
              Refresh
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>
    </ScrollView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  header: {
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  emptyContainer: {
    textAlign: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
  createButton: {
    minWidth: 150,
  },
  sessionsList: {
    gap: 16,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  sessionAlias: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  sessionPhone: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  sessionStatus: {
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
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  sessionActions: {
    marginLeft: 16,
  },
  actionButton: {
    minWidth: 100,
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '400',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrImage: {
    width: 200,
    height: 200,
    border: '1px solid #e0e0e0',
    borderRadius: 8,
  },
  qrActions: {
    alignItems: 'center',
  },
  qrButton: {
    minWidth: 100,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
});

export default WebWhatsAppScreen;

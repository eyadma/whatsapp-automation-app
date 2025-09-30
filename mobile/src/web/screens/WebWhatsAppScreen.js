import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, Platform, Alert } from 'react-native';
import { Card, Title, Paragraph, Chip, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../context/AppContext';
import { enhancedSessionAPI } from '../../services/enhancedSessionAPI';
import WebCompatibleButton from '../components/WebCompatibleButton';

const WebWhatsAppScreen = ({ navigation }) => {
  const { userId, theme, t } = useContext(AppContext);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionSwitching, setSessionSwitching] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const result = await enhancedSessionAPI.getSessions(userId);
      if (result.success) {
        setSessions(result.data.sessions || []);
        // Set first session as default if none selected
        if (result.data.sessions && result.data.sessions.length > 0 && !selectedSession) {
          setSelectedSession(result.data.sessions[0]);
        }
      } else {
        console.error('Failed to load sessions:', result.error);
        Alert.alert(t('error'), result.error || 'Failed to load sessions');
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert(t('error'), 'Error loading sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSession = async (session) => {
    try {
      setSessionSwitching(true);
      const result = await enhancedSessionAPI.connectSession(session.session_id);
      if (result.success) {
        Alert.alert(t('success'), t('sessionConnectionInitiated'));
        // Load QR code
        await loadQRCode(session);
      } else {
        Alert.alert(t('error'), result.error || 'Failed to connect session');
      }
    } catch (error) {
      console.error('Error connecting session:', error);
      Alert.alert(t('error'), 'Error connecting session');
    } finally {
      setSessionSwitching(false);
    }
  };

  const handleDisconnectSession = async (session) => {
    try {
      const result = await enhancedSessionAPI.disconnectSession(session.session_id);
      if (result.success) {
        Alert.alert(t('success'), t('sessionDisconnectedSuccessfully'));
        await loadSessions();
      } else {
        Alert.alert(t('error'), result.error || 'Failed to disconnect session');
      }
    } catch (error) {
      console.error('Error disconnecting session:', error);
      Alert.alert(t('error'), 'Error disconnecting session');
    }
  };

  const handleDeleteSession = async (session) => {
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
              const result = await enhancedSessionAPI.deleteSession(session.session_id);
              if (result.success) {
                Alert.alert(t('success'), t('sessionDeletedSuccessfully'));
                await loadSessions();
                if (selectedSession?.session_id === session.session_id) {
                  setSelectedSession(null);
                }
              } else {
                Alert.alert(t('error'), result.error || 'Failed to delete session');
              }
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert(t('error'), 'Error deleting session');
            }
          }
        }
      ]
    );
  };

  const loadQRCode = async (session) => {
    try {
      setQrLoading(true);
      const result = await enhancedSessionAPI.getQRCode(session.session_id);
      if (result.success) {
        setQrCodeData(result.data.qrCode);
        setShowQRModal(true);
      } else {
        Alert.alert(t('error'), result.error || 'Failed to load QR code');
      }
    } catch (error) {
      console.error('Error loading QR code:', error);
      Alert.alert(t('error'), 'Error loading QR code');
    } finally {
      setQrLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#F44336';
      case 'connecting':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'connected':
        return t('connected');
      case 'disconnected':
        return t('disconnected');
      case 'connecting':
        return t('connecting');
      default:
        return t('unknown');
    }
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme === 'dark' ? '#121212' : '#f5f5f5',
      padding: 16,
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme === 'dark' ? '#fff' : '#000',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme === 'dark' ? '#ccc' : '#666',
    },
    sessionsContainer: {
      marginBottom: 20,
    },
    sessionCard: {
      marginBottom: 12,
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
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
      color: theme === 'dark' ? '#fff' : '#000',
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    statusText: {
      fontSize: 14,
      color: theme === 'dark' ? '#ccc' : '#666',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    qrModal: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    qrContent: {
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
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
      color: theme === 'dark' ? '#fff' : '#000',
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
      color: theme === 'dark' ? '#ccc' : '#666',
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
      color: theme === 'dark' ? '#ccc' : '#666',
      textAlign: 'center',
      marginBottom: 8,
    },
    noSessionsSubtext: {
      fontSize: 14,
      color: theme === 'dark' ? '#999' : '#999',
      textAlign: 'center',
      marginBottom: 20,
    },
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={{ marginTop: 10, color: theme === 'dark' ? '#fff' : '#000' }}>
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
                    <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor(session.status) }]} />
                    <Text style={dynamicStyles.statusText}>
                      {getStatusText(session.status)}
                    </Text>
                  </View>
                </View>

                {session.session_alias && (
                  <Paragraph style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                    {t('alias')}: {session.session_alias}
                  </Paragraph>
                )}

                {session.phone_number && (
                  <Paragraph style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                    {t('phone')}: {session.phone_number}
                  </Paragraph>
                )}

                <View style={dynamicStyles.buttonContainer}>
                  {session.status?.toLowerCase() === 'disconnected' ? (
                    <WebCompatibleButton
                      onPress={() => handleConnectSession(session)}
                      mode="contained"
                      icon="link"
                      disabled={sessionSwitching}
                    >
                      {t('connect')}
                    </WebCompatibleButton>
                  ) : (
                    <WebCompatibleButton
                      onPress={() => handleDisconnectSession(session)}
                      mode="outlined"
                      icon="link-off"
                    >
                      {t('disconnect')}
                    </WebCompatibleButton>
                  )}

                  <WebCompatibleButton
                    onPress={() => loadQRCode(session)}
                    mode="outlined"
                    icon="qr-code"
                    disabled={qrLoading}
                  >
                    {t('generateQRCode')}
                  </WebCompatibleButton>

                  <WebCompatibleButton
                    onPress={() => handleDeleteSession(session)}
                    mode="outlined"
                    icon="delete"
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
                <ActivityIndicator size="large" color="#25D366" />
                <Text style={{ marginTop: 10, color: theme === 'dark' ? '#ccc' : '#666' }}>
                  {t('loading')}
                </Text>
              </View>
            ) : qrCodeData ? (
              <View style={dynamicStyles.qrCode}>
                <Text style={{ color: '#000', fontSize: 12 }}>
                  QR Code: {qrCodeData.substring(0, 50)}...
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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import useServerSideConnection from '../hooks/useServerSideConnection';

/**
 * Example component showing how to use the server-side connection hook
 * with automatic status change notifications
 */
const WhatsAppConnectionWithNotifications = ({ userId, sessionId = 'default' }) => {
  const theme = useTheme();
  
  const {
    connectionStatus,
    initiateConnection,
    disconnectSession,
    isConnected,
    isConnecting,
    hasError,
    lastUpdate
  } = useServerSideConnection(userId, sessionId);

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return theme.colors.primary;
      case 'connecting':
      case 'reconnecting':
        return theme.colors.secondary;
      case 'failed':
        return theme.colors.error;
      case 'disconnected':
        return theme.colors.outline;
      default:
        return theme.colors.outline;
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return 'checkmark-circle';
      case 'connecting':
      case 'reconnecting':
        return 'refresh-circle';
      case 'failed':
        return 'close-circle';
      case 'disconnected':
        return 'stop-circle';
      default:
        return 'help-circle';
    }
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Ionicons 
            name={getStatusIcon()} 
            size={24} 
            color={getStatusColor()} 
            style={styles.icon}
          />
          <Text style={[styles.title, { color: getStatusColor() }]}>
            WhatsApp Connection
          </Text>
        </View>
        
        <Text style={styles.sessionId}>
          Session: {sessionId}
        </Text>
        
        <Text style={styles.status}>
          Status: {connectionStatus.status}
        </Text>
        
        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Last Update: {new Date(lastUpdate).toLocaleTimeString()}
          </Text>
        )}
        
        {hasError && (
          <Text style={[styles.error, { color: theme.colors.error }]}>
            Error: {connectionStatus.error}
          </Text>
        )}
        
        <View style={styles.buttons}>
          {!isConnected && !isConnecting && (
            <Button
              mode="contained"
              onPress={initiateConnection}
              style={styles.button}
              icon="play"
            >
              Connect
            </Button>
          )}
          
          {isConnecting && (
            <Button
              mode="outlined"
              disabled
              style={styles.button}
              icon="loading"
            >
              Connecting...
            </Button>
          )}
          
          {isConnected && (
            <Button
              mode="outlined"
              onPress={disconnectSession}
              style={styles.button}
              icon="stop"
              buttonColor={theme.colors.errorContainer}
              textColor={theme.colors.error}
            >
              Disconnect
            </Button>
          )}
        </View>
        
        <Text style={styles.note}>
          💡 Status change notifications will be sent automatically
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sessionId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  error: {
    fontSize: 14,
    marginBottom: 8,
  },
  buttons: {
    marginTop: 16,
  },
  button: {
    marginBottom: 8,
  },
  note: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default WhatsAppConnectionWithNotifications;

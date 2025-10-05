import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useServerSideConnection } from '../hooks/useServerSideConnection';

const WhatsAppStatusBar = ({ userId, onPress }) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  
  // Use the new server-side connection hook
  const { availableSessions, isConnected, isConnecting } = useServerSideConnection(userId, 'default');

  useEffect(() => {
    if (!userId) return;

    // Show the status bar if there are any sessions
    if (availableSessions && Object.keys(availableSessions).length > 0) {
      setIsVisible(true);
    }
  }, [userId, availableSessions]);

  const getOverallStatus = () => {
    if (!availableSessions || Object.keys(availableSessions).length === 0) return 'unknown';
    
    const statusValues = Object.values(availableSessions);
    const hasConnected = statusValues.some(s => s.connected);
    const hasConnecting = statusValues.some(s => s.connecting);
    const hasFailed = statusValues.some(s => s.status === 'failed');
    
    if (hasConnected && !hasConnecting && !hasFailed) return 'connected';
    if (hasConnecting) return 'connecting';
    if (hasFailed) return 'failed';
    return 'disconnected';
  };

  const getStatusInfo = () => {
    const overallStatus = getOverallStatus();
    
    switch (overallStatus) {
      case 'connected':
        return { 
          icon: 'checkmark-circle', 
          color: '#4CAF50', 
          text: 'WhatsApp Connected',
          bgColor: '#E8F5E8'
        };
      case 'disconnected':
        return { 
          icon: 'close-circle', 
          color: '#F44336', 
          text: 'WhatsApp Disconnected',
          bgColor: '#FFEBEE'
        };
      case 'connecting':
        return { 
          icon: 'refresh-circle', 
          color: '#FF9800', 
          text: 'WhatsApp Connecting...',
          bgColor: '#FFF3E0'
        };
      case 'failed':
        return { 
          icon: 'alert-circle', 
          color: '#F44336', 
          text: 'WhatsApp Connection Failed',
          bgColor: '#FFEBEE'
        };
      default:
        return { 
          icon: 'help-circle', 
          color: '#666', 
          text: 'WhatsApp Status Unknown',
          bgColor: '#F5F5F5'
        };
    }
  };

  const getSessionCount = () => {
    if (!availableSessions) return '0/0';
    const totalSessions = Object.keys(availableSessions).length;
    const connectedSessions = Object.values(availableSessions).filter(s => s.connected).length;
    return `${connectedSessions}/${totalSessions}`;
  };

  if (!isVisible) {
    return null;
  }

  const statusInfo = getStatusInfo();
  const overallStatus = getOverallStatus();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: statusInfo.bgColor,
          borderBottomColor: statusInfo.color,
        },
      ]}
      onPress={() => {
        if (onPress) {
          onPress({ availableSessions, overallStatus });
        }
      }}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Ionicons 
            name={statusInfo.icon} 
            size={20} 
            color={statusInfo.color} 
            style={styles.icon}
          />
          <Text style={[styles.text, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>
        
        <View style={styles.rightSection}>
          <Text style={[styles.sessionCount, { color: statusInfo.color }]}>
            {getSessionCount()} sessions
          </Text>
          <Ionicons 
            name="chevron-forward" 
            size={16} 
            color={statusInfo.color} 
            style={styles.chevron}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 2,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionCount: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  chevron: {
    marginLeft: 4,
  },
});

export default WhatsAppStatusBar;

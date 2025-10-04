import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import whatsappStatusService from '../services/whatsappStatusService';

const WhatsAppStatusBar = ({ userId, onPress }) => {
  const theme = useTheme();
  const [statuses, setStatuses] = useState({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Start monitoring
    whatsappStatusService.startMonitoring(userId);

    // Add status listener
    const statusListener = (eventType, data) => {
      if (eventType === 'status_change') {
        setStatuses(prev => ({
          ...prev,
          [data.sessionId]: data
        }));
        setIsVisible(true);
      }
    };

    whatsappStatusService.addStatusListener('statusBar', statusListener);

    // Get initial status
    whatsappStatusService.checkStatus(userId).then(initialStatus => {
      if (initialStatus && initialStatus.sessions) {
        const sessionStatuses = {};
        Object.entries(initialStatus.sessions).forEach(([sessionId, status]) => {
          sessionStatuses[sessionId] = {
            userId,
            sessionId,
            status,
            timestamp: new Date().toISOString()
          };
        });
        setStatuses(sessionStatuses);
        setIsVisible(true);
      }
    }).catch(error => {
      console.error('Error getting initial status:', error);
    });

    return () => {
      whatsappStatusService.removeStatusListener('statusBar', statusListener);
    };
  }, [userId]);

  const getOverallStatus = () => {
    const statusValues = Object.values(statuses);
    if (statusValues.length === 0) return 'unknown';
    
    const hasConnected = statusValues.some(s => s.status === 'connected');
    const hasReconnecting = statusValues.some(s => s.status === 'reconnecting');
    const hasFailed = statusValues.some(s => s.status === 'failed');
    
    if (hasConnected && !hasReconnecting && !hasFailed) return 'connected';
    if (hasReconnecting) return 'reconnecting';
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
      case 'reconnecting':
        return { 
          icon: 'refresh-circle', 
          color: '#FF9800', 
          text: 'WhatsApp Reconnecting...',
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
    const totalSessions = Object.keys(statuses).length;
    const connectedSessions = Object.values(statuses).filter(s => s.status === 'connected').length;
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
          onPress({ statuses, overallStatus });
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

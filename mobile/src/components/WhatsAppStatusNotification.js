import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import whatsappStatusService from '../services/whatsappStatusService';

const WhatsAppStatusNotification = ({ userId, onPress }) => {
  const theme = useTheme();
  const [status, setStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (!userId) return;

    // Start monitoring
    whatsappStatusService.startMonitoring(userId);

    // Add status listener
    const statusListener = (eventType, data) => {
      if (eventType === 'status_change') {
        setStatus(data);
        showNotification();
      } else if (eventType === 'connection_status') {
        if (data.status === 'error') {
          hideNotification();
        }
      }
    };

    whatsappStatusService.addStatusListener('main', statusListener);

    // Get initial status
    whatsappStatusService.checkStatus(userId).then(initialStatus => {
      if (initialStatus && initialStatus.sessions) {
        // Show notification if any session is not connected
        const hasDisconnectedSessions = Object.values(initialStatus.sessions).some(s => s !== 'connected');
        if (hasDisconnectedSessions) {
          setStatus({
            userId,
            sessionId: 'all',
            status: 'disconnected',
            timestamp: new Date().toISOString()
          });
          showNotification();
        }
      }
    }).catch(error => {
      console.error('Error getting initial status:', error);
    });

    return () => {
      whatsappStatusService.removeStatusListener('main', statusListener);
      whatsappStatusService.stopMonitoring();
    };
  }, [userId]);

  const showNotification = () => {
    setIsVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      )
    ]).start();
  };

  const hideNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
  };

  const getStatusInfo = () => {
    if (!status) return { icon: 'help', color: '#666', text: 'Unknown' };

    switch (status.status) {
      case 'connected':
        return { icon: 'checkmark-circle', color: '#4CAF50', text: 'Connected' };
      case 'disconnected':
        return { icon: 'close-circle', color: '#F44336', text: 'Disconnected' };
      case 'reconnecting':
        return { icon: 'refresh-circle', color: '#FF9800', text: 'Reconnecting...' };
      case 'failed':
        return { icon: 'alert-circle', color: '#F44336', text: 'Connection Failed' };
      default:
        return { icon: 'help-circle', color: '#666', text: 'Unknown' };
    }
  };

  const getSessionName = () => {
    if (!status) return 'WhatsApp';
    if (status.sessionId === 'all') return 'WhatsApp Sessions';
    if (status.sessionId === 'default') return 'Default Session';
    return `Session ${status.sessionId}`;
  };

  if (!isVisible || !status) {
    return null;
  }

  const statusInfo = getStatusInfo();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: statusInfo.color,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => {
          if (onPress) {
            onPress(status);
          }
        }}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.iconContainer,
            { backgroundColor: statusInfo.color },
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <Ionicons name={statusInfo.icon} size={20} color="white" />
        </Animated.View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {getSessionName()}
          </Text>
          <Text style={[styles.status, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={hideNotification}
        >
          <Ionicons name="close" size={20} color={theme.colors.onSurface} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default WhatsAppStatusNotification;

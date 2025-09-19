import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Button, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

const TimeRestrictionMessage = ({ timeRestrictionStatus, onRefresh }) => {
  const theme = useTheme();
  const dynamicStyles = createStyles(theme);

  if (!timeRestrictionStatus) return null;

  const {
    time_restriction_enabled,
    time_restriction_start,
    time_restriction_end,
    currentIsraelTime,
    withinAllowedHours,
    hasUsedMessagingToday,
    last_message_sent_during_window,
    daily_usage_tracked
  } = timeRestrictionStatus;

  // If restrictions are not enabled, don't show the message
  if (!time_restriction_enabled) return null;

  // If user can send messages, don't show the message
  if (timeRestrictionStatus.canSendMessages) return null;

  const getMessage = () => {
    if (withinAllowedHours) {
      return {
        title: "Messages Available",
        message: "You can send messages during business hours.",
        icon: "checkmark-circle",
        color: "#4CAF50"
      };
    }

    if (hasUsedMessagingToday) {
      return {
        title: "Messages Available",
        message: "You can send messages because you used the messaging feature during allowed hours today.",
        icon: "checkmark-circle",
        color: "#4CAF50"
      };
    }

    return {
      title: "Messages Temporarily Unavailable",
      message: `Message sending is only available during business hours (${time_restriction_start} - ${time_restriction_end} Israel time) or after using the messaging feature during those hours.`,
      icon: "time-outline",
      color: "#FF9800"
    };
  };

  const messageInfo = getMessage();

  return (
    <View style={dynamicStyles.container}>
      <Card style={dynamicStyles.card}>
        <Card.Content style={dynamicStyles.content}>
          <View style={dynamicStyles.iconContainer}>
            <Ionicons 
              name={messageInfo.icon} 
              size={48} 
              color={messageInfo.color} 
            />
          </View>
          
          <Text style={dynamicStyles.title}>
            {messageInfo.title}
          </Text>
          
          <Text style={dynamicStyles.message}>
            {messageInfo.message}
          </Text>
          
          <View style={dynamicStyles.infoContainer}>
            <Text style={dynamicStyles.infoLabel}>Current Time (Israel):</Text>
            <Text style={dynamicStyles.infoValue}>{currentIsraelTime}</Text>
          </View>
          
          <View style={dynamicStyles.infoContainer}>
            <Text style={dynamicStyles.infoLabel}>Allowed Hours:</Text>
            <Text style={dynamicStyles.infoValue}>{time_restriction_start} - {time_restriction_end}</Text>
          </View>
          
          {last_message_sent_during_window && (
            <View style={dynamicStyles.infoContainer}>
              <Text style={dynamicStyles.infoLabel}>Last Message During Allowed Hours:</Text>
              <Text style={dynamicStyles.infoValue}>
                {new Date(last_message_sent_during_window).toLocaleString()}
              </Text>
            </View>
          )}
          
          <Button
            mode="outlined"
            onPress={onRefresh}
            style={dynamicStyles.refreshButton}
            icon="refresh"
          >
            Check Again
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    elevation: 4,
  },
  content: {
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: theme.colors.onSurface,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    color: theme.colors.onSurfaceVariant,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onSurface,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    flex: 1,
    textAlign: 'right',
  },
  refreshButton: {
    marginTop: 20,
    borderColor: theme.colors.primary,
  },
});

export default TimeRestrictionMessage;

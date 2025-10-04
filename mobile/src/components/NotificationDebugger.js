import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button, Card, useTheme } from 'react-native-paper';
import notificationPermissionService from '../services/notificationPermissionService';

/**
 * Debug component to test notification functionality
 */
const NotificationDebugger = () => {
  const theme = useTheme();
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [testResults, setTestResults] = useState([]);

  const checkPermissionStatus = async () => {
    try {
      const status = await notificationPermissionService.getPermissionStatus();
      setPermissionStatus(status);
      console.log('🔔 Permission status:', status);
    } catch (error) {
      console.error('Error checking permission status:', error);
    }
  };

  const requestPermission = async () => {
    try {
      const result = await notificationPermissionService.showPermissionDialog();
      console.log('🔔 Permission request result:', result);
      await checkPermissionStatus();
    } catch (error) {
      console.error('Error requesting permission:', error);
    }
  };

  const sendTestNotification = async () => {
    try {
      console.log('🔔 Sending test notification...');
      const result = await notificationPermissionService.sendTestNotification();
      setTestResults(prev => [...prev, `Test notification: ${result ? 'Success' : 'Failed'}`]);
      console.log('🔔 Test notification result:', result);
    } catch (error) {
      console.error('Error sending test notification:', error);
      setTestResults(prev => [...prev, `Test notification: Error - ${error.message}`]);
    }
  };

  const sendTestStatusNotification = async () => {
    try {
      console.log('🔔 Sending test status notification...');
      const result = await notificationPermissionService.sendTestStatusNotification();
      setTestResults(prev => [...prev, `Test status notification: ${result ? 'Success' : 'Failed'}`]);
      console.log('🔔 Test status notification result:', result);
    } catch (error) {
      console.error('Error sending test status notification:', error);
      setTestResults(prev => [...prev, `Test status notification: Error - ${error.message}`]);
    }
  };

  const sendTestStatusChangeNotification = async () => {
    try {
      console.log('🔔 Sending test status change notification...');
      const result = await notificationPermissionService.sendConnectionStatusNotification(
        'disconnected',
        'connected',
        'test-session'
      );
      setTestResults(prev => [...prev, `Test status change notification: ${result ? 'Success' : 'Failed'}`]);
      console.log('🔔 Test status change notification result:', result);
    } catch (error) {
      console.error('Error sending test status change notification:', error);
      setTestResults(prev => [...prev, `Test status change notification: Error - ${error.message}`]);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={[styles.title, { color: theme.colors.primary }]}>
          🔔 Notification Debugger
        </Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permission Status:</Text>
          <Text style={styles.statusText}>{permissionStatus}</Text>
          <View style={styles.buttonRow}>
            <Button mode="outlined" onPress={checkPermissionStatus} style={styles.button}>
              Check Status
            </Button>
            <Button mode="contained" onPress={requestPermission} style={styles.button}>
              Request Permission
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Notifications:</Text>
          <View style={styles.buttonRow}>
            <Button mode="outlined" onPress={sendTestNotification} style={styles.button}>
              Test Basic
            </Button>
            <Button mode="outlined" onPress={sendTestStatusNotification} style={styles.button}>
              Test Status
            </Button>
          </View>
          <Button mode="outlined" onPress={sendTestStatusChangeNotification} style={styles.button}>
            Test Status Change
          </Button>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results:</Text>
          {testResults.length === 0 ? (
            <Text style={styles.noResults}>No tests run yet</Text>
          ) : (
            testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result}
              </Text>
            ))
          )}
          {testResults.length > 0 && (
            <Button mode="text" onPress={clearResults} style={styles.clearButton}>
              Clear Results
            </Button>
          )}
        </View>

        <Text style={styles.note}>
          💡 Check the console logs for detailed debugging information
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  clearButton: {
    marginTop: 8,
  },
  resultText: {
    fontSize: 12,
    marginBottom: 4,
    padding: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  noResults: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  note: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default NotificationDebugger;

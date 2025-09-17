import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import * as Contacts from 'expo-contacts';
import { MaterialIcons } from '@expo/vector-icons';

const ContactsPermission = ({ onPermissionGranted, onPermissionDenied }) => {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        onPermissionGranted && onPermissionGranted();
      }
    } catch (error) {
      console.error('Error checking contacts permission:', error);
    }
  };

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        Alert.alert(
          'Permission Granted',
          'You can now access your contacts for WhatsApp messaging.',
          [{ text: 'OK', onPress: () => onPermissionGranted && onPermissionGranted() }]
        );
      } else {
        Alert.alert(
          'Permission Denied',
          'Contacts access is required for this app to function properly. You can enable it later in Settings.',
          [
            { text: 'Cancel', onPress: () => onPermissionDenied && onPermissionDenied() },
            { text: 'Settings', onPress: () => Contacts.requestPermissionsAsync() }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      Alert.alert('Error', 'Failed to request contacts permission.');
    } finally {
      setIsLoading(false);
    }
  };

  if (permissionStatus === 'granted') {
    return null; // Don't show anything if permission is already granted
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="contacts" size={64} color="#25D366" style={styles.icon} />
        
        <Text style={styles.title}>Contacts Access Required</Text>
        
        <Text style={styles.description}>
          This app needs access to your contacts to help you manage WhatsApp messaging and customer information.
        </Text>
        
        <Text style={styles.benefits}>
          • Import contacts for WhatsApp messaging{'\n'}
          • Manage customer information{'\n'}
          • Sync phone numbers with your database{'\n'}
          • Improve messaging efficiency
        </Text>
        
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={requestPermission}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Requesting Permission...' : 'Grant Access to Contacts'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => onPermissionDenied && onPermissionDenied()}
        >
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  benefits: {
    fontSize: 14,
    color: '#555',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  button: {
    backgroundColor: '#25D366',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 200,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  skipButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ContactsPermission;

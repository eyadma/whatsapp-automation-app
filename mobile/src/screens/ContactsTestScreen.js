import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { AppContext } from '../context/AppContext';
import * as Contacts from 'expo-contacts';

const ContactsTestScreen = () => {
  const { contactsPermission, requestContactsPermission } = useContext(AppContext);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleRequestPermission = async () => {
    try {
      const granted = await requestContactsPermission();
      if (granted) {
        Alert.alert('Success', 'Contacts permission granted!');
      } else {
        Alert.alert('Permission Denied', 'Contacts permission was denied.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request permission: ' + error.message);
    }
  };

  const loadContacts = async () => {
    if (contactsPermission !== 'granted') {
      Alert.alert('Permission Required', 'Please grant contacts permission first.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      setContacts(data.slice(0, 10)); // Show first 10 contacts
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts Permission Test</Text>
        <Text style={styles.subtitle}>Test contacts access functionality</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permission Status</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Current Status:</Text>
          <Text style={[
            styles.statusValue,
            { color: contactsPermission === 'granted' ? '#25D366' : '#ff6b6b' }
          ]}>
            {contactsPermission || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleRequestPermission}
        >
          <Text style={styles.buttonText}>Request Contacts Permission</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            contactsPermission !== 'granted' && styles.buttonDisabled
          ]}
          onPress={loadContacts}
          disabled={contactsPermission !== 'granted' || loading}
        >
          <Text style={[
            styles.buttonText,
            contactsPermission !== 'granted' && styles.buttonTextDisabled
          ]}>
            {loading ? 'Loading...' : 'Load Contacts (First 10)'}
          </Text>
        </TouchableOpacity>
      </View>

      {contacts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Contacts</Text>
          {contacts.map((contact, index) => (
            <View key={index} style={styles.contactItem}>
              <Text style={styles.contactName}>
                {contact.name || 'No Name'}
              </Text>
              {contact.phoneNumbers && contact.phoneNumbers.length > 0 && (
                <Text style={styles.contactPhone}>
                  {contact.phoneNumbers[0].number}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <Text style={styles.instruction}>
          1. Tap "Request Contacts Permission" to grant access{'\n'}
          2. Once granted, tap "Load Contacts" to test access{'\n'}
          3. Check Android App Info to see if permission appears{'\n'}
          4. The permission should now show in Settings > Apps > WhatsApp Automation > Permissions
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#25D366',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#e8f5e8',
  },
  section: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 10,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#25D366',
  },
  secondaryButton: {
    backgroundColor: '#128C7E',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextDisabled: {
    color: '#999',
  },
  contactItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ContactsTestScreen;

import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { AppContext } from '../../context/AppContext';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTextInput from '../components/WebCompatibleTextInput';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';
import WebCompatibleCheckbox from '../components/WebCompatibleCheckbox';

const WebContactsTestScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      
      // Simulate loading contacts (in a real app, this would use the contacts API)
      const mockContacts = [
        {
          id: '1',
          name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
        },
        {
          id: '2',
          name: 'Jane Smith',
          phone: '+1234567891',
          email: 'jane@example.com',
        },
        {
          id: '3',
          name: 'Bob Johnson',
          phone: '+1234567892',
          email: 'bob@example.com',
        },
        {
          id: '4',
          name: 'Alice Brown',
          phone: '+1234567893',
          email: 'alice@example.com',
        },
        {
          id: '5',
          name: 'Charlie Wilson',
          phone: '+1234567894',
          email: 'charlie@example.com',
        },
      ];
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setContacts(mockContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleContactToggle = (contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts([...filteredContacts]);
    }
  };

  const handleImportSelected = () => {
    if (selectedContacts.length === 0) {
      Alert.alert('Error', 'Please select at least one contact');
      return;
    }

    Alert.alert(
      'Import Contacts',
      `Import ${selectedContacts.length} selected contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: () => {
            // Here you would implement the actual import logic
            Alert.alert('Success', `${selectedContacts.length} contacts imported successfully`);
            setSelectedContacts([]);
          },
        },
      ]
    );
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Contacts Test
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Test contact import functionality
        </WebCompatibleParagraph>
      </View>

      {/* Search and Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <View style={dynamicStyles.searchContainer}>
            <WebCompatibleTextInput
              label="Search contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={dynamicStyles.searchInput}
            />
            <WebCompatibleButton
              mode="contained"
              onPress={loadContacts}
              style={dynamicStyles.refreshButton}
            >
              Refresh
            </WebCompatibleButton>
          </View>

          {selectedContacts.length > 0 && (
            <View style={dynamicStyles.bulkActions}>
              <Text style={dynamicStyles.selectedText}>
                {selectedContacts.length} contact(s) selected
              </Text>
              <View style={dynamicStyles.bulkButtons}>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={handleSelectAll}
                  style={dynamicStyles.bulkButton}
                >
                  {selectedContacts.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
                </WebCompatibleButton>
                <WebCompatibleButton
                  mode="contained"
                  onPress={handleImportSelected}
                  style={dynamicStyles.bulkButton}
                >
                  Import Selected
                </WebCompatibleButton>
              </View>
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Contacts List */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Available Contacts ({filteredContacts.length})
          </WebCompatibleTitle>
          
          {filteredContacts.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleTitle style={dynamicStyles.emptyTitle}>
                {searchQuery ? 'No contacts found' : 'No contacts available'}
              </WebCompatibleTitle>
              <WebCompatibleParagraph style={dynamicStyles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'No contacts found in your device'
                }
              </WebCompatibleParagraph>
            </View>
          ) : (
            <View style={dynamicStyles.contactsList}>
              {filteredContacts.map(contact => (
                <View key={contact.id} style={dynamicStyles.contactItem}>
                  <WebCompatibleCheckbox
                    status={selectedContacts.some(c => c.id === contact.id) ? 'checked' : 'unchecked'}
                    onPress={() => handleContactToggle(contact)}
                  />
                  <View style={dynamicStyles.contactInfo}>
                    <Text style={dynamicStyles.contactName}>{contact.name}</Text>
                    <Text style={dynamicStyles.contactDetails}>
                      {contact.phone}
                    </Text>
                    <Text style={dynamicStyles.contactDetails}>
                      {contact.email}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Instructions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Instructions
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • This screen demonstrates contact import functionality
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Select contacts you want to import to your customer database
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Use the search bar to filter contacts by name, phone, or email
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Click "Import Selected" to add selected contacts to your system
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • In a real implementation, this would access your device's contacts
          </WebCompatibleParagraph>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Actions
          </WebCompatibleTitle>
          
          <View style={dynamicStyles.actionsContainer}>
            <WebCompatibleButton
              mode="contained"
              onPress={loadContacts}
              style={dynamicStyles.actionButton}
            >
              Reload Contacts
            </WebCompatibleButton>
            <WebCompatibleButton
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={dynamicStyles.actionButton}
            >
              Back
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
  searchContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
  },
  refreshButton: {
    minWidth: 120,
  },
  bulkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  selectedText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1976d2',
  },
  bulkButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkButton: {
    minWidth: 120,
  },
  emptyContainer: {
    textAlign: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  contactsList: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  contactInfo: {
    marginLeft: 12,
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  contactDetails: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  actionButton: {
    minWidth: 150,
  },
});

export default WebContactsTestScreen;

import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';
import { enhancedMessageAPI } from '../../services/enhancedMessageAPI';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTextInput from '../components/WebCompatibleTextInput';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';
import WebCompatiblePicker from '../components/WebCompatiblePicker';
import WebCompatibleCheckbox from '../components/WebCompatibleCheckbox';

const WebEnhancedMessageScreen = ({ navigation }) => {
  const { userId, t, language, activeSessionId } = useContext(AppContext);
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sendingSpeed, setSendingSpeed] = useState('medium');
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [loading, setLoading] = useState(true);

  // ETA Management State
  const [userETAs, setUserETAs] = useState([]);
  const [showETAModal, setShowETAModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [etaTime, setEtaTime] = useState('12:00');
  const [rangeEndTime, setRangeEndTime] = useState('13:00');
  const [etaFormat, setEtaFormat] = useState('range');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCustomers(),
        loadTemplates(),
        loadAreas(),
        loadUserETAs(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) {
        console.error('Error loading customers:', error);
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) {
        console.error('Error loading templates:', error);
        return;
      }

      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('name_english');

      if (error) {
        console.error('Error loading areas:', error);
        return;
      }

      setAreas(data || []);
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  };

  const loadUserETAs = async () => {
    try {
      const { data, error } = await supabase
        .from('user_etas')
        .select(`
          *,
          areas (
            area_id,
            name_english,
            name_arabic,
            name_hebrew
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error loading user ETAs:', error);
        return;
      }

      setUserETAs(data || []);
    } catch (error) {
      console.error('Error loading user ETAs:', error);
    }
  };

  const handleCustomerToggle = (customer) => {
    setSelectedCustomers(prev => {
      const isSelected = prev.some(c => c.id === customer.id);
      if (isSelected) {
        return prev.filter(c => c.id !== customer.id);
      } else {
        return [...prev, customer];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers([...customers]);
    }
  };

  const handleSendMessages = async () => {
    if (selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    if (!selectedTemplate && !customMessage.trim()) {
      Alert.alert('Error', 'Please select a template or enter a custom message');
      return;
    }

    try {
      setIsSending(true);
      setSendResults(null);

      const results = {
        total: selectedCustomers.length,
        sent: 0,
        failed: 0,
        errors: [],
      };

      for (const customer of selectedCustomers) {
        try {
          let message;
          
          if (selectedTemplate) {
            message = await enhancedMessageAPI.getLocalizedMessage(
              selectedTemplate,
              customer,
              language
            );
          } else {
            message = customMessage;
          }

          // Simulate sending message (replace with actual API call)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          results.sent++;
        } catch (error) {
          console.error('Error sending message to customer:', customer.name, error);
          results.failed++;
          results.errors.push({
            customer: customer.name,
            error: error.message,
          });
        }
      }

      setSendResults(results);
      Alert.alert('Send Complete', `Sent: ${results.sent}, Failed: ${results.failed}`);
    } catch (error) {
      console.error('Error sending messages:', error);
      Alert.alert('Error', 'Failed to send messages');
    } finally {
      setIsSending(false);
    }
  };

  const handleSetETA = () => {
    if (!selectedArea) {
      Alert.alert('Error', 'Please select an area');
      return;
    }

    setShowETAModal(true);
  };

  const handleSaveETA = async () => {
    if (!selectedArea) {
      Alert.alert('Error', 'Please select an area');
      return;
    }

    try {
      const etaData = {
        user_id: userId,
        area_id: selectedArea.area_id,
        eta_time: etaTime,
        eta_format: etaFormat,
        range_end_time: etaFormat === 'range' ? rangeEndTime : null,
      };

      const { error } = await supabase
        .from('user_etas')
        .upsert(etaData);

      if (error) {
        console.error('Error saving ETA:', error);
        Alert.alert('Error', 'Failed to save ETA');
        return;
      }

      Alert.alert('Success', 'ETA saved successfully');
      setShowETAModal(false);
      loadUserETAs();
    } catch (error) {
      console.error('Error saving ETA:', error);
      Alert.alert('Error', 'Failed to save ETA');
    }
  };

  const getLocalizedAreaName = (area) => {
    if (!area) return 'Unknown Area';
    
    switch (language) {
      case 'ar':
        return area.name_arabic || area.name_english;
      case 'he':
        return area.name_hebrew || area.name_english;
      default:
        return area.name_english;
    }
  };

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Send Enhanced Messages
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Send personalized messages to your customers
        </WebCompatibleParagraph>
      </View>

      {/* Template Selection */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Select Template
          </WebCompatibleTitle>
          
          <WebCompatiblePicker
            selectedValue={selectedTemplate?.id}
            onValueChange={(value) => {
              const template = templates.find(t => t.id === value);
              setSelectedTemplate(template);
            }}
            style={dynamicStyles.picker}
          >
            <WebCompatiblePicker.Item label="Select a template..." value={null} />
            {templates.map(template => (
              <WebCompatiblePicker.Item
                key={template.id}
                label={template.name}
                value={template.id}
              />
            ))}
          </WebCompatiblePicker>

          <WebCompatibleTextInput
            label="Or enter custom message"
            value={customMessage}
            onChangeText={setCustomMessage}
            multiline
            numberOfLines={4}
            style={dynamicStyles.textArea}
          />
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Customer Selection */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <View style={dynamicStyles.sectionHeader}>
            <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
              Select Customers ({selectedCustomers.length} selected)
            </WebCompatibleTitle>
            <WebCompatibleButton
              mode="outlined"
              onPress={handleSelectAll}
              style={dynamicStyles.selectAllButton}
            >
              {selectedCustomers.length === customers.length ? 'Deselect All' : 'Select All'}
            </WebCompatibleButton>
          </View>

          <View style={dynamicStyles.customersList}>
            {customers.map(customer => (
              <View key={customer.id} style={dynamicStyles.customerItem}>
                <WebCompatibleCheckbox
                  status={selectedCustomers.some(c => c.id === customer.id) ? 'checked' : 'unchecked'}
                  onPress={() => handleCustomerToggle(customer)}
                />
                <View style={dynamicStyles.customerInfo}>
                  <Text style={dynamicStyles.customerName}>{customer.name}</Text>
                  <Text style={dynamicStyles.customerDetails}>
                    {customer.phone_number} • {getLocalizedAreaName(customer.areas)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* ETA Management */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            ETA Management
          </WebCompatibleTitle>
          
          <View style={dynamicStyles.etaActions}>
            <WebCompatibleButton
              mode="contained"
              onPress={handleSetETA}
              style={dynamicStyles.etaButton}
            >
              Add ETA
            </WebCompatibleButton>
          </View>

          <View style={dynamicStyles.etaList}>
            {userETAs.map(eta => (
              <View key={eta.id} style={dynamicStyles.etaItem}>
                <View style={dynamicStyles.etaInfo}>
                  <Text style={dynamicStyles.etaArea}>
                    {getLocalizedAreaName(eta.areas)}
                  </Text>
                  <Text style={dynamicStyles.etaTime}>
                    {eta.eta_format === 'range' 
                      ? `${eta.eta_time} - ${eta.range_end_time}`
                      : eta.eta_time
                    }
                  </Text>
                </View>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={() => {
                    // Handle delete ETA
                    Alert.alert('Delete ETA', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive' },
                    ]);
                  }}
                  style={dynamicStyles.deleteButton}
                >
                  Delete
                </WebCompatibleButton>
              </View>
            ))}
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Send Messages */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Send Messages
          </WebCompatibleTitle>
          
          <View style={dynamicStyles.sendActions}>
            <WebCompatibleButton
              mode="contained"
              onPress={handleSendMessages}
              loading={isSending}
              disabled={isSending || selectedCustomers.length === 0}
              style={dynamicStyles.sendButton}
            >
              {isSending ? 'Sending...' : `Send to ${selectedCustomers.length} customers`}
            </WebCompatibleButton>
          </View>

          {sendResults && (
            <View style={dynamicStyles.resultsContainer}>
              <Text style={dynamicStyles.resultsTitle}>Send Results:</Text>
              <Text style={dynamicStyles.resultsText}>
                Total: {sendResults.total} | Sent: {sendResults.sent} | Failed: {sendResults.failed}
              </Text>
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* ETA Modal */}
      {showETAModal && (
        <View style={dynamicStyles.modalOverlay}>
          <WebCompatibleCard style={dynamicStyles.modalCard}>
            <WebCompatibleCard.Content>
              <WebCompatibleTitle style={dynamicStyles.modalTitle}>
                Set ETA
              </WebCompatibleTitle>
              
              <WebCompatiblePicker
                selectedValue={selectedArea?.area_id}
                onValueChange={(value) => {
                  const area = areas.find(a => a.area_id === value);
                  setSelectedArea(area);
                }}
                style={dynamicStyles.picker}
              >
                <WebCompatiblePicker.Item label="Select area..." value={null} />
                {areas.map(area => (
                  <WebCompatiblePicker.Item
                    key={area.area_id}
                    label={getLocalizedAreaName(area)}
                    value={area.area_id}
                  />
                ))}
              </WebCompatiblePicker>

              <WebCompatiblePicker
                selectedValue={etaFormat}
                onValueChange={setEtaFormat}
                style={dynamicStyles.picker}
              >
                <WebCompatiblePicker.Item label="Single Time" value="single" />
                <WebCompatiblePicker.Item label="Time Range" value="range" />
              </WebCompatiblePicker>

              <WebCompatibleTextInput
                label="Start Time"
                value={etaTime}
                onChangeText={setEtaTime}
                placeholder="12:00"
                style={dynamicStyles.input}
              />

              {etaFormat === 'range' && (
                <WebCompatibleTextInput
                  label="End Time"
                  value={rangeEndTime}
                  onChangeText={setRangeEndTime}
                  placeholder="13:00"
                  style={dynamicStyles.input}
                />
              )}
              
              <View style={dynamicStyles.modalActions}>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={() => setShowETAModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </WebCompatibleButton>
                <WebCompatibleButton
                  mode="contained"
                  onPress={handleSaveETA}
                  style={dynamicStyles.modalButton}
                >
                  Save ETA
                </WebCompatibleButton>
              </View>
            </WebCompatibleCard.Content>
          </WebCompatibleCard>
        </View>
      )}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  picker: {
    marginBottom: 16,
  },
  textArea: {
    marginBottom: 16,
  },
  selectAllButton: {
    minWidth: 120,
  },
  customersList: {
    gap: 12,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  customerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  customerDetails: {
    fontSize: 14,
    color: '#666666',
  },
  etaActions: {
    marginBottom: 16,
  },
  etaButton: {
    minWidth: 120,
  },
  etaList: {
    gap: 12,
  },
  etaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  etaInfo: {
    flex: 1,
  },
  etaArea: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  etaTime: {
    fontSize: 14,
    color: '#666666',
  },
  deleteButton: {
    borderColor: '#F44336',
    minWidth: 80,
  },
  sendActions: {
    marginBottom: 16,
  },
  sendButton: {
    minWidth: 200,
  },
  resultsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#666666',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: '90%',
    maxWidth: 500,
    margin: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
  },
});

export default WebEnhancedMessageScreen;

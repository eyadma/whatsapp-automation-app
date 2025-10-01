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

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTextInput from '../components/WebCompatibleTextInput';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';
import WebCompatibleCheckbox from '../components/WebCompatibleCheckbox';

const WebVCardScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [vCardData, setVCardData] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          areas (
            area_id,
            name_english,
            name_arabic,
            name_hebrew
          )
        `)
        .eq('user_id', userId)
        .order('name');

      if (error) {
        console.error('Error loading customers:', error);
        Alert.alert('Error', 'Failed to load customers');
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
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
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers([...filteredCustomers]);
    }
  };

  const generateVCard = () => {
    if (selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    let vCardContent = '';
    
    selectedCustomers.forEach((customer, index) => {
      vCardContent += `BEGIN:VCARD
VERSION:3.0
FN:${customer.name}
N:${customer.name};;;;
TEL:${customer.phone_number}`;
      
      if (customer.phone2) {
        vCardContent += `
TEL:${customer.phone2}`;
      }
      
      if (customer.areas) {
        const areaName = getLocalizedAreaName(customer.areas);
        vCardContent += `
ADR:;;${areaName};;;;`;
      }
      
      if (customer.package_id) {
        vCardContent += `
NOTE:Package ID: ${customer.package_id}`;
        if (customer.package_price) {
          vCardContent += `, Price: ${customer.package_price}`;
        }
      }
      
      vCardContent += `
END:VCARD`;
      
      if (index < selectedCustomers.length - 1) {
        vCardContent += '\n';
      }
    });

    setVCardData(vCardContent);
    setShowPreview(true);
  };

  const downloadVCard = () => {
    if (!vCardData) {
      Alert.alert('Error', 'No VCard data to download');
      return;
    }

    try {
      const blob = new Blob([vCardData], { type: 'text/vcard' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers_${new Date().toISOString().split('T')[0]}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      Alert.alert('Success', 'VCard file downloaded successfully');
    } catch (error) {
      console.error('Error downloading VCard:', error);
      Alert.alert('Error', 'Failed to download VCard file');
    }
  };

  const copyVCard = () => {
    if (!vCardData) {
      Alert.alert('Error', 'No VCard data to copy');
      return;
    }

    try {
      navigator.clipboard.writeText(vCardData).then(() => {
        Alert.alert('Success', 'VCard data copied to clipboard');
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = vCardData;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        Alert.alert('Success', 'VCard data copied to clipboard');
      });
    } catch (error) {
      console.error('Error copying VCard:', error);
      Alert.alert('Error', 'Failed to copy VCard data');
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

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone_number.includes(searchQuery) ||
    (customer.areas && getLocalizedAreaName(customer.areas).toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading customers...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          VCard Generator
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Generate VCard files for your customers
        </WebCompatibleParagraph>
      </View>

      {/* Search and Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <View style={dynamicStyles.searchContainer}>
            <WebCompatibleTextInput
              label="Search customers..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={dynamicStyles.searchInput}
            />
          </View>

          {selectedCustomers.length > 0 && (
            <View style={dynamicStyles.bulkActions}>
              <Text style={dynamicStyles.selectedText}>
                {selectedCustomers.length} customer(s) selected
              </Text>
              <View style={dynamicStyles.bulkButtons}>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={handleSelectAll}
                  style={dynamicStyles.bulkButton}
                >
                  {selectedCustomers.length === filteredCustomers.length ? 'Deselect All' : 'Select All'}
                </WebCompatibleButton>
                <WebCompatibleButton
                  mode="contained"
                  onPress={generateVCard}
                  style={dynamicStyles.bulkButton}
                >
                  Generate VCard
                </WebCompatibleButton>
              </View>
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Customers List */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Select Customers
          </WebCompatibleTitle>
          
          {filteredCustomers.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleTitle style={dynamicStyles.emptyTitle}>
                {searchQuery ? 'No customers found' : 'No customers yet'}
              </WebCompatibleTitle>
              <WebCompatibleParagraph style={dynamicStyles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Add customers to generate VCard files'
                }
              </WebCompatibleParagraph>
            </View>
          ) : (
            <View style={dynamicStyles.customersList}>
              {filteredCustomers.map(customer => (
                <View key={customer.id} style={dynamicStyles.customerItem}>
                  <WebCompatibleCheckbox
                    status={selectedCustomers.some(c => c.id === customer.id) ? 'checked' : 'unchecked'}
                    onPress={() => handleCustomerToggle(customer)}
                  />
                  <View style={dynamicStyles.customerInfo}>
                    <Text style={dynamicStyles.customerName}>{customer.name}</Text>
                    <Text style={dynamicStyles.customerDetails}>
                      {customer.phone_number}
                      {customer.phone2 && ` • ${customer.phone2}`}
                    </Text>
                    <Text style={dynamicStyles.customerArea}>
                      {getLocalizedAreaName(customer.areas)}
                    </Text>
                    {customer.package_id && (
                      <Text style={dynamicStyles.customerPackage}>
                        Package: {customer.package_id}
                        {customer.package_price && ` (${customer.package_price})`}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* VCard Preview */}
      {showPreview && vCardData && (
        <WebCompatibleCard style={dynamicStyles.section}>
          <WebCompatibleCard.Content>
            <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
              VCard Preview
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.previewDescription}>
              Preview of the generated VCard data
            </WebCompatibleParagraph>
            
            <View style={dynamicStyles.vCardContainer}>
              <Text style={dynamicStyles.vCardText}>
                {vCardData}
              </Text>
            </View>
            
            <View style={dynamicStyles.vCardActions}>
              <WebCompatibleButton
                mode="contained"
                onPress={downloadVCard}
                style={dynamicStyles.vCardButton}
              >
                Download VCard
              </WebCompatibleButton>
              <WebCompatibleButton
                mode="outlined"
                onPress={copyVCard}
                style={dynamicStyles.vCardButton}
              >
                Copy to Clipboard
              </WebCompatibleButton>
              <WebCompatibleButton
                mode="outlined"
                onPress={() => setShowPreview(false)}
                style={dynamicStyles.vCardButton}
              >
                Close Preview
              </WebCompatibleButton>
            </View>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    marginBottom: 16,
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
    marginBottom: 2,
  },
  customerArea: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  customerPackage: {
    fontSize: 14,
    color: '#666666',
  },
  previewDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  vCardContainer: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    maxHeight: 300,
    overflow: 'auto',
  },
  vCardText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333333',
    lineHeight: 16,
  },
  vCardActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  vCardButton: {
    minWidth: 120,
  },
});

export default WebVCardScreen;

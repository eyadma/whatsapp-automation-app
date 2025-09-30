import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Card, Button, TextInput, FAB, Chip, Searchbar, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { customersAPI } from '../services/api';
import { getApiBaseUrl, resolveApiBaseUrl } from '../services/apiBase';
import WebCompatibleButton from '../components/WebCompatibleButton';

const CustomersScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const paperTheme = useTheme();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);

  useEffect(() => {
    loadCustomers();
  }, [userId]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await customersAPI.getAll(userId);
      setCustomers(response.data.customers || []);
      
      // Extract unique areas from customers
      const areas = [...new Set(response.data.customers.map(c => c.area).filter(Boolean))];
      setAvailableAreas(areas);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert(t('error'), 'Failed to load customers: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersFromAPI = async () => {
    setLoading(true);
    try {
      const serverUrl = await resolveApiBaseUrl();
      console.log('🌐 Fetching from:', `${serverUrl}/api/customers/fetch/${userId}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${serverUrl}/api/customers/fetch/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        await loadCustomers();
        Alert.alert(
          t('success'), 
          result.message || `Successfully fetched and saved ${result.savedCount || 0} customers`
        );
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
    } catch (error) {
      console.error('Error fetching customers from API:', error);
      Alert.alert(
        t('error'), 
        `Failed to fetch customers: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const serverUrl = await resolveApiBaseUrl();
      console.log('🧪 Testing connection to:', serverUrl);
      
      const response = await fetch(`${serverUrl}/api/health`, {
        method: 'GET',
      });
      
      const result = await response.json();
      Alert.alert(t('connectionTest'), t('connectedSuccessfully').replace('{server}', serverUrl).replace('{message}', result.message).replace('{timestamp}', result.timestamp));
    } catch (error) {
      console.error('Connection test failed:', error);
      Alert.alert(t('connectionTest'), t('connectionFailed').replace('{error}', error.message));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadCustomers();
      return;
    }

    setLoading(true);
    try {
      const response = await customersAPI.search(userId, searchQuery);
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Error searching customers:', error);
      Alert.alert(t('error'), 'Failed to search customers: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const toggleAreaSelection = (area) => {
    setSelectedAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const selectCustomersByArea = () => {
    const customersInSelectedAreas = customers.filter(customer => 
      selectedAreas.includes(customer.area)
    );
    const customerIds = customersInSelectedAreas.map(c => c.id);
    setSelectedCustomers(customerIds);
    setShowAreaSelector(false);
  };

  const deleteSelectedCustomers = async () => {
    if (selectedCustomers.length === 0) {
      Alert.alert(t('error'), t('pleaseSelectCustomersToDelete'));
      return;
    }

    Alert.alert(
      t('confirmDelete'),
      `${t('deleteSelectedCustomers')} (${selectedCustomers.length})?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              let deletedCount = 0;
              for (const customerId of selectedCustomers) {
                try {
                  await customersAPI.delete(customerId);
                  deletedCount++;
                } catch (error) {
                  console.error('Error deleting customer:', error);
                }
              }
              
              setSelectedCustomers([]);
              await loadCustomers();
              
              Alert.alert(
                t('success'),
                `${t('deletedCustomers')}: ${deletedCount}`
              );
            } catch (error) {
              console.error('Error deleting customers:', error);
              Alert.alert(t('error'), t('failedToDeleteCustomers'));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteAllCustomers = async () => {
    if (customers.length === 0) {
      Alert.alert(t('error'), t('noCustomersToDelete'));
      return;
    }

    Alert.alert(
      t('deleteAllCustomers'),
      t('deleteAllCustomersMessage').replace('{count}', customers.length),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('deleteAll'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              let deletedCount = 0;
              for (const customer of customers) {
                try {
                  await customersAPI.delete(customer.id);
                  deletedCount++;
                } catch (error) {
                  console.error('Error deleting customer:', error);
                }
              }
              
              setSelectedCustomers([]);
              await loadCustomers();
              
              Alert.alert(
                t('success'),
                t('successfullyDeletedCustomers').replace('{deletedCount}', deletedCount).replace('{totalCount}', customers.length)
              );
            } catch (error) {
              console.error('Error deleting all customers:', error);
              Alert.alert(t('error'), t('failedToDeleteAllCustomers'));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const deleteCustomer = async (customerId) => {
    Alert.alert(
      t('confirmDelete'),
      t('deleteCustomerConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await customersAPI.delete(customerId);
              await loadCustomers();
              Alert.alert(t('success'), t('customerDeleted'));
            } catch (error) {
              console.error('Error deleting customer:', error);
              Alert.alert(t('error'), t('failedToDeleteCustomer'));
            }
          }
        }
      ]
    );
  };

  const renderCustomerCard = (customer) => {
    const isSelected = selectedCustomers.includes(customer.id);
    
    return (
      <Card 
        key={customer.id} 
        style={[dynamicStyles.customerCard, isSelected && dynamicStyles.selectedCard]}
        onPress={() => toggleCustomerSelection(customer.id)}
      >
        <Card.Content>
          <View style={dynamicStyles.customerHeader}>
            <View style={dynamicStyles.customerInfo}>
              <Text style={dynamicStyles.customerName}>{customer.name}</Text>
              <Text style={dynamicStyles.customerPhone}>{customer.phone}</Text>
              {customer.phone2 && customer.phone2.trim() !== '' && (
                <Text style={[dynamicStyles.customerPhone, dynamicStyles.secondaryPhone]}>
                  {t('phone2')}: {customer.phone2}
                </Text>
              )}
              <Text style={dynamicStyles.customerArea}>{customer.area}</Text>
            </View>
            <View style={dynamicStyles.customerActions}>
             
              <WebCompatibleButton
                mode="outlined"
                onPress={() => deleteCustomer(customer.id)}
                style={dynamicStyles.deleteCustomerButton}
                icon={<Ionicons name="trash" size={16} color="#FF3B30" />}
              >
                {t('delete')}
              </WebCompatibleButton>
            </View>
          </View>
          
          <View style={dynamicStyles.customerDetails}>
            <View style={dynamicStyles.detailRow}>
              <Text style={dynamicStyles.detailLabel}>{t('packageId')}:</Text>
              <Text style={dynamicStyles.detailValue}>{customer.package_id}</Text>
            </View>
            <View style={dynamicStyles.detailRow}>
              <Text style={dynamicStyles.detailLabel}>{t('packagePrice')}:</Text>
              <Text style={dynamicStyles.detailValue}>₪{customer.package_price}</Text>
            </View>
            {customer.business_name && (
              <View style={dynamicStyles.detailRow}>
                <Text style={dynamicStyles.detailLabel}>{t('businessName')}:</Text>
                <Text style={dynamicStyles.detailValue}>{customer.business_name}</Text>
              </View>
            )}
            {customer.has_return && (
              <Chip style={dynamicStyles.returnChip} icon="alert">
                {t('hasReturn')}
              </Chip>
            )}
            {customer.location_received && customer.latitude && customer.longitude && (
              <View style={dynamicStyles.locationSection}>
                <Chip style={dynamicStyles.locationChip} icon="location">
                  📍 {t('locationReceived')}
                </Chip>
                <Text style={dynamicStyles.locationText}>
                  {customer.latitude.toFixed(6)}, {customer.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerInfo}>
          <Text style={dynamicStyles.userIdText}>User ID: {userId?.substring(0, 8)}...</Text>
          <Text style={dynamicStyles.totalLabel}>{t('totalCustomers')}</Text>
          <Text style={dynamicStyles.totalCount}>{customers.length}</Text>
        </View>
      </View>
      
      {/* Action Buttons */}
      <View style={dynamicStyles.actionButtonsContainer}>
        <View style={dynamicStyles.actionButtonsRow}>
          <TouchableOpacity
            onPress={fetchCustomersFromAPI}
            style={[dynamicStyles.actionButton, dynamicStyles.fetchButton]}
          >
            <Ionicons name="cloud-download" size={16} color="#25D366" />
            <Text style={dynamicStyles.actionText}>{t('fetchCustomers')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('VCard')}
            style={[dynamicStyles.actionButton, dynamicStyles.vcardButton]}
          >
            <Ionicons name="card" size={16} color="#007AFF" />
            <Text style={dynamicStyles.actionText}>{t('vCard')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={loadCustomers}
            style={dynamicStyles.actionButton}
          >
            <Ionicons name="refresh" size={16} color="#007AFF" />
            <Text style={dynamicStyles.actionText}>{t('refresh')}</Text>
          </TouchableOpacity>
          
          <WebCompatibleButton
            mode="outlined"
            onPress={testConnection}
            style={[dynamicStyles.actionButton, dynamicStyles.testButton]}
            icon={<Ionicons name="wifi" size={16} color="#FF9500" />}
          >
            {t('test')}
          </WebCompatibleButton>
        </View>
        
        <View style={dynamicStyles.actionButtonsRow}>
          <TouchableOpacity
            onPress={() => setShowAreaSelector(true)}
            style={dynamicStyles.actionButton}
          >
            <Ionicons name="people" size={16} color="#007AFF" />
            <Text style={dynamicStyles.actionText}>{t('selectByArea')}</Text>
          </TouchableOpacity>
          
          {selectedCustomers.length > 0 && (
            <WebCompatibleButton
              mode="outlined"
              onPress={deleteSelectedCustomers}
              style={[dynamicStyles.actionButton, dynamicStyles.deleteButton]}
              icon={<Ionicons name="trash" size={16} color="#FF3B30" />}
            >
              {t('deleteSelected')}
            </WebCompatibleButton>
          )}
          
          <TouchableOpacity
            onPress={handleDeleteAllCustomers}
            style={[dynamicStyles.actionButton, dynamicStyles.deleteAllButton]}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            <Text style={dynamicStyles.actionText}>{t('deleteAllButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder={t('searchCustomers')}
        onChangeText={setSearchQuery}
        value={searchQuery}
        onSubmitEditing={handleSearch}
        style={dynamicStyles.searchBar}
      />

      {/* Customers List */}
      <ScrollView style={dynamicStyles.customersList}>
        {loading ? (
          <Text style={dynamicStyles.loadingText}>{t('loading')}...</Text>
        ) : customers.length === 0 ? (
          <Text style={dynamicStyles.noDataText}>{t('noCustomers')}</Text>
        ) : (
          customers.map(renderCustomerCard)
        )}
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        style={dynamicStyles.fab}
        onPress={() => navigation.navigate('AddCustomer')}
      />

      {/* Area Selector Modal */}
      <Modal
        visible={showAreaSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAreaSelector(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>{t('selectByArea')}</Text>
              <TouchableOpacity
                onPress={() => setShowAreaSelector(false)}
                style={dynamicStyles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={dynamicStyles.areasList}>
              {availableAreas.map(area => (
                <TouchableOpacity
                  key={area}
                  style={[
                    dynamicStyles.areaItem,
                    selectedAreas.includes(area) && dynamicStyles.selectedAreaItem
                  ]}
                  onPress={() => toggleAreaSelection(area)}
                >
                  <Text style={dynamicStyles.areaText}>{area}</Text>
                  {selectedAreas.includes(area) && (
                    <Ionicons name="checkmark" size={20} color="#25D366" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={dynamicStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowAreaSelector(false)}
                style={dynamicStyles.modalButton}
              >
                {t('cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={selectCustomersByArea}
                style={dynamicStyles.modalButton}
              >
                {t('select')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  headerInfo: {
    alignItems: 'center',
  },
  userIdText: {
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  totalCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#25D366',
  },
  actionButtonsContainer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
    flex: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginHorizontal: 2,
  },
  deleteButton: {
    backgroundColor: theme.dark ? '#3b1f1f' : '#ffe6e6',
  },
  deleteAllButton: {
    backgroundColor: theme.dark ? '#2b1a1a' : '#ffebee',
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  fetchButton: {
    backgroundColor: theme.dark ? 'rgba(37,211,102,0.15)' : '#e8f5e8',
  },
  vcardButton: {
    backgroundColor: theme.dark ? 'rgba(0,122,255,0.15)' : '#e3f2fd',
  },
  testButton: {
    backgroundColor: theme.dark ? 'rgba(255,201,71,0.18)' : '#fff3cd',
  },
  deleteCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 4,
    backgroundColor: theme.dark ? '#3b1f1f' : '#ffe6e6',
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  actionText: {
    fontSize: 11,
    marginLeft: 2,
    color: theme.colors.onSurface,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  searchBar: {
    margin: 16,
    elevation: 2,
  },
  customersList: {
    flex: 1,
    padding: 16,
  },
  customerCard: {
    marginBottom: 12,
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  customerPhone: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 2,
  },
  secondaryPhone: {
    color: '#007AFF',
    fontWeight: '500',
  },
  customerArea: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  customerDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: theme.colors.onSurface,
  },
  returnChip: {
    backgroundColor: theme.dark ? 'rgba(255,201,71,0.18)' : '#fff3cd',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  locationSection: {
    marginTop: 8,
  },
  locationChip: {
    backgroundColor: theme.dark ? 'rgba(37,211,102,0.15)' : '#e8f5e8',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 11,
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#25D366',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  closeButton: {
    padding: 4,
  },
  areasList: {
    maxHeight: 300,
  },
  areaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  selectedAreaItem: {
    backgroundColor: theme.colors.primaryContainer,
  },
  areaText: {
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});

export default CustomersScreen; 
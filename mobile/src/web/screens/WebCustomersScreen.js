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
import WebCompatiblePicker from '../components/WebCompatiblePicker';

const WebCustomersScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [customers, setCustomers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    phone2: '',
    areaId: null,
    packageId: '',
    packagePrice: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCustomers(),
        loadAreas(),
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
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
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

  const handleAddCustomer = () => {
    setFormData({
      name: '',
      phoneNumber: '',
      phone2: '',
      areaId: null,
      packageId: '',
      packagePrice: '',
    });
    setEditingCustomer(null);
    setShowAddModal(true);
  };

  const handleEditCustomer = (customer) => {
    setFormData({
      name: customer.name || '',
      phoneNumber: customer.phone_number || '',
      phone2: customer.phone2 || '',
      areaId: customer.area_id || null,
      packageId: customer.package_id || '',
      packagePrice: customer.package_price || '',
    });
    setEditingCustomer(customer);
    setShowAddModal(true);
  };

  const handleSaveCustomer = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    if (!formData.phoneNumber.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    try {
      const customerData = {
        user_id: userId,
        name: formData.name.trim(),
        phone_number: formData.phoneNumber.trim(),
        phone2: formData.phone2.trim() || null,
        area_id: formData.areaId,
        package_id: formData.packageId.trim() || null,
        package_price: formData.packagePrice.trim() || null,
      };

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);

        if (error) {
          console.error('Error updating customer:', error);
          Alert.alert('Error', 'Failed to update customer');
          return;
        }

        Alert.alert('Success', 'Customer updated successfully');
      } else {
        // Create new customer
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);

        if (error) {
          console.error('Error creating customer:', error);
          Alert.alert('Error', 'Failed to create customer');
          return;
        }

        Alert.alert('Success', 'Customer created successfully');
      }

      setShowAddModal(false);
      setFormData({
        name: '',
        phoneNumber: '',
        phone2: '',
        areaId: null,
        packageId: '',
        packagePrice: '',
      });
      setEditingCustomer(null);
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      Alert.alert('Error', 'Failed to save customer');
    }
  };

  const handleDeleteCustomer = (customer) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${customer.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', customer.id);

              if (error) {
                console.error('Error deleting customer:', error);
                Alert.alert('Error', 'Failed to delete customer');
                return;
              }

              Alert.alert('Success', 'Customer deleted successfully');
              loadCustomers();
            } catch (error) {
              console.error('Error deleting customer:', error);
              Alert.alert('Error', 'Failed to delete customer');
            }
          },
        },
      ]
    );
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

  const handleDeleteSelected = () => {
    if (selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select customers to delete');
      return;
    }

    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${selectedCustomers.length} customer(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const customerIds = selectedCustomers.map(c => c.id);
              const { error } = await supabase
                .from('customers')
                .delete()
                .in('id', customerIds);

              if (error) {
                console.error('Error deleting customers:', error);
                Alert.alert('Error', 'Failed to delete customers');
                return;
              }

              Alert.alert('Success', `${selectedCustomers.length} customer(s) deleted successfully`);
              setSelectedCustomers([]);
              loadCustomers();
            } catch (error) {
              console.error('Error deleting customers:', error);
              Alert.alert('Error', 'Failed to delete customers');
            }
          },
        },
      ]
    );
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
          Manage Customers
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Total: {customers.length} customers
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
            <WebCompatibleButton
              mode="contained"
              onPress={handleAddCustomer}
              style={dynamicStyles.addButton}
            >
              Add Customer
            </WebCompatibleButton>
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
                  mode="outlined"
                  onPress={handleDeleteSelected}
                  style={[dynamicStyles.bulkButton, dynamicStyles.deleteButton]}
                >
                  Delete Selected
                </WebCompatibleButton>
              </View>
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Customers List */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          {filteredCustomers.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleTitle style={dynamicStyles.emptyTitle}>
                {searchQuery ? 'No customers found' : 'No customers yet'}
              </WebCompatibleTitle>
              <WebCompatibleParagraph style={dynamicStyles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Add your first customer to get started'
                }
              </WebCompatibleParagraph>
            </View>
          ) : (
            <View style={dynamicStyles.customersList}>
              {filteredCustomers.map(customer => (
                <View key={customer.id} style={dynamicStyles.customerItem}>
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
                  <View style={dynamicStyles.customerActions}>
                    <WebCompatibleButton
                      mode="outlined"
                      onPress={() => handleEditCustomer(customer)}
                      style={dynamicStyles.actionButton}
                    >
                      Edit
                    </WebCompatibleButton>
                    <WebCompatibleButton
                      mode="outlined"
                      onPress={() => handleDeleteCustomer(customer)}
                      style={[dynamicStyles.actionButton, dynamicStyles.deleteButton]}
                    >
                      Delete
                    </WebCompatibleButton>
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Add/Edit Customer Modal */}
      {showAddModal && (
        <View style={dynamicStyles.modalOverlay}>
          <WebCompatibleCard style={dynamicStyles.modalCard}>
            <WebCompatibleCard.Content>
              <WebCompatibleTitle style={dynamicStyles.modalTitle}>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </WebCompatibleTitle>
              
              <WebCompatibleTextInput
                label="Customer Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                style={dynamicStyles.input}
              />
              
              <WebCompatibleTextInput
                label="Phone Number *"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                keyboardType="phone-pad"
                style={dynamicStyles.input}
              />
              
              <WebCompatibleTextInput
                label="Phone 2 (Optional)"
                value={formData.phone2}
                onChangeText={(text) => setFormData({ ...formData, phone2: text })}
                keyboardType="phone-pad"
                style={dynamicStyles.input}
              />
              
              <WebCompatiblePicker
                selectedValue={formData.areaId}
                onValueChange={(value) => setFormData({ ...formData, areaId: value })}
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
              
              <WebCompatibleTextInput
                label="Package ID (Optional)"
                value={formData.packageId}
                onChangeText={(text) => setFormData({ ...formData, packageId: text })}
                style={dynamicStyles.input}
              />
              
              <WebCompatibleTextInput
                label="Package Price (Optional)"
                value={formData.packagePrice}
                onChangeText={(text) => setFormData({ ...formData, packagePrice: text })}
                keyboardType="numeric"
                style={dynamicStyles.input}
              />
              
              <View style={dynamicStyles.modalActions}>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={() => setShowAddModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </WebCompatibleButton>
                <WebCompatibleButton
                  mode="contained"
                  onPress={handleSaveCustomer}
                  style={dynamicStyles.modalButton}
                >
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
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
  searchContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
  },
  addButton: {
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
    minWidth: 100,
  },
  deleteButton: {
    borderColor: '#F44336',
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
    gap: 16,
  },
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
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
  customerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    minWidth: 80,
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
  picker: {
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

export default WebCustomersScreen;

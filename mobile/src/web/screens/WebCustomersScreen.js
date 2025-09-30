import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, Platform, Alert } from 'react-native';
import { Card, Title, Paragraph, TextInput, Chip, Checkbox } from 'react-native-paper';
import { AppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import WebCompatibleButton from '../components/WebCompatibleButton';

const WebCustomersScreen = ({ navigation }) => {
  const { userId, theme, t } = useContext(AppContext);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [userId]);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const result = await api.getCustomers(userId);
      if (result.success) {
        setCustomers(result.data || []);
      } else {
        console.error('Failed to load customers:', result.error);
        Alert.alert(t('error'), result.error || 'Failed to load customers');
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert(t('error'), 'Error loading customers');
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(customer =>
      customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery) ||
      customer.area?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCustomers(filtered);
  };

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomers(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(customer => customer.id));
    }
    setSelectAll(!selectAll);
  };

  const handleDeleteCustomer = (customerId) => {
    Alert.alert(
      t('confirmDelete'),
      'Are you sure you want to delete this customer?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await api.deleteCustomer(customerId);
              if (result.success) {
                Alert.alert(t('success'), 'Customer deleted successfully');
                await loadCustomers();
                setSelectedCustomers(prev => prev.filter(id => id !== customerId));
              } else {
                Alert.alert(t('error'), result.error || 'Failed to delete customer');
              }
            } catch (error) {
              console.error('Error deleting customer:', error);
              Alert.alert(t('error'), 'Error deleting customer');
            }
          }
        }
      ]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedCustomers.length === 0) {
      Alert.alert(t('error'), 'No customers selected');
      return;
    }

    Alert.alert(
      t('confirmDelete'),
      `Are you sure you want to delete ${selectedCustomers.length} selected customers?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const deletePromises = selectedCustomers.map(customerId =>
                api.deleteCustomer(customerId)
              );
              
              const results = await Promise.all(deletePromises);
              const failed = results.filter(result => !result.success);
              
              if (failed.length === 0) {
                Alert.alert(t('success'), 'All selected customers deleted successfully');
              } else {
                Alert.alert(t('error'), `Failed to delete ${failed.length} customers`);
              }
              
              await loadCustomers();
              setSelectedCustomers([]);
              setSelectAll(false);
            } catch (error) {
              console.error('Error deleting selected customers:', error);
              Alert.alert(t('error'), 'Error deleting selected customers');
            }
          }
        }
      ]
    );
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme === 'dark' ? '#121212' : '#f5f5f5',
      padding: 16,
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme === 'dark' ? '#fff' : '#000',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme === 'dark' ? '#ccc' : '#666',
    },
    searchContainer: {
      marginBottom: 16,
    },
    searchInput: {
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
    },
    controlsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      flexWrap: 'wrap',
      gap: 12,
    },
    selectAllContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectAllText: {
      marginLeft: 8,
      color: theme === 'dark' ? '#fff' : '#000',
    },
    selectedCount: {
      color: theme === 'dark' ? '#ccc' : '#666',
      fontSize: 14,
    },
    customerCard: {
      marginBottom: 12,
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
    },
    customerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    customerName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme === 'dark' ? '#fff' : '#000',
      flex: 1,
    },
    customerInfo: {
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    infoLabel: {
      fontWeight: '600',
      color: theme === 'dark' ? '#ccc' : '#666',
      width: 100,
    },
    infoValue: {
      color: theme === 'dark' ? '#fff' : '#000',
      flex: 1,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noCustomersContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    noCustomersText: {
      fontSize: 18,
      color: theme === 'dark' ? '#ccc' : '#666',
      textAlign: 'center',
      marginBottom: 8,
    },
    noCustomersSubtext: {
      fontSize: 14,
      color: theme === 'dark' ? '#999' : '#999',
      textAlign: 'center',
      marginBottom: 20,
    },
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={{ color: theme === 'dark' ? '#fff' : '#000' }}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>{t('manageCustomers')}</Text>
        <Text style={dynamicStyles.subtitle}>
          {t('totalCustomers')}: {customers.length}
        </Text>
      </View>

      <View style={dynamicStyles.searchContainer}>
        <TextInput
          style={dynamicStyles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('searchCustomers')}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
        />
      </View>

      <View style={dynamicStyles.controlsContainer}>
        <View style={dynamicStyles.selectAllContainer}>
          <Checkbox
            status={selectAll ? 'checked' : 'unchecked'}
            onPress={handleSelectAll}
          />
          <Text style={dynamicStyles.selectAllText}>{t('selectAll')}</Text>
        </View>

        <Text style={dynamicStyles.selectedCount}>
          {selectedCustomers.length} {t('selectedCustomers')}
        </Text>

        <WebCompatibleButton
          onPress={handleDeleteSelected}
          mode="outlined"
          icon="delete"
          disabled={selectedCustomers.length === 0}
          style={{ borderColor: '#F44336' }}
          labelStyle={{ color: '#F44336' }}
        >
          {t('deleteSelected')}
        </WebCompatibleButton>
      </View>

      {filteredCustomers.length > 0 ? (
        <ScrollView>
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} style={dynamicStyles.customerCard}>
              <Card.Content>
                <View style={dynamicStyles.customerHeader}>
                  <Checkbox
                    status={selectedCustomers.includes(customer.id) ? 'checked' : 'unchecked'}
                    onPress={() => handleSelectCustomer(customer.id)}
                  />
                  <Text style={dynamicStyles.customerName}>{customer.name}</Text>
                </View>

                <View style={dynamicStyles.customerInfo}>
                  <View style={dynamicStyles.infoRow}>
                    <Text style={dynamicStyles.infoLabel}>{t('phoneNumber')}:</Text>
                    <Text style={dynamicStyles.infoValue}>{customer.phone}</Text>
                  </View>
                  
                  {customer.phone2 && (
                    <View style={dynamicStyles.infoRow}>
                      <Text style={dynamicStyles.infoLabel}>{t('phone2')}:</Text>
                      <Text style={dynamicStyles.infoValue}>{customer.phone2}</Text>
                    </View>
                  )}
                  
                  <View style={dynamicStyles.infoRow}>
                    <Text style={dynamicStyles.infoLabel}>{t('area')}:</Text>
                    <Text style={dynamicStyles.infoValue}>{customer.area}</Text>
                  </View>
                  
                  {customer.packageId && (
                    <View style={dynamicStyles.infoRow}>
                      <Text style={dynamicStyles.infoLabel}>{t('packageId')}:</Text>
                      <Text style={dynamicStyles.infoValue}>{customer.packageId}</Text>
                    </View>
                  )}
                  
                  {customer.packagePrice && (
                    <View style={dynamicStyles.infoRow}>
                      <Text style={dynamicStyles.infoLabel}>{t('packagePrice')}:</Text>
                      <Text style={dynamicStyles.infoValue}>{customer.packagePrice}</Text>
                    </View>
                  )}
                </View>

                <View style={dynamicStyles.buttonContainer}>
                  <WebCompatibleButton
                    onPress={() => navigation.navigate('AddCustomer', { customer })}
                    mode="outlined"
                    icon="pencil"
                  >
                    {t('edit')}
                  </WebCompatibleButton>

                  <WebCompatibleButton
                    onPress={() => handleDeleteCustomer(customer.id)}
                    mode="outlined"
                    icon="delete"
                    style={{ borderColor: '#F44336' }}
                    labelStyle={{ color: '#F44336' }}
                  >
                    {t('delete')}
                  </WebCompatibleButton>
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <View style={dynamicStyles.noCustomersContainer}>
          <Text style={dynamicStyles.noCustomersText}>
            {searchQuery ? t('noCustomersFound') : t('addFirstCustomer')}
          </Text>
          {!searchQuery && (
            <>
              <Text style={dynamicStyles.noCustomersSubtext}>
                Start by adding your first customer
              </Text>
              <WebCompatibleButton
                mode="contained"
                onPress={() => navigation.navigate('AddCustomer')}
                icon="plus"
              >
                {t('addCustomer')}
              </WebCompatibleButton>
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default WebCustomersScreen;

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Card,
  Button,
  Chip,
  FAB,
  Portal,
  Modal,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { AppContext } from '../context/AppContext';
import WebCompatibleButton from '../components/WebCompatibleButton';

const VCardScreen = ({ navigation, route }) => {
  const { t } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [vcardType, setVcardType] = useState('normal');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      
      // Get userId from current Supabase session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser();
      
      if (sessionError || !user) {
        console.error('Session error:', sessionError);
        Alert.alert('Error', 'User session not found. Please log in again.');
        return;
      }

      const userId = user.id;

      // Fetch customers directly from Supabase
      const { data: customersData, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching customers:', error);
        Alert.alert('Error', 'Failed to load customers from database');
        return;
      }

      setCustomers(customersData || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers from database');
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomers(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };

  const selectAllCustomers = () => {
    setSelectedCustomers(customers.map(c => c.id));
  };

  const deselectAllCustomers = () => {
    setSelectedCustomers([]);
  };


  // Direct contact import to device
  const generateVCard = async () => {
    if (selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    try {
      setGenerating(true);
      
      // Request contacts permission
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant contacts permission to import contacts directly to your device.');
        return;
      }

      const selectedCustomersData = customers.filter(c => selectedCustomers.includes(c.id));
      let successCount = 0;
      let errorCount = 0;

      for (const customer of selectedCustomersData) {
        try {
          let contact = {
            [Contacts.Fields.PhoneNumbers]: [
              {
                number: customer.phone,
                label: 'mobile',
                isPrimary: true,
              }
            ]
          };

          // Set name fields based on vcard type
          if (vcardType === 'normal') {
            // Normal: area as middle name, customer name as last name
            contact[Contacts.Fields.LastName] = customer.name || '';
            contact[Contacts.Fields.MiddleName] = customer.area || '';
          } else if (vcardType === 'withId') {
            // With ID: package ID as first name, customer name as last name
            contact[Contacts.Fields.FirstName] = String(customer.package_id || '');
            contact[Contacts.Fields.LastName] = customer.name || '';
          } else if (vcardType === 'none') {
            // Clean: only customer name as last name, no other fields
            contact[Contacts.Fields.LastName] = customer.name || '';
          }

          // Add second phone if available
          if (customer.phone2 && customer.phone2.trim() !== '') {
            contact[Contacts.Fields.PhoneNumbers].push({
              number: customer.phone2,
              label: 'work',
              isPrimary: false,
            });
          }

          // Add return indicator to name if needed
          if (customer.has_return) {
            contact[Contacts.Fields.LastName] = '®️🔻' + (contact[Contacts.Fields.LastName] || '');
          }

          // Add second phone indicator if needed
          if (customer.phone2 && 
              customer.phone2.length > 8 && 
              customer.phone2.length < 11 && 
              customer.phone2.slice(0, 2) === '05' && 
              customer.phone2 !== customer.phone) {
            contact[Contacts.Fields.LastName] = (contact[Contacts.Fields.LastName] || '') + '2️⃣';
          }

          await Contacts.addContactAsync(contact);
          successCount++;
        } catch (contactError) {
          console.error(`Error adding contact for ${customer.name}:`, contactError);
          errorCount++;
        }
      }

      Alert.alert(
        'Success', 
        `Contacts imported successfully!\n\n✅ Added: ${successCount} contacts\n❌ Failed: ${errorCount} contacts\n\nDirect contact import to device`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowModal(false);
              setSelectedCustomers([]);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error importing contacts:', error);
      Alert.alert('Error', 'Failed to import contacts directly to device');
    } finally {
      setGenerating(false);
    }
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
              {customer.phone2 && (
                <Text style={[dynamicStyles.customerPhone, dynamicStyles.secondaryPhone]}>
                  Phone 2: {customer.phone2}
                </Text>
              )}
              <Text style={dynamicStyles.customerArea}>{customer.area}</Text>
            </View>
            <View style={dynamicStyles.customerActions}>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color="#25D366" />
              )}
            </View>
          </View>
          
          <View style={dynamicStyles.customerDetails}>
            <View style={dynamicStyles.detailRow}>
              <Text style={dynamicStyles.detailLabel}>Package ID:</Text>
              <Text style={dynamicStyles.detailValue}>{customer.package_id}</Text>
            </View>
            {customer.has_return && (
              <Chip style={dynamicStyles.returnChip} icon="alert">
                Has Return
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={dynamicStyles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerInfo}>
          <Text style={dynamicStyles.title}>Contact Importer</Text>
          <Text style={dynamicStyles.subtitle}>
            {t('selectedCustomers')}: {selectedCustomers.length} / {customers.length}
          </Text>
        </View>
        
        <View style={dynamicStyles.headerActions}>
          <TouchableOpacity
            onPress={selectAllCustomers}
            style={[dynamicStyles.actionButton, dynamicStyles.selectAllButton]}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#25D366" />
            <Text style={dynamicStyles.actionText}>{t('selectAll')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={deselectAllCustomers}
            style={[dynamicStyles.actionButton, dynamicStyles.deselectButton]}
          >
            <Ionicons name="close-circle-outline" size={16} color="#FF3B30" />
            <Text style={dynamicStyles.actionText}>{t('deselectAll')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={dynamicStyles.customerList}
        contentContainerStyle={dynamicStyles.scrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
      >
        {customers.length === 0 ? (
          <Text style={dynamicStyles.noDataText}>No customers found</Text>
        ) : (
          customers.map(renderCustomerCard)
        )}
      </ScrollView>

      {/* Web-compatible import button */}
      {Platform.OS === 'web' ? (
        <View style={dynamicStyles.webButtonContainer}>
          <WebCompatibleButton
            mode="contained"
            icon={<Ionicons name="contacts" size={20} color="#FFFFFF" />}
            onPress={() => setShowModal(true)}
            disabled={selectedCustomers.length === 0}
            style={dynamicStyles.webImportButton}
            contentStyle={dynamicStyles.webButtonContent}
          >
            {t('generateVCard')} ({selectedCustomers.length})
          </WebCompatibleButton>
        </View>
      ) : (
        <FAB
          style={dynamicStyles.fab}
          icon="contacts"
          label={t('generateVCard')}
          onPress={() => setShowModal(true)}
          disabled={selectedCustomers.length === 0}
        />
      )}

      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={dynamicStyles.modalContent}
        >
          <View style={dynamicStyles.modalHeader}>
            <Text style={dynamicStyles.modalTitle}>{t('vCardGenerator')}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.modalBody}>
            <Text style={dynamicStyles.modalSubtitle}>Contact Format:</Text>
            
            <View style={dynamicStyles.typeOptions}>
              <TouchableOpacity
                style={[
                  dynamicStyles.typeOption,
                  vcardType === 'normal' && dynamicStyles.selectedTypeOption
                ]}
                onPress={() => setVcardType('normal')}
              >
                <Ionicons 
                  name={vcardType === 'normal' ? 'radio-button-on' : 'radio-button-off'} 
                  size={20} 
                  color={vcardType === 'normal' ? '#25D366' : '#666'} 
                />
                <View style={dynamicStyles.typeOptionContent}>
                  <Text style={dynamicStyles.typeOptionTitle}>Normal Contact</Text>
                  <Text style={dynamicStyles.typeOptionDescription}>Standard format with area as middle name</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  dynamicStyles.typeOption,
                  vcardType === 'withId' && dynamicStyles.selectedTypeOption
                ]}
                onPress={() => setVcardType('withId')}
              >
                <Ionicons 
                  name={vcardType === 'withId' ? 'radio-button-on' : 'radio-button-off'} 
                  size={20} 
                  color={vcardType === 'withId' ? '#25D366' : '#666'} 
                />
                <View style={dynamicStyles.typeOptionContent}>
                  <Text style={dynamicStyles.typeOptionTitle}>With ID Contact</Text>
                  <Text style={dynamicStyles.typeOptionDescription}>Includes package ID as first name</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  dynamicStyles.typeOption,
                  vcardType === 'none' && dynamicStyles.selectedTypeOption
                ]}
                onPress={() => setVcardType('none')}
              >
                <Ionicons 
                  name={vcardType === 'none' ? 'radio-button-on' : 'radio-button-off'} 
                  size={20} 
                  color={vcardType === 'none' ? '#25D366' : '#666'} 
                />
                <View style={dynamicStyles.typeOptionContent}>
                  <Text style={dynamicStyles.typeOptionTitle}>Clean Contact</Text>
                  <Text style={dynamicStyles.typeOptionDescription}>Only customer name, no area or ID</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#25D366" />
              <Text style={dynamicStyles.infoText}>
                Contacts will be imported directly to your device's contact list. No files will be created or shared.
              </Text>
            </View>
          </View>

          <View style={dynamicStyles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowModal(false)}
              style={dynamicStyles.modalButton}
            >
              {t('cancel')}
            </Button>
            <WebCompatibleButton
              mode="contained"
              onPress={generateVCard}
              loading={generating}
              disabled={generating}
              style={dynamicStyles.modalButton}
            >
              {generating ? t('generating') : t('generateVCard')}
            </WebCompatibleButton>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    ...(Platform.OS === 'web' && {
      height: '100vh',
      overflow: 'hidden',
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onBackground,
  },
  header: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  headerInfo: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  selectAllButton: {
    backgroundColor: theme.colors.primaryContainer,
  },
  deselectButton: {
    backgroundColor: theme.colors.errorContainer,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.onSurface,
  },
  customerList: {
    flex: 1,
    padding: 16,
    ...(Platform.OS === 'web' && {
      maxHeight: 'calc(100vh - 200px)', // Ensure it doesn't overflow viewport
      overflow: 'auto',
    }),
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'web' ? 120 : 16, // Extra padding for web button
    ...(Platform.OS === 'web' && {
      minHeight: '100%',
    }),
  },
  customerCard: {
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 2,
  },
  secondaryPhone: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  customerArea: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  customerActions: {
    marginLeft: 12,
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
    backgroundColor: theme.colors.tertiaryContainer,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#25D366',
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    margin: 20,
    borderRadius: 12,
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
  modalBody: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  typeOptions: {
    gap: 12,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  selectedTypeOption: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryContainer,
  },
  typeOptionContent: {
    marginLeft: 12,
    flex: 1,
  },
  typeOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  typeOptionDescription: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryContainer,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.onPrimaryContainer,
  },
  // Web-specific styles
  webButtonContainer: {
    position: 'fixed',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    }),
  },
  webImportButton: {
    backgroundColor: '#25D366',
  },
  webButtonContent: {
    paddingVertical: 8,
  },
});

export default VCardScreen; 
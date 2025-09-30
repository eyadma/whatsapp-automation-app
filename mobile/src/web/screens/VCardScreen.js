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
// Web-compatible contacts - placeholder
const Contacts = {
  getPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  requestPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  getContactsAsync: () => Promise.resolve({ data: [] }),
};
// Web-compatible storage
const AsyncStorage = {
  getItem: (key) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
};
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';

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


  // Generate VCF file for web download
  const generateVCard = async () => {
    if (selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    try {
      setGenerating(true);
      
      const selectedCustomersData = customers.filter(c => selectedCustomers.includes(c.id));
      let vcfContent = '';

      for (const customer of selectedCustomersData) {
        // Start VCard
        vcfContent += 'BEGIN:VCARD\n';
        vcfContent += 'VERSION:3.0\n';

        // Set name fields based on vcard type
        if (vcardType === 'normal') {
          // Normal: area as middle name, customer name as last name
          const lastName = customer.name || '';
          const middleName = customer.area || '';
          vcfContent += `FN:${lastName} ${middleName}\n`;
          vcfContent += `N:${lastName};${middleName};;;\n`;
        } else if (vcardType === 'withId') {
          // With ID: package ID as first name, customer name as last name
          const firstName = String(customer.package_id || '');
          const lastName = customer.name || '';
          vcfContent += `FN:${firstName} ${lastName}\n`;
          vcfContent += `N:${lastName};${firstName};;;\n`;
        } else if (vcardType === 'none') {
          // Clean: only customer name as last name, no other fields
          const lastName = customer.name || '';
          vcfContent += `FN:${lastName}\n`;
          vcfContent += `N:${lastName};;;;\n`;
        }

        // Add primary phone
        if (customer.phone) {
          vcfContent += `TEL;TYPE=CELL:${customer.phone}\n`;
        }

        // Add second phone if available
        if (customer.phone2 && customer.phone2.trim() !== '') {
          vcfContent += `TEL;TYPE=WORK:${customer.phone2}\n`;
        }

        // Add return indicator to name if needed
        if (customer.has_return) {
          const currentFN = vcfContent.split('\n').find(line => line.startsWith('FN:'));
          if (currentFN) {
            vcfContent = vcfContent.replace(currentFN, currentFN.replace('FN:', 'FN:®️🔻'));
          }
        }

        // Add second phone indicator if needed
        if (customer.phone2 && 
            customer.phone2.length > 8 && 
            customer.phone2.length < 11 && 
            customer.phone2.slice(0, 2) === '05' && 
            customer.phone2 !== customer.phone) {
          const currentFN = vcfContent.split('\n').find(line => line.startsWith('FN:'));
          if (currentFN) {
            vcfContent = vcfContent.replace(currentFN, currentFN + '2️⃣');
          }
        }

        // End VCard
        vcfContent += 'END:VCARD\n\n';
      }

      // Create and download the VCF file
      const blob = new Blob([vcfContent], { type: 'text/vcard' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts_${new Date().toISOString().split('T')[0]}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Alert.alert(
        'Success', 
        `VCF file generated successfully!\n\n✅ ${selectedCustomersData.length} contacts exported\n📁 File downloaded: contacts_${new Date().toISOString().split('T')[0]}.vcf\n\nYou can now import this file into your contacts app.`,
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
      console.error('Error generating VCF file:', error);
      Alert.alert('Error', 'Failed to generate VCF file');
    } finally {
      setGenerating(false);
    }
  };

  // Copy VCF content to clipboard for web
  const copyVCardToClipboard = async () => {
    if (selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    try {
      setGenerating(true);
      
      const selectedCustomersData = customers.filter(c => selectedCustomers.includes(c.id));
      let vcfContent = '';

      for (const customer of selectedCustomersData) {
        // Start VCard
        vcfContent += 'BEGIN:VCARD\n';
        vcfContent += 'VERSION:3.0\n';

        // Set name fields based on vcard type
        if (vcardType === 'normal') {
          // Normal: area as middle name, customer name as last name
          const lastName = customer.name || '';
          const middleName = customer.area || '';
          vcfContent += `FN:${lastName} ${middleName}\n`;
          vcfContent += `N:${lastName};${middleName};;;\n`;
        } else if (vcardType === 'withId') {
          // With ID: package ID as first name, customer name as last name
          const firstName = String(customer.package_id || '');
          const lastName = customer.name || '';
          vcfContent += `FN:${firstName} ${lastName}\n`;
          vcfContent += `N:${lastName};${firstName};;;\n`;
        } else if (vcardType === 'none') {
          // Clean: only customer name as last name, no other fields
          const lastName = customer.name || '';
          vcfContent += `FN:${lastName}\n`;
          vcfContent += `N:${lastName};;;;\n`;
        }

        // Add primary phone
        if (customer.phone) {
          vcfContent += `TEL;TYPE=CELL:${customer.phone}\n`;
        }

        // Add second phone if available
        if (customer.phone2 && customer.phone2.trim() !== '') {
          vcfContent += `TEL;TYPE=WORK:${customer.phone2}\n`;
        }

        // Add return indicator to name if needed
        if (customer.has_return) {
          const currentFN = vcfContent.split('\n').find(line => line.startsWith('FN:'));
          if (currentFN) {
            vcfContent = vcfContent.replace(currentFN, currentFN.replace('FN:', 'FN:®️🔻'));
          }
        }

        // Add second phone indicator if needed
        if (customer.phone2 && 
            customer.phone2.length > 8 && 
            customer.phone2.length < 11 && 
            customer.phone2.slice(0, 2) === '05' && 
            customer.phone2 !== customer.phone) {
          const currentFN = vcfContent.split('\n').find(line => line.startsWith('FN:'));
          if (currentFN) {
            vcfContent = vcfContent.replace(currentFN, currentFN + '2️⃣');
          }
        }

        // End VCard
        vcfContent += 'END:VCARD\n\n';
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(vcfContent);

      Alert.alert(
        'Success', 
        `VCF content copied to clipboard!\n\n✅ ${selectedCustomersData.length} contacts copied\n📋 You can now paste this into any contacts app or save as .vcf file.`,
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
      console.error('Error copying VCF to clipboard:', error);
      Alert.alert('Error', 'Failed to copy VCF content to clipboard');
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
          <Button
            mode="contained"
            icon="contacts"
            onPress={() => setShowModal(true)}
            disabled={selectedCustomers.length === 0}
            style={dynamicStyles.webImportButton}
            contentStyle={dynamicStyles.webButtonContent}
          >
            {t('generateVCard')} ({selectedCustomers.length})
          </Button>
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
                Choose to download a VCF file or copy the content to clipboard. VCF files can be imported into any contacts app.
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
            <Button
              mode="outlined"
              onPress={copyVCardToClipboard}
              loading={generating}
              disabled={generating}
              style={dynamicStyles.modalButton}
              icon="content-copy"
            >
              Copy VCF
            </Button>
            <Button
              mode="contained"
              onPress={generateVCard}
              loading={generating}
              disabled={generating}
              style={dynamicStyles.modalButton}
              icon="download"
            >
              {generating ? t('generating') : 'Download VCF'}
            </Button>
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
    marginHorizontal: 4,
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
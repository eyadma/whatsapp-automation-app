import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, Platform, Alert } from 'react-native';
import { Card, Title, Paragraph, TextInput, Chip, Checkbox } from 'react-native-paper';
import { AppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { enhancedMessageAPI } from '../../services/enhancedMessageAPI';
import WebCompatibleButton from '../components/WebCompatibleButton';

const WebEnhancedMessageScreen = ({ navigation }) => {
  const { userId, theme, t, language } = useContext(AppContext);
  const [templates, setTemplates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [messagePreview, setMessagePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectAllCustomers, setSelectAllCustomers] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesResult, customersResult] = await Promise.all([
        api.getTemplates(userId),
        api.getCustomers(userId)
      ]);

      if (templatesResult.success) {
        setTemplates(templatesResult.data || []);
      }

      if (customersResult.success) {
        setCustomers(customersResult.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('error'), 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    generatePreview();
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

  const handleSelectAllCustomers = () => {
    if (selectAllCustomers) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map(customer => customer.id));
    }
    setSelectAllCustomers(!selectAllCustomers);
  };

  const generatePreview = async () => {
    if (!selectedTemplate || selectedCustomers.length === 0) {
      setMessagePreview('');
      return;
    }

    try {
      const customer = customers.find(c => c.id === selectedCustomers[0]);
      if (!customer) return;

      const preview = await enhancedMessageAPI.getLocalizedMessage(
        selectedTemplate,
        customer,
        language
      );
      setMessagePreview(preview);
    } catch (error) {
      console.error('Error generating preview:', error);
      setMessagePreview('Error generating preview');
    }
  };

  const handleSendMessages = async () => {
    if (!selectedTemplate) {
      Alert.alert(t('error'), 'Please select a template');
      return;
    }

    if (selectedCustomers.length === 0) {
      Alert.alert(t('error'), 'Please select at least one customer');
      return;
    }

    Alert.alert(
      t('confirm'),
      `Send messages to ${selectedCustomers.length} customers?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('sendNow'),
          onPress: async () => {
            try {
              setSending(true);
              
              const selectedCustomerData = customers.filter(c => 
                selectedCustomers.includes(c.id)
              );

              const result = await enhancedMessageAPI.sendBulkMessages(
                selectedTemplate,
                selectedCustomerData,
                userId
              );

              if (result.success) {
                Alert.alert(t('success'), `Messages sent successfully to ${result.data.sentCount} customers`);
                setSelectedCustomers([]);
                setSelectAllCustomers(false);
              } else {
                Alert.alert(t('error'), result.error || 'Failed to send messages');
              }
            } catch (error) {
              console.error('Error sending messages:', error);
              Alert.alert(t('error'), 'Error sending messages');
            } finally {
              setSending(false);
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
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme === 'dark' ? '#fff' : '#000',
      marginBottom: 12,
    },
    card: {
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
      marginBottom: 12,
    },
    templateCard: {
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedTemplate: {
      borderColor: '#25D366',
    },
    templateName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme === 'dark' ? '#fff' : '#000',
      marginBottom: 4,
    },
    templateContent: {
      fontSize: 14,
      color: theme === 'dark' ? '#ccc' : '#666',
      marginBottom: 8,
    },
    customerCard: {
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
      marginBottom: 8,
    },
    customerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    customerName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme === 'dark' ? '#fff' : '#000',
      flex: 1,
      marginLeft: 8,
    },
    customerInfo: {
      fontSize: 12,
      color: theme === 'dark' ? '#ccc' : '#666',
      marginLeft: 8,
    },
    previewCard: {
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
    },
    previewText: {
      fontSize: 14,
      color: theme === 'dark' ? '#fff' : '#000',
      lineHeight: 20,
      backgroundColor: theme === 'dark' ? '#2e2e2e' : '#f8f8f8',
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
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
    sendButton: {
      marginTop: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noDataContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    noDataText: {
      fontSize: 16,
      color: theme === 'dark' ? '#ccc' : '#666',
      textAlign: 'center',
      marginBottom: 8,
    },
    noDataSubtext: {
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
        <Text style={dynamicStyles.title}>{t('sendMessages')}</Text>
        <Text style={dynamicStyles.subtitle}>
          Send personalized messages to your customers
        </Text>
      </View>

      <ScrollView>
        {/* Template Selection */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('selectTemplate')}</Text>
          {templates.length > 0 ? (
            templates.map((template) => (
              <Card
                key={template.id}
                style={[
                  dynamicStyles.templateCard,
                  selectedTemplate?.id === template.id && dynamicStyles.selectedTemplate
                ]}
                onPress={() => handleSelectTemplate(template)}
              >
                <Card.Content>
                  <Text style={dynamicStyles.templateName}>{template.name}</Text>
                  <Text style={dynamicStyles.templateContent}>
                    {template.template_english || template.template || 'No content'}
                  </Text>
                  <Chip
                    mode="outlined"
                    textStyle={{ fontSize: 12 }}
                  >
                    {template.language || 'en'}
                  </Chip>
                </Card.Content>
              </Card>
            ))
          ) : (
            <View style={dynamicStyles.noDataContainer}>
              <Text style={dynamicStyles.noDataText}>No templates available</Text>
              <Text style={dynamicStyles.noDataSubtext}>
                Create templates in the admin panel
              </Text>
            </View>
          )}
        </View>

        {/* Customer Selection */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('selectCustomers')}</Text>
          
          <View style={dynamicStyles.controlsContainer}>
            <View style={dynamicStyles.selectAllContainer}>
              <Checkbox
                status={selectAllCustomers ? 'checked' : 'unchecked'}
                onPress={handleSelectAllCustomers}
              />
              <Text style={dynamicStyles.selectAllText}>{t('selectAll')}</Text>
            </View>

            <Text style={dynamicStyles.selectedCount}>
              {selectedCustomers.length} {t('selectedCustomers')}
            </Text>
          </View>

          {customers.length > 0 ? (
            customers.map((customer) => (
              <Card key={customer.id} style={dynamicStyles.customerCard}>
                <Card.Content>
                  <View style={dynamicStyles.customerHeader}>
                    <Checkbox
                      status={selectedCustomers.includes(customer.id) ? 'checked' : 'unchecked'}
                      onPress={() => handleSelectCustomer(customer.id)}
                    />
                    <Text style={dynamicStyles.customerName}>{customer.name}</Text>
                  </View>
                  <Text style={dynamicStyles.customerInfo}>
                    {customer.phone} • {customer.area}
                  </Text>
                </Card.Content>
              </Card>
            ))
          ) : (
            <View style={dynamicStyles.noDataContainer}>
              <Text style={dynamicStyles.noDataText}>No customers available</Text>
              <Text style={dynamicStyles.noDataSubtext}>
                Add customers to send messages
              </Text>
            </View>
          )}
        </View>

        {/* Message Preview */}
        {messagePreview && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>{t('previewMessage')}</Text>
            <Card style={dynamicStyles.previewCard}>
              <Card.Content>
                <Text style={dynamicStyles.previewText}>{messagePreview}</Text>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Send Button */}
        <View style={dynamicStyles.sendButton}>
          <WebCompatibleButton
            onPress={handleSendMessages}
            mode="contained"
            icon="send"
            loading={sending}
            disabled={!selectedTemplate || selectedCustomers.length === 0 || sending}
          >
            {sending ? t('sending') : t('sendNow')}
          </WebCompatibleButton>
        </View>
      </ScrollView>
    </View>
  );
};

export default WebEnhancedMessageScreen;

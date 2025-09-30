import React, { useState, useContext } from 'react';
import { View, Text, ScrollView, Platform, Alert } from 'react-native';
import { Card, Title, Paragraph, TextInput, Chip } from 'react-native-paper';
import { AppContext } from '../../context/AppContext';
import { contactsService } from '../../services/contactsService';
import WebCompatibleButton from '../components/WebCompatibleButton';

const WebVCardScreen = ({ navigation }) => {
  const { userId, theme, t } = useContext(AppContext);
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    area: '',
    packageId: '',
    packagePrice: ''
  });
  const [vCardData, setVCardData] = useState('');
  const [loading, setLoading] = useState(false);

  const generateVCard = () => {
    if (!customerData.name || !customerData.phone) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    try {
      setLoading(true);
      
      // Generate vCard data
      const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${customerData.name}
N:${customerData.name};;;;
TEL:${customerData.phone}
ADR:;;${customerData.area};;;;
NOTE:Package ID: ${customerData.packageId || 'N/A'}, Price: ${customerData.packagePrice || 'N/A'}
END:VCARD`;

      setVCardData(vCard);
    } catch (error) {
      console.error('Error generating vCard:', error);
      Alert.alert(t('error'), 'Error generating vCard');
    } finally {
      setLoading(false);
    }
  };

  const downloadVCard = () => {
    if (!vCardData) {
      Alert.alert(t('error'), 'No vCard data to download');
      return;
    }

    try {
      // Create a blob with the vCard data
      const blob = new Blob([vCardData], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${customerData.name || 'contact'}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      URL.revokeObjectURL(url);
      
      Alert.alert(t('success'), t('vCardDownloaded'));
    } catch (error) {
      console.error('Error downloading vCard:', error);
      Alert.alert(t('error'), 'Error downloading vCard');
    }
  };

  const copyVCard = () => {
    if (!vCardData) {
      Alert.alert(t('error'), 'No vCard data to copy');
      return;
    }

    try {
      navigator.clipboard.writeText(vCardData).then(() => {
        Alert.alert(t('success'), t('vCardCopied'));
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = vCardData;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        Alert.alert(t('success'), t('vCardCopied'));
      });
    } catch (error) {
      console.error('Error copying vCard:', error);
      Alert.alert(t('error'), 'Error copying vCard');
    }
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
    formCard: {
      marginBottom: 20,
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme === 'dark' ? '#fff' : '#000',
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme === 'dark' ? '#2e2e2e' : '#f8f8f8',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    resultCard: {
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
    },
    vCardPreview: {
      backgroundColor: theme === 'dark' ? '#2e2e2e' : '#f8f8f8',
      padding: 12,
      borderRadius: 8,
      marginTop: 12,
      fontFamily: 'monospace',
      fontSize: 12,
      color: theme === 'dark' ? '#ccc' : '#333',
      minHeight: 200,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
  };

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>{t('vCardGenerator')}</Text>
        <Text style={dynamicStyles.subtitle}>
          Generate and download vCard files for your contacts
        </Text>
      </View>

      <Card style={dynamicStyles.formCard}>
        <Card.Content>
          <Title>{t('customerInformation')}</Title>
          
          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>{t('customerName')} *</Text>
            <TextInput
              style={dynamicStyles.input}
              value={customerData.name}
              onChangeText={(text) => setCustomerData({ ...customerData, name: text })}
              placeholder="Enter customer name"
              mode="outlined"
            />
          </View>

          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>{t('phoneNumber')} *</Text>
            <TextInput
              style={dynamicStyles.input}
              value={customerData.phone}
              onChangeText={(text) => setCustomerData({ ...customerData, phone: text })}
              placeholder="Enter phone number"
              mode="outlined"
              keyboardType="phone-pad"
            />
          </View>

          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>{t('area')}</Text>
            <TextInput
              style={dynamicStyles.input}
              value={customerData.area}
              onChangeText={(text) => setCustomerData({ ...customerData, area: text })}
              placeholder="Enter area"
              mode="outlined"
            />
          </View>

          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>{t('packageId')}</Text>
            <TextInput
              style={dynamicStyles.input}
              value={customerData.packageId}
              onChangeText={(text) => setCustomerData({ ...customerData, packageId: text })}
              placeholder="Enter package ID"
              mode="outlined"
            />
          </View>

          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>{t('packagePrice')}</Text>
            <TextInput
              style={dynamicStyles.input}
              value={customerData.packagePrice}
              onChangeText={(text) => setCustomerData({ ...customerData, packagePrice: text })}
              placeholder="Enter package price"
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <View style={dynamicStyles.buttonContainer}>
            <WebCompatibleButton
              onPress={generateVCard}
              mode="contained"
              icon="file-document-outline"
              loading={loading}
              disabled={loading}
            >
              {t('generateVCard')}
            </WebCompatibleButton>
          </View>
        </Card.Content>
      </Card>

      {vCardData && (
        <Card style={dynamicStyles.resultCard}>
          <Card.Content>
            <Title>{t('vCardPreview')}</Title>
            <Text style={dynamicStyles.vCardPreview}>
              {vCardData}
            </Text>
            
            <View style={dynamicStyles.actionButtons}>
              <WebCompatibleButton
                onPress={downloadVCard}
                mode="contained"
                icon="download"
              >
                {t('downloadVCard')}
              </WebCompatibleButton>
              
              <WebCompatibleButton
                onPress={copyVCard}
                mode="outlined"
                icon="content-copy"
              >
                {t('copyVCard')}
              </WebCompatibleButton>
            </View>
          </Card.Content>
        </Card>
      )}
    </View>
  );
};

export default WebVCardScreen;

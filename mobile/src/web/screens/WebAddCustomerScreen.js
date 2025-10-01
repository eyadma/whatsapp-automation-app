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
import WebCompatiblePicker from '../components/WebCompatiblePicker';

const WebAddCustomerScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    phone2: '',
    areaId: null,
    packageId: '',
    packagePrice: '',
  });

  useEffect(() => {
    loadAreas();
  }, []);

  const loadAreas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('name_english');

      if (error) {
        console.error('Error loading areas:', error);
        Alert.alert('Error', 'Failed to load areas');
        return;
      }

      setAreas(data || []);
    } catch (error) {
      console.error('Error loading areas:', error);
      Alert.alert('Error', 'Failed to load areas');
    } finally {
      setLoading(false);
    }
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
      setSaving(true);
      
      const customerData = {
        user_id: userId,
        name: formData.name.trim(),
        phone_number: formData.phoneNumber.trim(),
        phone2: formData.phone2.trim() || null,
        area_id: formData.areaId,
        package_id: formData.packageId.trim() || null,
        package_price: formData.packagePrice.trim() || null,
      };

      const { error } = await supabase
        .from('customers')
        .insert([customerData]);

      if (error) {
        console.error('Error creating customer:', error);
        Alert.alert('Error', 'Failed to create customer');
        return;
      }

      Alert.alert('Success', 'Customer created successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setFormData({
              name: '',
              phoneNumber: '',
              phone2: '',
              areaId: null,
              packageId: '',
              packagePrice: '',
            });
            // Navigate back to customers screen
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating customer:', error);
      Alert.alert('Error', 'Failed to create customer');
    } finally {
      setSaving(false);
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
        <Text style={dynamicStyles.loadingText}>Loading areas...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Add New Customer
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Enter customer information to add them to your database
        </WebCompatibleParagraph>
      </View>

      <WebCompatibleCard style={dynamicStyles.formCard}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.formTitle}>
            Customer Information
          </WebCompatibleTitle>
          
          <WebCompatibleTextInput
            label="Customer Name *"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter customer name"
            style={dynamicStyles.input}
          />
          
          <WebCompatibleTextInput
            label="Phone Number *"
            value={formData.phoneNumber}
            onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            style={dynamicStyles.input}
          />
          
          <WebCompatibleTextInput
            label="Phone 2 (Optional)"
            value={formData.phone2}
            onChangeText={(text) => setFormData({ ...formData, phone2: text })}
            placeholder="Enter second phone number"
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
            placeholder="Enter package ID"
            style={dynamicStyles.input}
          />
          
          <WebCompatibleTextInput
            label="Package Price (Optional)"
            value={formData.packagePrice}
            onChangeText={(text) => setFormData({ ...formData, packagePrice: text })}
            placeholder="Enter package price"
            keyboardType="numeric"
            style={dynamicStyles.input}
          />
          
          <View style={dynamicStyles.formActions}>
            <WebCompatibleButton
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={dynamicStyles.cancelButton}
            >
              Cancel
            </WebCompatibleButton>
            <WebCompatibleButton
              mode="contained"
              onPress={handleSaveCustomer}
              loading={saving}
              disabled={saving}
              style={dynamicStyles.saveButton}
            >
              {saving ? 'Saving...' : 'Save Customer'}
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Instructions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Instructions
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Customer name and phone number are required fields
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Phone 2 is optional for additional contact information
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Select an area from the dropdown list
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Package ID and price are optional for tracking purposes
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • All information will be used for personalized messaging
          </WebCompatibleParagraph>
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
  formCard: {
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  picker: {
    marginBottom: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    justifyContent: 'center',
  },
  cancelButton: {
    minWidth: 120,
  },
  saveButton: {
    minWidth: 120,
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
  instructionText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
});

export default WebAddCustomerScreen;

import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Switch, HelperText, ActivityIndicator, Divider, useTheme } from 'react-native-paper';
import { customersAPI } from '../services/api';
import { AppContext } from '../context/AppContext';
import { Picker } from '@react-native-picker/picker';

const AddCustomerScreen = ({ navigation }) => {
  const { userId, t } = useContext(AppContext);
  const paperTheme = useTheme();
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    phone2: '',
    area: '',
    areaId: null, // Changed from areaid to areaId (camelCase)
    package_price: '',
    package_id: '',
    business_name: '',
    has_return: false,
    tracking_number: '',
    items_description: '',
    quantity: '1'
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const response = await fetch('https://your-supabase-url.supabase.co/rest/v1/areas?select=*', {
        headers: {
          'apikey': 'your-supabase-anon-key',
          'Authorization': `Bearer your-supabase-anon-key`
        }
      });
      const data = await response.json();
      setAreas(data);
    } catch (error) {
      console.error('Error fetching areas:', error);
    }
  };

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = t('Name is required');
    if (!formData.phone) newErrors.phone = t('Phone is required');
    
    // Validate phone format (simple validation)
    if (formData.phone && !/^\+?[0-9]{10,15}$/.test(formData.phone)) {
      newErrors.phone = t('Invalid phone number format');
    }
    
    // Validate phone2 format if provided (Israeli format: 05xxxxxxxxx)
    if (formData.phone2 && formData.phone2.trim() !== '') {
      const phone2Clean = formData.phone2.trim();
      if (!phone2Clean.startsWith('05') || phone2Clean.length !== 10 || !/^\d+$/.test(phone2Clean)) {
        newErrors.phone2 = t('Phone2 must be in Israeli format (05xxxxxxxxx)');
      }
    }
    
    // Validate price (if provided)
    if (formData.package_price && isNaN(Number(formData.package_price))) {
      newErrors.package_price = t('Price must be a number');
    }

    // Validate quantity (if provided)
    if (formData.quantity && isNaN(Number(formData.quantity))) {
      newErrors.quantity = t('Quantity must be a number');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      // Convert string values to appropriate types
      const customerData = {
        ...formData,
        user_id: userId,
        package_price: formData.package_price ? Number(formData.package_price) : null,
        quantity: formData.quantity ? Number(formData.quantity) : 1,
        areaId: formData.areaId ? Number(formData.areaId) : null
      };
      
      await customersAPI.create(customerData);
      Alert.alert(t('Success'), t('Customer added successfully'));
      navigation.goBack();
    } catch (error) {
      console.error('Error creating customer:', error);
      Alert.alert(t('Error'), t('Failed to add customer. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={dynamicStyles.loadingText}>{t('Adding customer...')}</Text>
      </View>
    );
  }

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.formContainer}>
        <Text style={dynamicStyles.title}>{t('Add New Customer')}</Text>
        
        <TextInput
          label={t('Name')}
          value={formData.name}
          onChangeText={(value) => handleChange('name', value)}
          style={dynamicStyles.input}
          error={!!errors.name}
        />
        {errors.name && <HelperText type="error">{errors.name}</HelperText>}
        
        <TextInput
          label={t('Phone')}
          value={formData.phone}
          onChangeText={(value) => handleChange('phone', value)}
          style={dynamicStyles.input}
          keyboardType="phone-pad"
          error={!!errors.phone}
        />
        {errors.phone && <HelperText type="error">{errors.phone}</HelperText>}
        
        <TextInput
          label={t('Phone 2')}
          value={formData.phone2}
          onChangeText={(value) => handleChange('phone2', value)}
          style={dynamicStyles.input}
          keyboardType="phone-pad"
          placeholder="05xxxxxxxxx"
          error={!!errors.phone2}
        />
        {errors.phone2 && <HelperText type="error">{errors.phone2}</HelperText>}
        <HelperText type="info">{t('Optional: Israeli format only')}</HelperText>
        
        <TextInput
          label={t('Area (Text)')}
          value={formData.area}
          onChangeText={(value) => handleChange('area', value)}
          style={dynamicStyles.input}
        />
        
        <Text style={dynamicStyles.label}>{t('Area')}</Text>
        <View style={dynamicStyles.pickerContainer}>
          <Picker
                    selectedValue={formData.areaId}
        onValueChange={(value) => handleChange('areaId', value)}
            style={dynamicStyles.picker}
          >
            <Picker.Item label={t('Select Area')} value={null} />
            {areas.map((area) => (
              <Picker.Item 
                key={area.areaid} 
                label={area.name_english} 
                value={area.areaid} 
              />
            ))}
          </Picker>
        </View>
        
        <TextInput
          label={t('Package Price (₪)')}
          value={formData.package_price}
          onChangeText={(value) => handleChange('package_price', value)}
          style={dynamicStyles.input}
          keyboardType="numeric"
          error={!!errors.package_price}
        />
        {errors.package_price && <HelperText type="error">{errors.package_price}</HelperText>}
        
        <TextInput
          label={t('Package ID')}
          value={formData.package_id}
          onChangeText={(value) => handleChange('package_id', value)}
          style={dynamicStyles.input}
        />
        
        <TextInput
          label={t('Business Name')}
          value={formData.business_name}
          onChangeText={(value) => handleChange('business_name', value)}
          style={dynamicStyles.input}
        />
        
        <TextInput
          label={t('Tracking Number')}
          value={formData.tracking_number}
          onChangeText={(value) => handleChange('tracking_number', value)}
          style={dynamicStyles.input}
        />
        
        <TextInput
          label={t('Items Description')}
          value={formData.items_description}
          onChangeText={(value) => handleChange('items_description', value)}
          style={dynamicStyles.input}
          multiline
        />
        
        <TextInput
          label={t('Quantity')}
          value={formData.quantity}
          onChangeText={(value) => handleChange('quantity', value)}
          style={dynamicStyles.input}
          keyboardType="numeric"
          error={!!errors.quantity}
        />
        {errors.quantity && <HelperText type="error">{errors.quantity}</HelperText>}
        
        <View style={dynamicStyles.switchContainer}>
          <Text>{t('Has Return Item')}</Text>
          <Switch
            value={formData.has_return}
            onValueChange={(value) => handleChange('has_return', value)}
          />
        </View>
        
        <Divider style={dynamicStyles.divider} />
        
        <Button 
          mode="contained" 
          onPress={handleSubmit} 
          style={dynamicStyles.button}
        >
          {t('Add Customer')}
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={() => navigation.goBack()} 
          style={dynamicStyles.button}
        >
          {t('Cancel')}
        </Button>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  formContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 10,
    backgroundColor: theme.colors.surface,
  },
  button: {
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: theme.colors.surface,
  },
  picker: {
    height: 50,
  },
  divider: {
    marginVertical: 15,
  }
});

export default AddCustomerScreen; 
import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { AppContext } from '../../context/AppContext';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTextInput from '../components/WebCompatibleTextInput';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';
import WebCompatiblePicker from '../components/WebCompatiblePicker';
import WebCompatibleCheckbox from '../components/WebCompatibleCheckbox';

const WebAdminSettings = ({ navigation }) => {
  const { 
    userId, 
    t, 
    language, 
    setLanguage, 
    theme, 
    setTheme,
    setUserId,
    setUser 
  } = useContext(AppContext);

  const [loading, setLoading] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    appName: 'WhatsApp Manager',
    appVersion: '1.3.0',
    maxUsers: 100,
    maxCustomersPerUser: 1000,
    maxSessionsPerUser: 5,
    messageRateLimit: 100,
    enableRegistration: true,
    enableAnalytics: true,
    enableLogging: true,
  });

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    // Save to AsyncStorage or other persistence
    console.log('Language changed to:', newLanguage);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    // Save to AsyncStorage or other persistence
    console.log('Theme changed to:', newTheme);
  };

  const handleSystemSettingChange = (key, value) => {
    setSystemSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSystemSettings = async () => {
    try {
      setLoading(true);
      // Here you would save the system settings to your backend
      // For now, we'll just simulate the save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert('Success', 'System settings saved successfully');
    } catch (error) {
      console.error('Error saving system settings:', error);
      Alert.alert('Error', 'Failed to save system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSystemSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all system settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSystemSettings({
              appName: 'WhatsApp Manager',
              appVersion: '1.3.0',
              maxUsers: 100,
              maxCustomersPerUser: 1000,
              maxSessionsPerUser: 5,
              messageRateLimit: 100,
              enableRegistration: true,
              enableAnalytics: true,
              enableLogging: true,
            });
            Alert.alert('Success', 'System settings reset to default values');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // Clear user data
              setUserId(null);
              setUser(null);
              // Navigate to login screen
              navigation.navigate('Login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const dynamicStyles = createStyles();

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          System Settings
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Configure system-wide settings and preferences
        </WebCompatibleParagraph>
      </View>

      {/* Interface Settings */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Interface Settings
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Configure the user interface and display preferences
          </WebCompatibleParagraph>
          
          <WebCompatiblePicker
            selectedValue={language}
            onValueChange={handleLanguageChange}
            style={dynamicStyles.picker}
          >
            <WebCompatiblePicker.Item label="English" value="en" />
            <WebCompatiblePicker.Item label="العربية (Arabic)" value="ar" />
            <WebCompatiblePicker.Item label="עברית (Hebrew)" value="he" />
          </WebCompatiblePicker>

          <WebCompatiblePicker
            selectedValue={theme}
            onValueChange={handleThemeChange}
            style={dynamicStyles.picker}
          >
            <WebCompatiblePicker.Item label="Light Theme" value="light" />
            <WebCompatiblePicker.Item label="Dark Theme" value="dark" />
          </WebCompatiblePicker>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* System Configuration */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            System Configuration
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Configure system limits and operational parameters
          </WebCompatibleParagraph>
          
          <WebCompatibleTextInput
            label="Maximum Users"
            value={systemSettings.maxUsers.toString()}
            onChangeText={(text) => handleSystemSettingChange('maxUsers', parseInt(text) || 100)}
            keyboardType="numeric"
            style={dynamicStyles.input}
          />
          
          <WebCompatibleTextInput
            label="Maximum Customers per User"
            value={systemSettings.maxCustomersPerUser.toString()}
            onChangeText={(text) => handleSystemSettingChange('maxCustomersPerUser', parseInt(text) || 1000)}
            keyboardType="numeric"
            style={dynamicStyles.input}
          />
          
          <WebCompatibleTextInput
            label="Maximum Sessions per User"
            value={systemSettings.maxSessionsPerUser.toString()}
            onChangeText={(text) => handleSystemSettingChange('maxSessionsPerUser', parseInt(text) || 5)}
            keyboardType="numeric"
            style={dynamicStyles.input}
          />
          
          <WebCompatibleTextInput
            label="Message Rate Limit (per hour)"
            value={systemSettings.messageRateLimit.toString()}
            onChangeText={(text) => handleSystemSettingChange('messageRateLimit', parseInt(text) || 100)}
            keyboardType="numeric"
            style={dynamicStyles.input}
          />
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Feature Toggles */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Feature Toggles
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Enable or disable system features
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.toggleContainer}>
            <View style={dynamicStyles.toggleItem}>
              <Text style={dynamicStyles.toggleLabel}>Enable User Registration</Text>
              <WebCompatibleCheckbox
                status={systemSettings.enableRegistration ? 'checked' : 'unchecked'}
                onPress={() => handleSystemSettingChange('enableRegistration', !systemSettings.enableRegistration)}
              />
            </View>
            
            <View style={dynamicStyles.toggleItem}>
              <Text style={dynamicStyles.toggleLabel}>Enable Analytics</Text>
              <WebCompatibleCheckbox
                status={systemSettings.enableAnalytics ? 'checked' : 'unchecked'}
                onPress={() => handleSystemSettingChange('enableAnalytics', !systemSettings.enableAnalytics)}
              />
            </View>
            
            <View style={dynamicStyles.toggleItem}>
              <Text style={dynamicStyles.toggleLabel}>Enable System Logging</Text>
              <WebCompatibleCheckbox
                status={systemSettings.enableLogging ? 'checked' : 'unchecked'}
                onPress={() => handleSystemSettingChange('enableLogging', !systemSettings.enableLogging)}
              />
            </View>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* System Information */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            System Information
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Current system status and information
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.infoContainer}>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>App Name:</Text>
              <Text style={dynamicStyles.infoValue}>{systemSettings.appName}</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>App Version:</Text>
              <Text style={dynamicStyles.infoValue}>{systemSettings.appVersion}</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Platform:</Text>
              <Text style={dynamicStyles.infoValue}>Web</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Database:</Text>
              <Text style={dynamicStyles.infoValue}>Supabase</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Current Language:</Text>
              <Text style={dynamicStyles.infoValue}>
                {language === 'en' ? 'English' : 
                 language === 'ar' ? 'العربية' : 
                 language === 'he' ? 'עברית' : 'Unknown'}
              </Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Current Theme:</Text>
              <Text style={dynamicStyles.infoValue}>
                {theme === 'light' ? 'Light' : 'Dark'}
              </Text>
            </View>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Actions
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            System management actions
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.actionsContainer}>
            <WebCompatibleButton
              mode="contained"
              onPress={handleSaveSystemSettings}
              loading={loading}
              disabled={loading}
              style={dynamicStyles.actionButton}
            >
              Save Settings
            </WebCompatibleButton>
            
            <WebCompatibleButton
              mode="outlined"
              onPress={handleResetSystemSettings}
              style={dynamicStyles.actionButton}
            >
              Reset to Default
            </WebCompatibleButton>
            
            <WebCompatibleButton
              mode="outlined"
              onPress={() => navigation.navigate('Dashboard')}
              style={dynamicStyles.actionButton}
            >
              Back to Dashboard
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Account Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Account Actions
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Manage your admin account
          </WebCompatibleParagraph>
          
          <WebCompatibleButton
            mode="outlined"
            onPress={handleLogout}
            loading={loading}
            disabled={loading}
            style={dynamicStyles.logoutButton}
          >
            Logout
          </WebCompatibleButton>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Footer */}
      <View style={dynamicStyles.footer}>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          WhatsApp Manager System Settings
        </WebCompatibleParagraph>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          Version 1.3.0 - Web Platform
        </WebCompatibleParagraph>
      </View>
    </ScrollView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
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
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  picker: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  toggleContainer: {
    gap: 16,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  infoContainer: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '400',
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  actionButton: {
    minWidth: 150,
    marginBottom: 8,
  },
  logoutButton: {
    borderColor: '#F44336',
    marginTop: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default WebAdminSettings;

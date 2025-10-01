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
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';
import WebCompatiblePicker from '../components/WebCompatiblePicker';

const WebSettingsScreen = ({ navigation }) => {
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
          Settings
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Manage your app preferences and account settings
        </WebCompatibleParagraph>
      </View>

      {/* Language Settings */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Language Settings
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Choose your preferred language for the app interface
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
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Theme Settings */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Theme Settings
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Choose your preferred theme for the app interface
          </WebCompatibleParagraph>
          
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

      {/* Account Settings */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Account Settings
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Manage your account and session settings
          </WebCompatibleParagraph>
          
          <WebCompatibleList>
            <WebCompatibleList.Item
              title="Manage WhatsApp Sessions"
              description="Create and manage your WhatsApp connections"
              onPress={() => navigation.navigate('Sessions')}
              right={<Text style={dynamicStyles.arrow}>›</Text>}
            />
            <WebCompatibleList.Item
              title="User Management"
              description="Manage users and permissions (Admin only)"
              onPress={() => navigation.navigate('UserManagement')}
              right={<Text style={dynamicStyles.arrow}>›</Text>}
            />
          </WebCompatibleList>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* App Information */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            App Information
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Information about the app and your account
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.infoContainer}>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>App Version:</Text>
              <Text style={dynamicStyles.infoValue}>1.3.0</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>User ID:</Text>
              <Text style={dynamicStyles.infoValue}>{userId || 'Not available'}</Text>
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

      {/* Logout */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Account Actions
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Manage your account and session
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
          WhatsApp Manager - Professional messaging platform
        </WebCompatibleParagraph>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          Version 1.3.0
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
  arrow: {
    fontSize: 24,
    color: '#666666',
    fontWeight: 'bold',
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

export default WebSettingsScreen;

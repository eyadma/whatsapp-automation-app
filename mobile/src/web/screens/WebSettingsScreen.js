import React, { useState, useContext } from 'react';
import { View, Text, ScrollView, Platform, Alert } from 'react-native';
import { Card, Title, Paragraph, Switch, List } from 'react-native-paper';
import { AppContext } from '../../context/AppContext';
import { supabase } from '../../services/supabase';
import WebCompatibleButton from '../components/WebCompatibleButton';

const WebSettingsScreen = ({ navigation }) => {
  const { userId, theme, language, setTheme, setLanguage, t } = useContext(AppContext);
  const [saving, setSaving] = useState(false);

  const handleThemeChange = async (newTheme) => {
    try {
      setSaving(true);
      setTheme(newTheme);
      // Save to localStorage for web
      if (Platform.OS === 'web') {
        localStorage.setItem('userTheme', newTheme);
      }
      Alert.alert(t('success'), 'Theme updated successfully');
    } catch (error) {
      console.error('Error updating theme:', error);
      Alert.alert(t('error'), 'Error updating theme');
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (newLanguage) => {
    try {
      setSaving(true);
      setLanguage(newLanguage);
      // Save to localStorage for web
      if (Platform.OS === 'web') {
        localStorage.setItem('userLanguage', newLanguage);
      }
      Alert.alert(t('success'), 'Language updated successfully');
    } catch (error) {
      console.error('Error updating language:', error);
      Alert.alert(t('error'), 'Error updating language');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('sureToLogout'),
      '',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Clear localStorage for web
              if (Platform.OS === 'web') {
                localStorage.removeItem('userTheme');
                localStorage.removeItem('userLanguage');
              }
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert(t('error'), 'Error logging out');
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
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    settingLabel: {
      fontSize: 16,
      color: theme === 'dark' ? '#fff' : '#000',
      flex: 1,
    },
    settingDescription: {
      fontSize: 14,
      color: theme === 'dark' ? '#ccc' : '#666',
      marginTop: 4,
    },
    languageOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme === 'dark' ? '#333' : '#eee',
    },
    selectedLanguage: {
      backgroundColor: theme === 'dark' ? '#2e2e2e' : '#f0f0f0',
    },
    languageText: {
      fontSize: 16,
      color: theme === 'dark' ? '#fff' : '#000',
    },
    logoutButton: {
      marginTop: 20,
      borderColor: '#F44336',
    },
    logoutButtonText: {
      color: '#F44336',
    },
  };

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>{t('settings')}</Text>
        <Text style={dynamicStyles.subtitle}>
          Customize your app experience
        </Text>
      </View>

      <ScrollView>
        {/* Appearance Settings */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Appearance</Text>
          <Card style={dynamicStyles.card}>
            <View style={dynamicStyles.settingItem}>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.settingLabel}>Dark Mode</Text>
                <Text style={dynamicStyles.settingDescription}>
                  Switch between light and dark themes
                </Text>
              </View>
              <Switch
                value={theme === 'dark'}
                onValueChange={(value) => handleThemeChange(value ? 'dark' : 'light')}
                disabled={saving}
              />
            </View>
          </Card>
        </View>

        {/* Language Settings */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('language')}</Text>
          <Card style={dynamicStyles.card}>
            <View style={[
              dynamicStyles.languageOption,
              language === 'en' && dynamicStyles.selectedLanguage
            ]}>
              <Text
                style={dynamicStyles.languageText}
                onPress={() => handleLanguageChange('en')}
              >
                English
              </Text>
            </View>
            <View style={[
              dynamicStyles.languageOption,
              language === 'ar' && dynamicStyles.selectedLanguage
            ]}>
              <Text
                style={dynamicStyles.languageText}
                onPress={() => handleLanguageChange('ar')}
              >
                العربية
              </Text>
            </View>
            <View style={[
              dynamicStyles.languageOption,
              language === 'he' && dynamicStyles.selectedLanguage
            ]}>
              <Text
                style={dynamicStyles.languageText}
                onPress={() => handleLanguageChange('he')}
              >
                עברית
              </Text>
            </View>
          </Card>
        </View>

        {/* Account Settings */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Account</Text>
          <Card style={dynamicStyles.card}>
            <List.Item
              title="Manage WhatsApp Sessions"
              description="Configure your WhatsApp connections"
              left={(props) => <List.Icon {...props} icon="whatsapp" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Sessions')}
            />
          </Card>
        </View>

        {/* About */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>About</Text>
          <Card style={dynamicStyles.card}>
            <Card.Content>
              <Title>WhatsApp Automation</Title>
              <Paragraph>
                Version 1.3.0
              </Paragraph>
              <Paragraph>
                A powerful tool for managing WhatsApp messaging and customer communication.
              </Paragraph>
            </Card.Content>
          </Card>
        </View>

        {/* Logout */}
        <WebCompatibleButton
          onPress={handleLogout}
          mode="outlined"
          icon="logout"
          style={dynamicStyles.logoutButton}
          labelStyle={dynamicStyles.logoutButtonText}
        >
          {t('logout')}
        </WebCompatibleButton>
      </ScrollView>
    </View>
  );
};

export default WebSettingsScreen;

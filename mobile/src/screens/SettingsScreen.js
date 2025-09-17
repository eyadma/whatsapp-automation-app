import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, Button, TextInput, Divider, List, RadioButton, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';

const SettingsScreen = ({ navigation }) => {
  const { user, userId, setUser, setUserId, language, setLanguage, theme, setTheme, t } = useContext(AppContext);
  const paperTheme = useTheme();
  const [loading, setLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  ];

  const themes = [
    { code: 'light', name: t('light'), icon: 'sunny' },
    { code: 'dark', name: t('dark'), icon: 'moon' },
    { code: 'auto', name: t('auto'), icon: 'settings' },
  ];

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert(t('error'), t('passwordsDontMatch'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert(t('error'), t('passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      Alert.alert(t('success'), t('passwordUpdatedSuccessfully'));
      setShowPasswordForm(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      Alert.alert(t('error'), 'Failed to update password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t('logout'),
      t('sureToLogout'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              setUser(null);
              setUserId(null);
              // Navigation will be handled by App.js based on auth state
            } catch (error) {
              Alert.alert(t('error'), 'Failed to logout: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const savePreferences = async () => {
    try {
      // Save preferences to AsyncStorage
      await AsyncStorage.setItem('userLanguage', language);
      await AsyncStorage.setItem('userTheme', theme);
      Alert.alert(t('success'), t('preferencesSavedSuccessfully'));
    } catch (error) {
      Alert.alert(t('error'), 'Failed to save preferences: ' + error.message);
    }
  };

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <ScrollView style={dynamicStyles.container}>
      {/* User Profile Section */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.profileHeader}>
            <View style={dynamicStyles.avatar}>
              <Ionicons name="person" size={40} color="#25D366" />
            </View>
            <View style={dynamicStyles.profileInfo}>
              <Text style={dynamicStyles.userName}>{user?.email || t('user')}</Text>
              <Text style={dynamicStyles.userRole}>{user?.user_metadata?.role || t('regularUser')}</Text>
              <Text style={dynamicStyles.userId}>ID: {userId}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Language Settings */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <Text style={dynamicStyles.sectionTitle}>{t('language')} / اللغة / שפה</Text>
          <Divider style={dynamicStyles.divider} />
          {languages.map((lang) => (
            <List.Item
              key={lang.code}
              title={lang.name}
              description={lang.nativeName}
              left={(props) => (
                <RadioButton
                  value={lang.code}
                  status={language === lang.code ? 'checked' : 'unchecked'}
                  onPress={() => setLanguage(lang.code)}
                />
              )}
              onPress={() => setLanguage(lang.code)}
              style={dynamicStyles.listItem}
            />
          ))}
        </Card.Content>
      </Card>

      {/* Theme Settings */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <Text style={dynamicStyles.sectionTitle}>{t('theme')}</Text>
          <Divider style={dynamicStyles.divider} />
          {themes.map((themeOption) => (
            <List.Item
              key={themeOption.code}
              title={themeOption.name}
              left={(props) => (
                <Ionicons 
                  name={themeOption.icon} 
                  size={24} 
                  color={theme === themeOption.code ? '#25D366' : '#666'} 
                />
              )}
              right={(props) => (
                <RadioButton
                  value={themeOption.code}
                  status={theme === themeOption.code ? 'checked' : 'unchecked'}
                  onPress={() => setTheme(themeOption.code)}
                />
              )}
              onPress={() => setTheme(themeOption.code)}
              style={dynamicStyles.listItem}
            />
          ))}
        </Card.Content>
      </Card>

      {/* WhatsApp Sessions */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <Text style={dynamicStyles.sectionTitle}>{t('whatsAppSessions')}</Text>
          <Divider style={dynamicStyles.divider} />
          <List.Item
            title={t('manageSessions')}
            description={t('manageSessionsDescription')}
            left={(props) => (
              <Ionicons name="chatbubbles" size={24} color="#667eea" />
            )}
            right={(props) => (
              <Ionicons name="chevron-forward" size={20} color="#666" />
            )}
            onPress={() => navigation.navigate('Sessions')}
            style={dynamicStyles.listItem}
          />
          <List.Item
            title={t('sessionAnalytics')}
            description={t('sessionAnalyticsDescription')}
            left={(props) => (
              <Ionicons name="analytics" size={24} color="#764ba2" />
            )}
            right={(props) => (
              <Ionicons name="chevron-forward" size={20} color="#666" />
            )}
            onPress={() => navigation.navigate('SessionAnalytics')}
            style={dynamicStyles.listItem}
          />
        </Card.Content>
      </Card>

      {/* Password Change */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <Text style={dynamicStyles.sectionTitle}>{t('security')}</Text>
          <Divider style={dynamicStyles.divider} />
          
          {!showPasswordForm ? (
            <Button
              mode="outlined"
              onPress={() => setShowPasswordForm(true)}
              icon="lock"
              style={dynamicStyles.button}
            >
              {t('changePassword')}
            </Button>
          ) : (
            <View style={dynamicStyles.passwordForm}>
              <TextInput
                placeholder={t('currentPassword')}
                value={passwordData.currentPassword}
                onChangeText={(text) => setPasswordData({...passwordData, currentPassword: text})}
                secureTextEntry
                style={dynamicStyles.input}
              />
              <TextInput
                placeholder={t('newPassword')}
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})}
                secureTextEntry
                style={dynamicStyles.input}
              />
              <TextInput
                placeholder={t('confirmPassword')}
                value={passwordData.confirmPassword}
                onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
                secureTextEntry
                style={dynamicStyles.input}
              />
              <View style={dynamicStyles.passwordButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setShowPasswordForm(false)}
                  style={dynamicStyles.button}
                >
                  {t('cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handlePasswordChange}
                  loading={loading}
                  disabled={loading}
                  style={dynamicStyles.button}
                >
                  {t('updatePassword')}
                </Button>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>


      {/* Save Preferences */}
      <Button
        mode="contained"
        onPress={savePreferences}
        style={dynamicStyles.saveButton}
        icon="content-save"
      >
        {t('savePreferences')}
      </Button>

      {/* Logout */}
      <Button
        mode="outlined"
        onPress={handleLogout}
        style={dynamicStyles.logoutButton}
        icon="logout"
        textColor="#FF3B30"
      >
        {t('logout')}
      </Button>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: theme.colors.surface,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  userRole: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  userId: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
  listItem: {
    paddingVertical: 4,
  },
  button: {
    marginVertical: 4,
  },
  passwordForm: {
    marginTop: 8,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  passwordButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  saveButton: {
    marginBottom: 12,
    backgroundColor: '#25D366',
  },
  logoutButton: {
    borderColor: '#FF3B30',
    marginBottom: 20,
  },
});

export default SettingsScreen; 
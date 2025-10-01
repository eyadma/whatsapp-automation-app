import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';
import { loginPersistenceAPI } from '../../services/loginPersistenceAPI';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTextInput from '../components/WebCompatibleTextInput';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleCheckbox from '../components/WebCompatibleCheckbox';

const WebLoginScreen = ({ navigation }) => {
  const { setUserId, setUser, t } = useContext(AppContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  // Load saved credentials on component mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      setLoadingCredentials(true);
      const result = await loginPersistenceAPI.getSavedCredentials();
      
      if (result.success && result.credentials) {
        const { email: savedEmail, password: savedPassword, rememberLogin: savedRememberLogin } = result.credentials;
        
        if (savedEmail) {
          setEmail(savedEmail);
        }
        
        if (savedPassword && savedRememberLogin) {
          setPassword(savedPassword);
          setRememberLogin(true);
        } else {
          setRememberLogin(savedRememberLogin);
        }
        
        console.log('✅ Saved credentials loaded');
      }
    } catch (error) {
      console.error('❌ Error loading saved credentials:', error);
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      
      // Track login attempt
      await loginPersistenceAPI.trackLoginAttempt(email, false);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Auth error:', error);
        Alert.alert('Login Failed', error.message);
        return;
      }

      if (data.user) {
        // Login successful - save credentials and clear failed attempts
        await loginPersistenceAPI.saveLoginCredentials(email, password, rememberLogin);
        await loginPersistenceAPI.trackLoginAttempt(email, true);
        await loginPersistenceAPI.clearLoginAttempts(email);
        
        setUserId(data.user.id);
        setUser(data.user);
        console.log('Login successful:', data.user.email);
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Create dynamic styles based on platform
  const dynamicStyles = createStyles();

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={dynamicStyles.scrollContainer}>
        <View style={dynamicStyles.logoContainer}>
          <Ionicons name="chatbubbles" size={80} color="#25D366" />
          <WebCompatibleTitle style={dynamicStyles.appTitle}>
            WhatsApp Manager
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.appSubtitle}>
            Professional messaging platform
          </WebCompatibleParagraph>
        </View>

        <WebCompatibleCard style={dynamicStyles.loginCard}>
          <WebCompatibleCard.Content>
            <WebCompatibleTitle style={dynamicStyles.loginTitle}>
              Welcome Back
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.loginSubtitle}>
              Sign in to your account
            </WebCompatibleParagraph>

            <WebCompatibleTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={dynamicStyles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              left={<WebCompatibleTextInput.Icon icon="email" />}
            />

            <WebCompatibleTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={dynamicStyles.input}
              secureTextEntry={!showPassword}
              left={<WebCompatibleTextInput.Icon icon="lock" />}
              right={
                <WebCompatibleTextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            {/* Remember Login Checkbox */}
            <View style={dynamicStyles.rememberLoginContainer}>
              <WebCompatibleCheckbox
                status={rememberLogin ? 'checked' : 'unchecked'}
                onPress={() => setRememberLogin(!rememberLogin)}
                color="#25D366"
              />
              <Text style={dynamicStyles.rememberLoginText}>
                Remember my login
              </Text>
            </View>

            <WebCompatibleButton
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={dynamicStyles.loginButton}
            >
              Sign In
            </WebCompatibleButton>

            <View style={dynamicStyles.forgotPasswordContainer}>
              <WebCompatibleButton
                mode="text"
                onPress={() => Alert.alert('Info', 'Contact your administrator to reset your password')}
                style={dynamicStyles.forgotPasswordButton}
              >
                Forgot Password?
              </WebCompatibleButton>
            </View>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <View style={dynamicStyles.footer}>
          <WebCompatibleParagraph style={dynamicStyles.footerText}>
            Need an account? Contact your administrator
          </WebCompatibleParagraph>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 15,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 5,
    textAlign: 'center',
  },
  loginCard: {
    elevation: 4,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333333',
  },
  loginSubtitle: {
    textAlign: 'center',
    color: '#666666',
    marginBottom: 30,
  },
  input: {
    marginBottom: 15,
  },
  rememberLoginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 5,
  },
  rememberLoginText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333333',
  },
  loginButton: {
    marginTop: 10,
    borderRadius: 8,
    width: '100%',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordButton: {
    marginTop: 10,
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 14,
  },
});

export default WebLoginScreen;

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
import { TextInput, Button, Title, Paragraph, Card, useTheme, Checkbox } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';
import { loginPersistenceAPI } from '../../services/loginPersistenceAPI';

const LoginScreen = ({ navigation }) => {
  const { setUserId, setUser, t } = useContext(AppContext);
  const paperTheme = useTheme();
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

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={dynamicStyles.scrollContainer}>
        <View style={dynamicStyles.logoContainer}>
          <Ionicons name="chatbubbles" size={80} color="#25D366" />
          <Title style={dynamicStyles.appTitle}>WhatsApp Manager</Title>
          <Paragraph style={dynamicStyles.appSubtitle}>Professional messaging platform</Paragraph>
        </View>

        <Card style={dynamicStyles.loginCard}>
          <Card.Content>
            <Title style={dynamicStyles.loginTitle}>Welcome Back</Title>
            <Paragraph style={dynamicStyles.loginSubtitle}>Sign in to your account</Paragraph>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={dynamicStyles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email" />}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={dynamicStyles.input}
              secureTextEntry={!showPassword}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            {/* Remember Login Checkbox */}
            <View style={dynamicStyles.rememberLoginContainer}>
              <Checkbox
                status={rememberLogin ? 'checked' : 'unchecked'}
                onPress={() => setRememberLogin(!rememberLogin)}
                color="#25D366"
              />
              <Text style={dynamicStyles.rememberLoginText}>
                Remember my login
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={dynamicStyles.loginButton}
              contentStyle={dynamicStyles.loginButtonContent}
            >
              Sign In
            </Button>

            <View style={dynamicStyles.forgotPasswordContainer}>
              <Button
                mode="text"
                onPress={() => Alert.alert('Info', 'Contact your administrator to reset your password')}
                style={dynamicStyles.forgotPasswordButton}
              >
                Forgot Password?
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={dynamicStyles.footer}>
          <Paragraph style={dynamicStyles.footerText}>
            Need an account? Contact your administrator
          </Paragraph>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.onBackground,
    marginTop: 15,
  },
  appSubtitle: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginTop: 5,
  },
  loginCard: {
    elevation: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: theme.colors.onSurface,
  },
  loginSubtitle: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
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
    color: theme.colors.onSurface,
  },
  loginButton: {
    marginTop: 10,
    borderRadius: 8,
  },
  loginButtonContent: {
    paddingVertical: 8,
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
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
  },
});

export default LoginScreen; 
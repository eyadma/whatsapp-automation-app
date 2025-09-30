import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Login Persistence API
 * Handles saving and retrieving login credentials using AsyncStorage
 * with optional encryption for security
 */
export const loginPersistenceAPI = {
  // Storage keys
  STORAGE_KEYS: {
    SAVED_EMAIL: 'saved_email',
    SAVED_PASSWORD: 'saved_password_encrypted',
    REMEMBER_LOGIN: 'remember_login',
    LAST_LOGIN_TIME: 'last_login_time',
    AUTO_LOGIN_ENABLED: 'auto_login_enabled',
    LOGIN_ATTEMPTS: 'login_attempts',
    LAST_LOGIN_EMAIL: 'last_login_email',
  },

  // Simple encoding key (in production, this should be more secure)
  ENCODING_KEY: 'whatsapp_manager_2024_secure_key',

  /**
   * Simple encoding function (base64 + key)
   */
  _encode: (text, key) => {
    try {
      // Simple encoding: base64 + key rotation
      let encoded = btoa(text);
      let result = '';
      for (let i = 0; i < encoded.length; i++) {
        result += String.fromCharCode(encoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return btoa(result);
    } catch (error) {
      console.error('Encoding error:', error);
      return text; // Fallback to plain text
    }
  },

  /**
   * Simple decoding function
   */
  _decode: (encodedText, key) => {
    try {
      // Simple decoding: reverse the encoding process
      let decoded = atob(encodedText);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return atob(result);
    } catch (error) {
      console.error('Decoding error:', error);
      return encodedText; // Fallback to encoded text
    }
  },

  /**
   * Save login credentials
   */
  saveLoginCredentials: async (email, password, rememberLogin = true) => {
    try {
      console.log('💾 Saving login credentials...');
      
      // Save email (not encrypted)
      await AsyncStorage.setItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_EMAIL, email);
      
      // Save remember login preference
      await AsyncStorage.setItem(
        loginPersistenceAPI.STORAGE_KEYS.REMEMBER_LOGIN, 
        rememberLogin.toString()
      );
      
      // Save last login time
      await AsyncStorage.setItem(
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_TIME, 
        new Date().toISOString()
      );
      
      // Save last login email
      await AsyncStorage.setItem(
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_EMAIL, 
        email
      );
      
      if (rememberLogin && password) {
        // Encode and save password
        const encodedPassword = loginPersistenceAPI._encode(password, loginPersistenceAPI.ENCODING_KEY);
        await AsyncStorage.setItem(
          loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD, 
          encodedPassword
        );
        console.log('✅ Login credentials saved securely');
      } else {
        // Clear saved password if not remembering
        await AsyncStorage.removeItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD);
        console.log('✅ Login preferences saved (password not stored)');
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving login credentials:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get saved login credentials
   */
  getSavedCredentials: async () => {
    try {
      console.log('📥 Retrieving saved login credentials...');
      
      const email = await AsyncStorage.getItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_EMAIL);
      const rememberLogin = await AsyncStorage.getItem(loginPersistenceAPI.STORAGE_KEYS.REMEMBER_LOGIN);
      const encryptedPassword = await AsyncStorage.getItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD);
      const lastLoginTime = await AsyncStorage.getItem(loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_TIME);
      
      let password = null;
      if (rememberLogin === 'true' && encryptedPassword) {
        try {
          // Decode password
          password = loginPersistenceAPI._decode(encryptedPassword, loginPersistenceAPI.ENCODING_KEY);
        } catch (decodeError) {
          console.error('❌ Error decoding password:', decodeError);
          // Clear corrupted encoded password
          await AsyncStorage.removeItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD);
        }
      }
      
      const credentials = {
        email: email || '',
        password: password || '',
        rememberLogin: rememberLogin === 'true',
        lastLoginTime: lastLoginTime ? new Date(lastLoginTime) : null,
        hasSavedCredentials: !!(email && (rememberLogin === 'true' ? password : true))
      };
      
      console.log('✅ Saved credentials retrieved:', {
        hasEmail: !!credentials.email,
        hasPassword: !!credentials.password,
        rememberLogin: credentials.rememberLogin,
        lastLoginTime: credentials.lastLoginTime
      });
      
      return { success: true, credentials };
    } catch (error) {
      console.error('❌ Error retrieving saved credentials:', error);
      return { success: false, error: error.message, credentials: null };
    }
  },

  /**
   * Clear saved login credentials
   */
  clearSavedCredentials: async () => {
    try {
      console.log('🗑️ Clearing saved login credentials...');
      
      await AsyncStorage.multiRemove([
        loginPersistenceAPI.STORAGE_KEYS.SAVED_EMAIL,
        loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD,
        loginPersistenceAPI.STORAGE_KEYS.REMEMBER_LOGIN,
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_TIME,
        loginPersistenceAPI.STORAGE_KEYS.AUTO_LOGIN_ENABLED,
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_EMAIL,
      ]);
      
      console.log('✅ Saved credentials cleared');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing saved credentials:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update remember login preference
   */
  updateRememberLogin: async (rememberLogin) => {
    try {
      await AsyncStorage.setItem(
        loginPersistenceAPI.STORAGE_KEYS.REMEMBER_LOGIN, 
        rememberLogin.toString()
      );
      
      // If not remembering, clear saved password
      if (!rememberLogin) {
        await AsyncStorage.removeItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD);
      }
      
      console.log('✅ Remember login preference updated:', rememberLogin);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating remember login preference:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Save last login email (for auto-complete)
   */
  saveLastLoginEmail: async (email) => {
    try {
      await AsyncStorage.setItem(loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_EMAIL, email);
      console.log('✅ Last login email saved');
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving last login email:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get last login email
   */
  getLastLoginEmail: async () => {
    try {
      const email = await AsyncStorage.getItem(loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_EMAIL);
      return { success: true, email: email || '' };
    } catch (error) {
      console.error('❌ Error getting last login email:', error);
      return { success: false, error: error.message, email: '' };
    }
  },

  /**
   * Track login attempts (for security)
   */
  trackLoginAttempt: async (email, success = false) => {
    try {
      const attemptsKey = `${loginPersistenceAPI.STORAGE_KEYS.LOGIN_ATTEMPTS}_${email}`;
      const attempts = await AsyncStorage.getItem(attemptsKey);
      const attemptData = attempts ? JSON.parse(attempts) : { count: 0, lastAttempt: null };
      
      attemptData.count += 1;
      attemptData.lastAttempt = new Date().toISOString();
      attemptData.success = success;
      
      await AsyncStorage.setItem(attemptsKey, JSON.stringify(attemptData));
      
      console.log('📊 Login attempt tracked:', { email, success, count: attemptData.count });
      return { success: true, attemptData };
    } catch (error) {
      console.error('❌ Error tracking login attempt:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get login attempt history
   */
  getLoginAttempts: async (email) => {
    try {
      const attemptsKey = `${loginPersistenceAPI.STORAGE_KEYS.LOGIN_ATTEMPTS}_${email}`;
      const attempts = await AsyncStorage.getItem(attemptsKey);
      const attemptData = attempts ? JSON.parse(attempts) : { count: 0, lastAttempt: null, success: false };
      
      return { success: true, attemptData };
    } catch (error) {
      console.error('❌ Error getting login attempts:', error);
      return { success: false, error: error.message, attemptData: null };
    }
  },

  /**
   * Clear login attempts (after successful login)
   */
  clearLoginAttempts: async (email) => {
    try {
      const attemptsKey = `${loginPersistenceAPI.STORAGE_KEYS.LOGIN_ATTEMPTS}_${email}`;
      await AsyncStorage.removeItem(attemptsKey);
      console.log('✅ Login attempts cleared for:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing login attempts:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if credentials are recent (within last 30 days)
   */
  areCredentialsRecent: async () => {
    try {
      const lastLoginTime = await AsyncStorage.getItem(loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_TIME);
      
      if (!lastLoginTime) return { success: true, isRecent: false };
      
      const lastLogin = new Date(lastLoginTime);
      const now = new Date();
      const daysSinceLogin = (now - lastLogin) / (1000 * 60 * 60 * 24);
      
      const isRecent = daysSinceLogin <= 30; // 30 days threshold
      
      return { success: true, isRecent, daysSinceLogin };
    } catch (error) {
      console.error('❌ Error checking credential recency:', error);
      return { success: false, error: error.message, isRecent: false };
    }
  },

  /**
   * Get all stored login data (for debugging)
   */
  getAllLoginData: async () => {
    try {
      const data = await AsyncStorage.multiGet([
        loginPersistenceAPI.STORAGE_KEYS.SAVED_EMAIL,
        loginPersistenceAPI.STORAGE_KEYS.REMEMBER_LOGIN,
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_TIME,
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_EMAIL,
        loginPersistenceAPI.STORAGE_KEYS.AUTO_LOGIN_ENABLED,
      ]);
      
      const result = {};
      data.forEach(([key, value]) => {
        result[key] = value;
      });
      
      // Don't include encrypted password in debug data
      result[loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD] = '***ENCRYPTED***';
      
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Error getting all login data:', error);
      return { success: false, error: error.message, data: null };
    }
  }
};

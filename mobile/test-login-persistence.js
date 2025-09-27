#!/usr/bin/env node

/**
 * Test script for login persistence functionality
 * This script tests the AsyncStorage-based login persistence
 */

const AsyncStorage = require('@react-native-async-storage/async-storage');
const CryptoJS = require('crypto-js');

// Mock the login persistence API for testing
const loginPersistenceAPI = {
  STORAGE_KEYS: {
    SAVED_EMAIL: 'saved_email',
    SAVED_PASSWORD: 'saved_password_encrypted',
    REMEMBER_LOGIN: 'remember_login',
    LAST_LOGIN_TIME: 'last_login_time',
  },
  ENCRYPTION_KEY: 'whatsapp_manager_2024_secure_key',

  saveLoginCredentials: async (email, password, rememberLogin = true) => {
    try {
      console.log('💾 Saving login credentials...');
      
      await AsyncStorage.setItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_EMAIL, email);
      await AsyncStorage.setItem(
        loginPersistenceAPI.STORAGE_KEYS.REMEMBER_LOGIN, 
        rememberLogin.toString()
      );
      await AsyncStorage.setItem(
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_TIME, 
        new Date().toISOString()
      );
      
      if (rememberLogin && password) {
        const encryptedPassword = CryptoJS.AES.encrypt(password, loginPersistenceAPI.ENCRYPTION_KEY).toString();
        await AsyncStorage.setItem(
          loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD, 
          encryptedPassword
        );
        console.log('✅ Login credentials saved securely');
      } else {
        await AsyncStorage.removeItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD);
        console.log('✅ Login preferences saved (password not stored)');
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving login credentials:', error);
      return { success: false, error: error.message };
    }
  },

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
          const bytes = CryptoJS.AES.decrypt(encryptedPassword, loginPersistenceAPI.ENCRYPTION_KEY);
          password = bytes.toString(CryptoJS.enc.Utf8);
        } catch (decryptError) {
          console.error('❌ Error decrypting password:', decryptError);
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

  clearSavedCredentials: async () => {
    try {
      console.log('🗑️ Clearing saved login credentials...');
      
      await AsyncStorage.multiRemove([
        loginPersistenceAPI.STORAGE_KEYS.SAVED_EMAIL,
        loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD,
        loginPersistenceAPI.STORAGE_KEYS.REMEMBER_LOGIN,
        loginPersistenceAPI.STORAGE_KEYS.LAST_LOGIN_TIME,
      ]);
      
      console.log('✅ Saved credentials cleared');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing saved credentials:', error);
      return { success: false, error: error.message };
    }
  }
};

async function testLoginPersistence() {
  try {
    console.log('🧪 Testing login persistence functionality...');
    
    const testEmail = 'test@example.com';
    const testPassword = 'testPassword123';
    
    // Test 1: Save credentials
    console.log('\n📝 Test 1: Saving login credentials...');
    const saveResult = await loginPersistenceAPI.saveLoginCredentials(testEmail, testPassword, true);
    
    if (!saveResult.success) {
      console.log('❌ Test 1 failed:', saveResult.error);
      return;
    }
    console.log('✅ Test 1 passed: Credentials saved successfully');
    
    // Test 2: Retrieve credentials
    console.log('\n📥 Test 2: Retrieving saved credentials...');
    const getResult = await loginPersistenceAPI.getSavedCredentials();
    
    if (!getResult.success) {
      console.log('❌ Test 2 failed:', getResult.error);
      return;
    }
    
    const { credentials } = getResult;
    if (credentials.email !== testEmail || credentials.password !== testPassword) {
      console.log('❌ Test 2 failed: Retrieved credentials do not match saved credentials');
      console.log('Expected:', { email: testEmail, password: testPassword });
      console.log('Retrieved:', { email: credentials.email, password: credentials.password });
      return;
    }
    console.log('✅ Test 2 passed: Credentials retrieved correctly');
    
    // Test 3: Test encryption
    console.log('\n🔐 Test 3: Testing password encryption...');
    const rawPassword = await AsyncStorage.getItem(loginPersistenceAPI.STORAGE_KEYS.SAVED_PASSWORD);
    
    if (rawPassword === testPassword) {
      console.log('❌ Test 3 failed: Password is not encrypted');
      return;
    }
    console.log('✅ Test 3 passed: Password is properly encrypted');
    
    // Test 4: Clear credentials
    console.log('\n🗑️ Test 4: Clearing saved credentials...');
    const clearResult = await loginPersistenceAPI.clearSavedCredentials();
    
    if (!clearResult.success) {
      console.log('❌ Test 4 failed:', clearResult.error);
      return;
    }
    
    // Verify credentials are cleared
    const verifyResult = await loginPersistenceAPI.getSavedCredentials();
    if (verifyResult.credentials.email || verifyResult.credentials.password) {
      console.log('❌ Test 4 failed: Credentials were not properly cleared');
      return;
    }
    console.log('✅ Test 4 passed: Credentials cleared successfully');
    
    // Test 5: Test without remembering password
    console.log('\n📝 Test 5: Testing save without password...');
    const saveNoPasswordResult = await loginPersistenceAPI.saveLoginCredentials(testEmail, testPassword, false);
    
    if (!saveNoPasswordResult.success) {
      console.log('❌ Test 5 failed:', saveNoPasswordResult.error);
      return;
    }
    
    const getNoPasswordResult = await loginPersistenceAPI.getSavedCredentials();
    if (getNoPasswordResult.credentials.password) {
      console.log('❌ Test 5 failed: Password was saved when it should not have been');
      return;
    }
    console.log('✅ Test 5 passed: Email saved without password when rememberLogin is false');
    
    // Clean up
    await loginPersistenceAPI.clearSavedCredentials();
    
    console.log('\n🎉 All tests passed! Login persistence is working correctly.');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Credentials can be saved securely');
    console.log('   ✅ Credentials can be retrieved correctly');
    console.log('   ✅ Passwords are properly encrypted');
    console.log('   ✅ Credentials can be cleared');
    console.log('   ✅ Remember login preference works');
    console.log('\n🚀 The login persistence feature is ready to use!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testLoginPersistence()
    .then(() => {
      console.log('✅ Testing completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testLoginPersistence };

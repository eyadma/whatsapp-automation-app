#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📱 Building WhatsApp Automation App Preview');
console.log('==========================================\n');

// Check if we're in the mobile directory
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this script from the mobile directory.');
  process.exit(1);
}

console.log('🔍 Checking App Configuration:');
console.log('==============================');

// Check app.json
const appJsonPath = path.join(__dirname, 'app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  console.log('✅ app.json found');
  console.log(`📱 App Name: ${appJson.expo.name}`);
  console.log(`📱 App Version: ${appJson.expo.version}`);
  console.log(`📱 App Icon: ${appJson.expo.icon}`);
  console.log(`📱 Splash Screen: ${appJson.expo.splash.image}`);
  
  // Check permissions
  if (appJson.expo.android && appJson.expo.android.permissions) {
    console.log('✅ Android permissions configured');
    appJson.expo.android.permissions.forEach(permission => {
      console.log(`   - ${permission}`);
    });
  }
  
  if (appJson.expo.ios && appJson.expo.ios.infoPlist) {
    console.log('✅ iOS permissions configured');
  }
} else {
  console.log('❌ app.json not found');
}

// Check assets
console.log('\n🖼️  Checking Assets:');
console.log('===================');

const assetsDir = path.join(__dirname, 'assets', 'images');
const requiredAssets = ['icon.png', 'splash-icon.png', 'adaptive-icon.png', 'favicon.png'];

requiredAssets.forEach(asset => {
  const assetPath = path.join(assetsDir, asset);
  if (fs.existsSync(assetPath)) {
    console.log(`✅ ${asset} found in assets/images/`);
  } else {
    console.log(`❌ ${asset} missing from assets/images/`);
  }
});

// Check dependencies
console.log('\n📦 Checking Dependencies:');
console.log('=========================');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const requiredDeps = [
  '@expo/vector-icons',
  'react-native-paper',
  'expo'
];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies && packageJson.dependencies[dep]) {
    console.log(`✅ ${dep} installed`);
  } else {
    console.log(`❌ ${dep} missing`);
  }
});

console.log('\n🚀 Building App Preview:');
console.log('========================');

try {
  // Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');
  
  // Start Expo development server
  console.log('\n🎯 Starting Expo development server...');
  console.log('📱 The app preview will be available at:');
  console.log('   • Expo Go app: Scan QR code');
  console.log('   • Web: http://localhost:19006');
  console.log('   • iOS Simulator: Press i');
  console.log('   • Android Emulator: Press a');
  
  console.log('\n🔧 App Preview Features:');
  console.log('========================');
  console.log('✅ Professional app icon and splash screen from assets/images/');
  console.log('✅ Cloud deployment status');
  console.log('✅ Feature showcase');
  console.log('✅ Technical information');
  console.log('✅ Railway integration');
  
  console.log('\n📱 To test the app preview:');
  console.log('==========================');
  console.log('1. Install Expo Go on your phone');
  console.log('2. Scan the QR code that appears');
  console.log('3. Explore the app features');
  
  console.log('\n🎉 Starting development server...\n');
  
  // Start the Expo server
  execSync('npx expo start', { stdio: 'inherit' });
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

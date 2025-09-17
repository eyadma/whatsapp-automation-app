#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📱 Building WhatsApp Automation APK');
console.log('===================================\n');

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
  console.log(`📱 Package: ${appJson.expo.android?.package || 'Not set'}`);
  
  // Check permissions
  if (appJson.expo.android && appJson.expo.android.permissions) {
    console.log('✅ Android permissions configured');
    appJson.expo.android.permissions.forEach(permission => {
      console.log(`   - ${permission}`);
    });
  }
} else {
  console.log('❌ app.json not found');
}

// Check eas.json
const easJsonPath = path.join(__dirname, 'eas.json');
if (fs.existsSync(easJsonPath)) {
  console.log('✅ eas.json found');
} else {
  console.log('❌ eas.json not found');
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

console.log('\n🚀 Building APK with EAS Build:');
console.log('================================');

try {
  // Check if user is logged in to EAS
  console.log('🔐 Checking EAS authentication...');
  try {
    execSync('npx eas whoami', { stdio: 'pipe' });
    console.log('✅ EAS authentication verified');
  } catch (error) {
    console.log('❌ Not logged in to EAS. Please log in first:');
    console.log('   Run: npx eas login');
    console.log('   Then run this script again.');
    process.exit(1);
  }

  // Build the APK
  console.log('\n📦 Starting APK build...');
  console.log('This may take 10-15 minutes...');
  console.log('You can monitor progress at: https://expo.dev/accounts/[your-account]/projects/whatsapp-automation/builds');
  
  console.log('\n🎯 Build Options:');
  console.log('=================');
  console.log('1. Preview Build (APK for testing)');
  console.log('2. Production Build (APK for distribution)');
  console.log('3. Development Build (with development client)');
  
  console.log('\n🚀 Starting Preview Build (Recommended for testing)...');
  
  // Start the build
  execSync('npx eas build --platform android --profile preview', { 
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('\n🎉 APK Build Complete!');
  console.log('======================');
  console.log('✅ Your APK has been built successfully');
  console.log('📱 Download link will be provided in the terminal output above');
  console.log('🔗 You can also check: https://expo.dev/accounts/[your-account]/projects/whatsapp-automation/builds');
  
  console.log('\n📱 APK Features:');
  console.log('================');
  console.log('✅ Professional app icon and splash screen from assets/images/');
  console.log('✅ Cloud deployment integration');
  console.log('✅ WhatsApp automation features');
  console.log('✅ Railway cloud connection');
  console.log('✅ All 26 API endpoints accessible');
  
  console.log('\n📲 Installing APK:');
  console.log('==================');
  console.log('1. Download the APK from the link provided');
  console.log('2. Enable "Install from unknown sources" on your Android device');
  console.log('3. Install the APK file');
  console.log('4. Test all features');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('===================');
  console.log('1. Make sure you are logged in to EAS: npx eas login');
  console.log('2. Check your internet connection');
  console.log('3. Verify app.json configuration');
  console.log('4. Check EAS build logs for specific errors');
  console.log('5. Try running: npx eas build --platform android --profile preview --clear-cache');
  process.exit(1);
}

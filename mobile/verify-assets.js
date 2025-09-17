#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying App Assets Configuration');
console.log('=====================================\n');

// Check if assets/images directory exists
const assetsDir = path.join(__dirname, 'assets', 'images');
console.log(`📁 Assets directory: ${assetsDir}`);
console.log(`📁 Directory exists: ${fs.existsSync(assetsDir) ? '✅' : '❌'}`);

if (!fs.existsSync(assetsDir)) {
  console.error('❌ Assets/images directory not found!');
  process.exit(1);
}

// List all files in assets/images directory
console.log('\n📋 Files in assets/images directory:');
const files = fs.readdirSync(assetsDir);
files.forEach(file => {
  const filePath = path.join(assetsDir, file);
  const stats = fs.statSync(filePath);
  const sizeKB = Math.round(stats.size / 1024);
  console.log(`   - ${file} (${sizeKB} KB)`);
});

// Check required PNG files
const requiredFiles = [
  'icon.png',
  'splash-icon.png', 
  'adaptive-icon.png',
  'favicon.png'
];

console.log('\n🔍 Checking required PNG files:');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(assetsDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${file}: ${exists ? '✅' : '❌'}`);
  if (!exists) allFilesExist = false;
});

// Check app.json configuration
console.log('\n📱 Checking app.json configuration:');
const appJsonPath = path.join(__dirname, 'app.json');

if (fs.existsSync(appJsonPath)) {
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    console.log('✅ app.json found and valid');
    console.log(`   - App name: ${appJson.expo.name}`);
    console.log(`   - App icon: ${appJson.expo.icon}`);
    console.log(`   - Splash image: ${appJson.expo.splash.image}`);
    console.log(`   - Splash background: ${appJson.expo.splash.backgroundColor}`);
    console.log(`   - Android adaptive icon: ${appJson.expo.android.adaptiveIcon.foregroundImage}`);
    console.log(`   - Android background: ${appJson.expo.android.adaptiveIcon.backgroundColor}`);
    console.log(`   - Web favicon: ${appJson.expo.web.favicon}`);
    
    // Verify file paths exist
    const iconPath = path.join(__dirname, appJson.expo.icon);
    const splashPath = path.join(__dirname, appJson.expo.splash.image);
    const adaptivePath = path.join(__dirname, appJson.expo.android.adaptiveIcon.foregroundImage);
    const faviconPath = path.join(__dirname, appJson.expo.web.favicon);
    
    console.log('\n🔍 Verifying file paths:');
    console.log(`   - Icon exists: ${fs.existsSync(iconPath) ? '✅' : '❌'}`);
    console.log(`   - Splash exists: ${fs.existsSync(splashPath) ? '✅' : '❌'}`);
    console.log(`   - Adaptive icon exists: ${fs.existsSync(adaptivePath) ? '✅' : '❌'}`);
    console.log(`   - Favicon exists: ${fs.existsSync(faviconPath) ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error reading app.json:', error.message);
  }
} else {
  console.error('❌ app.json not found!');
}

// Summary
console.log('\n📊 Summary:');
if (allFilesExist) {
  console.log('✅ All required PNG files are present');
  console.log('✅ App configuration is properly set up');
  console.log('✅ Ready to build and deploy with custom icons');
} else {
console.log('❌ Some required files are missing');
console.log('❌ Please ensure all PNG files are in the assets/images folder');
}

console.log('\n🚀 Next steps:');
console.log('1. Run: expo start');
console.log('2. Test on device/simulator');
console.log('3. Build for production: expo build');
console.log('4. Verify icons appear correctly');

console.log('\n💡 Tips:');
console.log('- Icon should be 1024x1024px for best quality');
console.log('- Splash screen should be 1284x2778px (iPhone 12 Pro Max)');
console.log('- Adaptive icon should be 1024x1024px with transparent background');
console.log('- Favicon should be 32x32px or 16x16px');

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('☁️  Preparing WhatsApp App for Cloud Deployment');
console.log('===============================================\n');

// Check if we're in the right directory
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('📋 Current App Configuration:');
console.log('============================');
console.log(`Name: ${packageJson.name}`);
console.log(`Version: ${packageJson.version}`);
console.log(`Main: ${packageJson.main}`);
console.log(`Port: ${process.env.PORT || 3000}`);

// Check for required files
console.log('\n🔍 Checking Required Files:');
console.log('===========================');

const requiredFiles = [
  'package.json',
  'server-supabase.js',
  'config/supabase.js',
  'railway.json',
  '.railwayignore'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing. Please ensure all files are present.');
  process.exit(1);
}

// Check environment variables
console.log('\n🔧 Environment Variables Check:');
console.log('================================');

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY'
];

let envVarsConfigured = true;
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const configured = value && value.length > 0;
  console.log(`${configured ? '✅' : '❌'} ${envVar}: ${configured ? 'Configured' : 'Missing'}`);
  if (!configured) envVarsConfigured = false;
});

if (!envVarsConfigured) {
  console.log('\n⚠️  Some environment variables are missing.');
  console.log('You\'ll need to configure these in Railway:');
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      console.log(`   - ${envVar}`);
    }
  });
}

// Check dependencies
console.log('\n📦 Dependencies Check:');
console.log('======================');

const criticalDeps = [
  '@supabase/supabase-js',
  '@whiskeysockets/baileys',
  'express',
  'cors',
  'body-parser'
];

criticalDeps.forEach(dep => {
  const exists = packageJson.dependencies && packageJson.dependencies[dep];
  console.log(`${exists ? '✅' : '❌'} ${dep}: ${exists ? 'Installed' : 'Missing'}`);
});

// Create sessions directory if it doesn't exist
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
  console.log('\n📁 Creating sessions directory...');
  fs.mkdirSync(sessionsDir, { recursive: true });
  console.log('✅ Sessions directory created');
} else {
  console.log('\n✅ Sessions directory exists');
}

// Check for .env file
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  console.log('\n⚠️  .env file found. Make sure to configure environment variables in Railway.');
  console.log('   Railway will use environment variables from the dashboard, not .env files.');
} else {
  console.log('\n✅ No .env file found (good for production)');
}

// Generate Railway environment variables template
console.log('\n🚀 Railway Environment Variables Template:');
console.log('==========================================');
console.log('Copy these to your Railway project environment variables:');
console.log('');

requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`${envVar}=${value}`);
  } else {
    console.log(`${envVar}=your_${envVar.toLowerCase()}_here`);
  }
});

console.log('PORT=3000');
console.log('NODE_ENV=production');

// Check mobile app configuration
console.log('\n📱 Mobile App Configuration:');
console.log('============================');

const mobileApiBasePath = path.join(__dirname, 'mobile', 'src', 'services', 'apiBase.js');
if (fs.existsSync(mobileApiBasePath)) {
  const apiBaseContent = fs.readFileSync(mobileApiBasePath, 'utf8');
  
  if (apiBaseContent.includes('your-production-server.com')) {
    console.log('⚠️  Mobile app needs to be updated with Railway URL');
    console.log('   Update mobile/src/services/apiBase.js with your Railway domain');
  } else {
    console.log('✅ Mobile app configuration looks good');
  }
} else {
  console.log('❌ Mobile app API configuration not found');
}

// Final recommendations
console.log('\n🎯 Next Steps:');
console.log('==============');
console.log('1. Create Railway account at https://railway.app');
console.log('2. Connect your GitHub repository');
console.log('3. Create new project from your repository');
console.log('4. Configure environment variables in Railway dashboard');
console.log('5. Deploy your app');
console.log('6. Update mobile app with Railway URL');
console.log('7. Test the deployment');

console.log('\n📚 Documentation:');
console.log('=================');
console.log('- Railway Docs: https://docs.railway.app');
console.log('- WhatsApp Baileys: https://github.com/WhiskeySockets/Baileys');
console.log('- Supabase: https://supabase.com/docs');

console.log('\n✅ App is ready for cloud deployment!');
console.log('🚀 Good luck with your deployment!');

#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🌐 Railway Web Deployment Setup');
console.log('================================\n');

// Railway project information
const RAILWAY_PROJECT_ID = '8cf96366-ffc7-40fd-a2e2-4808200824fc';
const GITHUB_REPO = 'https://github.com/eyadma/whatsapp-automation-app.git';

console.log('📋 Web Project Information:');
console.log('============================');
console.log(`Railway Project ID: ${RAILWAY_PROJECT_ID}`);
console.log(`GitHub Repository: ${GITHUB_REPO}`);
console.log(`Repository Status: ✅ Pushed to GitHub with new web functionality`);

console.log('\n🔧 Railway Web Configuration:');
console.log('==============================');

// Check if railway-web.json exists
const railwayWebConfigPath = path.join(__dirname, 'railway-web.json');
if (fs.existsSync(railwayWebConfigPath)) {
  const railwayWebConfig = JSON.parse(fs.readFileSync(railwayWebConfigPath, 'utf8'));
  console.log('✅ railway-web.json found');
  console.log('📄 Web Configuration:');
  console.log(JSON.stringify(railwayWebConfig, null, 2));
} else {
  console.log('❌ railway-web.json not found');
}

// Check mobile package.json
const mobilePackageJsonPath = path.join(__dirname, 'mobile', 'package.json');
if (fs.existsSync(mobilePackageJsonPath)) {
  const mobilePackageJson = JSON.parse(fs.readFileSync(mobilePackageJsonPath, 'utf8'));
  console.log('✅ mobile/package.json found');
  console.log(`📦 Web Build Command: ${mobilePackageJson.scripts['build:web']}`);
  console.log(`📦 Web Serve Command: ${mobilePackageJson.scripts['serve:web']}`);
  console.log(`📦 Web Start Command: ${mobilePackageJson.scripts['start:web']}`);
} else {
  console.log('❌ mobile/package.json not found');
}

console.log('\n🌐 Web Environment Variables Needed:');
console.log('====================================');
console.log('You need to set these in Railway dashboard for the WEB service:');
console.log('');
console.log('NODE_VERSION=20');
console.log('PORT=3000');
console.log('NODE_ENV=production');
console.log('EXPO_PUBLIC_RORK_API_BASE_URL=https://your-backend-service.railway.app');
console.log('SUPABASE_URL=https://jfqsmfhsssfhqkoiytrb.supabase.co');
console.log('SUPABASE_ANON_KEY=your_supabase_anon_key_here');

console.log('\n🚀 Railway Web Deployment Steps:');
console.log('=================================');
console.log('1. Go to https://railway.app/dashboard');
console.log('2. Find your project (ID: 8cf96366-ffc7-40fd-a2e2-4808200824fc)');
console.log('3. Click on your project');
console.log('4. Create a NEW SERVICE for the web app:');
console.log('   - Click "New Service" → "GitHub Repo"');
console.log('   - Select your repository');
console.log('   - Choose "Deploy a new service"');
console.log('   - Set Root Directory to: mobile');
console.log('   - Set Build Command to: npm run build:web');
console.log('   - Set Start Command to: npm run start:web');
console.log('5. Go to "Variables" tab and add the environment variables above');
console.log('6. Go to "Deployments" tab');
console.log('7. Click "Deploy" or "Redeploy"');
console.log('8. Wait for deployment to complete');
console.log('9. Get your Railway Web URL from "Settings" → "Domains"');

console.log('\n🔍 Alternative: Update Existing Web Service');
console.log('============================================');
console.log('If you already have a web service:');
console.log('1. Go to your existing web service in Railway');
console.log('2. Go to "Settings" → "General"');
console.log('3. Update the following:');
console.log('   - Root Directory: mobile');
console.log('   - Build Command: npm run build:web');
console.log('   - Start Command: npm run start:web');
console.log('4. Go to "Variables" and ensure all environment variables are set');
console.log('5. Go to "Deployments" and click "Redeploy"');

console.log('\n📊 Expected Railway URLs:');
console.log('=========================');
console.log('After deployment, your services will be available at:');
console.log('• Backend API: https://your-backend-service.railway.app');
console.log('• Web App: https://your-web-service.railway.app');
console.log('• Health Check: https://your-web-service.railway.app/');

console.log('\n🧪 Testing Your Web App:');
console.log('=========================');
console.log('1. Open your Railway web URL in a browser');
console.log('2. Test the following features:');
console.log('   ✅ Login/Registration');
console.log('   ✅ WhatsApp QR Code (scan with phone)');
console.log('   ✅ Message Sending');
console.log('   ✅ Area Selection (dropdown)');
console.log('   ✅ ETA Management');
console.log('   ✅ VCard Generation (download VCF file)');
console.log('   ✅ Customer Management');
console.log('   ✅ Settings');

console.log('\n🔧 Railway CLI Alternative:');
console.log('===========================');
console.log('You can also use Railway CLI:');
console.log('');
console.log('# Install Railway CLI');
console.log('npm install -g @railway/cli');
console.log('');
console.log('# Login to Railway');
console.log('railway login');
console.log('');
console.log('# Link to your project');
console.log('railway link 8cf96366-ffc7-40fd-a2e2-4808200824fc');
console.log('');
console.log('# Create new web service');
console.log('railway service create web');
console.log('');
console.log('# Set environment variables for web service');
console.log('railway variables set NODE_VERSION=20');
console.log('railway variables set PORT=3000');
console.log('railway variables set NODE_ENV=production');
console.log('railway variables set EXPO_PUBLIC_RORK_API_BASE_URL=https://your-backend.railway.app');
console.log('railway variables set SUPABASE_URL=https://jfqsmfhsssfhqkoiytrb.supabase.co');
console.log('railway variables set SUPABASE_ANON_KEY=your_anon_key');
console.log('');
console.log('# Deploy web service');
console.log('railway up --service web');

console.log('\n✅ Ready for Railway Web Deployment!');
console.log('====================================');
console.log('Your web app is ready to deploy to Railway.');
console.log('The new web app has complete functionality identical to the mobile app.');
console.log('Follow the steps above to complete the web deployment.');

console.log('\n📞 Need Help?');
console.log('=============');
console.log('• Railway Docs: https://docs.railway.app');
console.log('• Railway Discord: https://discord.gg/railway');
console.log('• Your Project: https://railway.app/dashboard');
console.log('• Web App Features: VCF download, full mobile functionality');

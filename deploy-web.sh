#!/bin/bash

# Web Deployment Script for WhatsApp Automation App

echo "🚀 Starting web deployment process..."

# Check if we're in the right directory
if [ ! -f "mobile/package.json" ]; then
    echo "❌ Error: mobile/package.json not found. Please run this script from the project root."
    exit 1
fi

# Navigate to mobile directory
cd mobile

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building web version..."
npm run build:web

echo "✅ Web build completed!"
echo "📁 Build output is in: mobile/dist/"
echo ""
echo "🌐 Next steps:"
echo "1. Go to https://vercel.com"
echo "2. Import your GitHub repository"
echo "3. Configure build settings:"
echo "   - Root Directory: mobile"
echo "   - Build Command: npm run build:web"
echo "   - Output Directory: dist"
echo "4. Add environment variables:"
echo "   - EXPO_PUBLIC_RORK_API_BASE_URL"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo "5. Deploy!"
echo ""
echo "🎉 Your app will be live at: https://your-app.vercel.app"

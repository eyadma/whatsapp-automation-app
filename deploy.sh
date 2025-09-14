#!/bin/bash

echo "🚀 Starting WhatsApp Automation App Deployment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_status "Please create a .env file with the following variables:"
    echo "SUPABASE_URL=your_supabase_url"
    echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
    echo "SUPABASE_ANON_KEY=your_anon_key"
    echo "PORT=3000"
    exit 1
fi

print_success ".env file found"

# Step 1: Set up Supabase storage
print_status "Setting up Supabase storage bucket..."
node setup-supabase-storage.js
if [ $? -eq 0 ]; then
    print_success "Supabase storage setup completed"
else
    print_error "Failed to set up Supabase storage"
    exit 1
fi

# Step 2: Install dependencies
print_status "Installing backend dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Step 3: Install mobile dependencies
print_status "Installing mobile dependencies..."
cd mobile
npm install
if [ $? -eq 0 ]; then
    print_success "Mobile dependencies installed"
else
    print_error "Failed to install mobile dependencies"
    exit 1
fi
cd ..

# Step 4: Build mobile app
print_status "Building mobile app for preview..."
cd mobile
npx expo build:android --type apk --non-interactive
if [ $? -eq 0 ]; then
    print_success "Mobile APK built successfully"
else
    print_error "Failed to build mobile APK"
    exit 1
fi
cd ..

print_success "🎉 Deployment preparation completed!"
echo ""
print_status "Next steps:"
echo "1. Deploy to Railway:"
echo "   - Connect your GitHub repository to Railway"
echo "   - Set environment variables in Railway dashboard"
echo "   - Deploy the backend"
echo ""
echo "2. The mobile APK will be available in the mobile/dist folder"
echo ""
print_status "Environment variables needed for Railway:"
echo "- SUPABASE_URL"
echo "- SUPABASE_SERVICE_ROLE_KEY"
echo "- SUPABASE_ANON_KEY"
echo "- PORT=3000"

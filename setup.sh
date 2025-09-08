#!/bin/bash

echo "🚀 Setting up WhatsApp Automation App..."
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js is installed"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed successfully"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

# Install mobile app dependencies
echo "📱 Installing mobile app dependencies..."
cd mobile
npm install

if [ $? -eq 0 ]; then
    echo "✅ Mobile app dependencies installed successfully"
else
    echo "❌ Failed to install mobile app dependencies"
    exit 1
fi

cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Start the backend server: npm start"
echo "2. In another terminal, start the mobile app: cd mobile && npm start"
echo "3. Follow the instructions in the README.md file"
echo ""
echo "Happy coding! 🎯" 
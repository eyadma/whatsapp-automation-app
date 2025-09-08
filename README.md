# 🚀 **WhatsApp Automation App**

A full-stack WhatsApp automation application with React Native frontend and Node.js backend, featuring multi-session support, cloud storage, and admin impersonation capabilities.

## ✅ **Features**

### **Frontend (React Native)**
- ✅ **Multi-platform support** - iOS, Android, and Web
- ✅ **Dark mode** - Complete theming support
- ✅ **WhatsApp session management** - Create, connect, and manage multiple sessions
- ✅ **Message sending** - Send individual and bulk messages
- ✅ **Customer management** - Add, edit, and manage customers
- ✅ **Admin features** - User impersonation and control
- ✅ **Real-time status** - Live connection status updates
- ✅ **Multi-language support** - Arabic, Hebrew, and English

### **Backend (Node.js)**
- ✅ **WhatsApp integration** - Using Baileys library
- ✅ **Multi-session support** - Handle multiple WhatsApp connections
- ✅ **Cloud storage** - Supabase Storage for session persistence
- ✅ **RESTful API** - Complete API endpoints
- ✅ **Background processing** - Async message sending
- ✅ **Database integration** - Supabase PostgreSQL
- ✅ **Admin features** - User management and impersonation

### **Database (Supabase)**
- ✅ **User management** - Profiles and authentication
- ✅ **Session storage** - WhatsApp session data
- ✅ **Customer data** - Customer information and preferences
- ✅ **Message history** - Track all sent messages
- ✅ **Template system** - Message templates in multiple languages
- ✅ **Analytics** - Session metrics and usage statistics

## 🚀 **Quick Start**

### **1. Install Dependencies**
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd mobile && npm install
```

### **2. Set Up Environment Variables**
Create `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
PORT=3000
```

### **3. Set Up Database**
```bash
# Run database setup
node setup-supabase.js
node setup-supabase-storage.js
```

### **4. Start the Backend**
```bash
npm start
```

### **5. Start the Frontend**
```bash
cd mobile && npm start
```

## 📱 **Platform Support**

- **iOS** - Native iOS app
- **Android** - Native Android app  
- **Web** - Progressive Web App (PWA)
- **Desktop** - Electron wrapper (optional)

## 🔧 **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │   Node.js API   │    │   Supabase      │
│   Frontend      │◄──►│   Backend       │◄──►│   Database      │
│                 │    │                 │    │                 │
│ • WhatsApp UI   │    │ • Baileys API   │    │ • PostgreSQL    │
│ • Session Mgmt  │    │ • Multi-session │    │ • Storage       │
│ • Admin Panel   │    │ • Cloud Storage │    │ • Auth          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 **Deployment**

### **Backend (Railway)**
1. Connect GitHub repository to Railway
2. Set environment variables
3. Deploy automatically

### **Frontend (Netlify)**
1. Build web version: `cd mobile && npx expo export --platform web`
2. Deploy `dist` folder to Netlify

### **Database (Supabase)**
- Already configured and ready
- Cloud storage for sessions
- RLS policies for security

## 📊 **API Endpoints**

### **WhatsApp Management**
- `GET /api/whatsapp/status/:userId/:sessionId` - Get connection status
- `POST /api/whatsapp/connect/:userId/:sessionId` - Connect session
- `POST /api/whatsapp/disconnect/:userId/:sessionId` - Disconnect session
- `GET /api/whatsapp/qr/:userId/:sessionId` - Get QR code

### **Message Sending**
- `POST /api/messages/send` - Send single message
- `POST /api/messages/send-background` - Send bulk messages

### **Customer Management**
- `GET /api/customers/:userId` - Get user's customers
- `POST /api/customers/fetch/:userId` - Fetch from external API

## 🔒 **Security Features**

- **Row Level Security (RLS)** - Database-level user isolation
- **Admin impersonation** - Secure user switching
- **Cloud storage** - Encrypted session storage
- **Environment variables** - Secure credential management

## 📄 **License**

MIT License - feel free to use this project for your own applications.

---

**🎯 A complete WhatsApp automation solution with enterprise-grade features!**

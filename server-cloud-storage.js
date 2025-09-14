const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, isJidBroadcast } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const supabase = require('./config/supabase');
const EnhancedSessionStorageManager = require('./enhanced-session-storage-manager');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Enhanced session storage manager with cloud integration
const sessionStorageManager = new EnhancedSessionStorageManager();

// Start periodic sync to cloud storage (every 5 minutes)
sessionStorageManager.startPeriodicSync(300000);

// WhatsApp connection management - Updated for multi-session support
const connections = new Map(); // userId -> Map of sessionId -> connection
const userSessions = new Map(); // userId -> Set of active sessionIds

// Background message processing management
const backgroundProcesses = new Map();

// Utility function to convert WhatsApp phone numbers to Israeli local format
function convertWhatsAppPhoneToLocal(whatsappPhoneNumber) {
  let localPhoneNumber = whatsappPhoneNumber;
  
  // WhatsApp sends: 972526686285 (international format)
  // Database stores: 0526686285 (Israeli local format)
  if (whatsappPhoneNumber.startsWith('972')) {
    // Remove 972 country code
    const localNumber = whatsappPhoneNumber.substring(3);
    
    // Check if it's a valid Israeli mobile number (starts with 5 and has 9 digits)
    if (localNumber.startsWith('5') && localNumber.length === 9) {
      // Convert to Israeli format: 0526686285
      localPhoneNumber = '0' + localNumber;
    }
  } else if (whatsappPhoneNumber.startsWith('+972')) {
    // Handle +972 format
    const localNumber = whatsappPhoneNumber.substring(4);
    if (localNumber.startsWith('5') && localNumber.length === 9) {
      localPhoneNumber = '0' + localNumber;
    }
  }
  
  return localPhoneNumber;
}

// Multi-session connection management helpers
function getConnection(userId, sessionId = null) {
  if (!connections.has(userId)) return null;
  
  const userConnections = connections.get(userId);
  
  if (sessionId) {
    // Return specific session connection
    return userConnections.get(sessionId) || null;
  } else {
    // Return default/active session connection
    const defaultSession = Array.from(userConnections.keys()).find(key => {
      const conn = userConnections.get(key);
      return conn && conn.isDefault;
    });
    return defaultSession ? userConnections.get(defaultSession) : null;
  }
}

function setConnection(userId, sessionId, connectionData) {
  if (!connections.has(userId)) {
    connections.set(userId, new Map());
    userSessions.set(userId, new Set());
  }
  
  const userConnections = connections.get(userId);
  userConnections.set(sessionId, connectionData);
  userSessions.get(userId).add(sessionId);
}

function removeConnection(userId, sessionId) {
  if (connections.has(userId)) {
    const userConnections = connections.get(userId);
    userConnections.delete(sessionId);
    userSessions.get(userId).delete(sessionId);
    
    // Clean up empty user entries
    if (userConnections.size === 0) {
      connections.delete(userId);
      userSessions.delete(userId);
    }
  }
}

function getUserConnections(userId) {
  return connections.has(userId) ? Array.from(connections.get(userId).keys()) : [];
}

function getDefaultSession(userId) {
  if (!connections.has(userId)) return null;
  
  const userConnections = connections.get(userId);
  const defaultSession = Array.from(userConnections.keys()).find(key => {
    const conn = userConnections.get(key);
    return conn && conn.isDefault;
  });
  
  return defaultSession ? userConnections.get(defaultSession) : null;
}

// Utility function to normalize phone numbers for comparison
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  let normalized = phoneNumber.replace(/\D/g, '');
  
  // Handle Israeli numbers
  if (normalized.startsWith('972')) {
    normalized = '0' + normalized.substring(3);
  } else if (normalized.startsWith('0') && normalized.length === 10) {
    // Already in correct format
  } else if (normalized.length === 9 && normalized.startsWith('5')) {
    normalized = '0' + normalized;
  }
  
  return normalized;
}

// Enhanced WhatsApp connection with cloud storage
async function connectWhatsApp(userId, sessionId = null) {
  try {
    console.log(`🚀 Starting WhatsApp connection for user: ${userId}, session: ${sessionId || 'default'}`);
    
    // Use the enhanced session storage manager
    const result = await sessionStorageManager.connectWhatsApp(userId, sessionId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    console.log(`✅ WhatsApp connection initiated for user: ${userId}, session: ${sessionId}`);
    return result;
  } catch (error) {
    console.error(`❌ Error connecting WhatsApp for user ${userId}:`, error);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    cloudStorage: 'enabled',
    activeSessions: connections.size
  });
});

// API Routes

// 1. WhatsApp Connection Management
app.get('/api/whatsapp/status/:userId', async (req, res) => {
  const { userId } = req.params;
  const { sessionId } = req.query; // Optional session ID parameter
  
  try {
    console.log(`📊 Getting WhatsApp status for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    
    const connection = getConnection(userId, sessionId);
    
    if (!connection) {
      return res.json({
        success: true,
        connected: false,
        connecting: false,
        qrCode: null,
        sessionId: sessionId || 'default',
        message: 'No active connection found'
      });
    }
    
    res.json({
      success: true,
      connected: connection.connected,
      connecting: connection.connecting,
      qrCode: connection.qrCode,
      sessionId: connection.sessionId,
      sessionName: connection.sessionName,
      isDefault: connection.isDefault
    });
  } catch (error) {
    console.error(`❌ Error getting WhatsApp status:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Connect WhatsApp (with sessionId in URL path)
app.post('/api/whatsapp/connect/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  const { sessionName, isDefault } = req.body;
  
  try {
    console.log(`🔗 Connecting WhatsApp for user: ${userId}, session: ${sessionId}`);
    
    // Create session
    const createResult = await sessionStorageManager.createSession(userId, {
      sessionId,
      name: sessionName || `Session ${sessionId}`,
      isDefault: isDefault || false
    });
    
    if (!createResult.success) {
      return res.status(500).json({ success: false, error: createResult.error });
    }
    
    // Connect WhatsApp
    const result = await connectWhatsApp(userId, sessionId);
    
    res.json({
      success: true,
      sessionId: result.sessionId,
      message: 'WhatsApp connection initiated'
    });
  } catch (error) {
    console.error(`❌ Error connecting WhatsApp:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2b. Connect WhatsApp (with sessionId in request body - for backward compatibility)
app.post('/api/whatsapp/connect/:userId', async (req, res) => {
  const { userId } = req.params;
  const { sessionId, sessionName, isDefault } = req.body;
  
  try {
    console.log(`🔗 Connecting WhatsApp for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    
    // Create session if sessionId is provided
    if (sessionId) {
      const createResult = await sessionStorageManager.createSession(userId, {
        sessionId,
        name: sessionName || `Session ${sessionId}`,
        isDefault: isDefault || false
      });
      
      if (!createResult.success) {
        return res.status(500).json({ success: false, error: createResult.error });
      }
    }
    
    // Connect WhatsApp
    const result = await connectWhatsApp(userId, sessionId);
    
    res.json({
      success: true,
      sessionId: result.sessionId,
      message: 'WhatsApp connection initiated'
    });
  } catch (error) {
    console.error(`❌ Error connecting WhatsApp:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Disconnect WhatsApp (with sessionId in URL path)
app.post('/api/whatsapp/disconnect/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    console.log(`🔌 Disconnecting WhatsApp for user: ${userId}, session: ${sessionId}`);
    
    const result = await sessionStorageManager.disconnectSession(userId, sessionId);
    
    if (result.success) {
      removeConnection(userId, sessionId);
      res.json({ success: true, message: 'WhatsApp disconnected successfully' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error(`❌ Error disconnecting WhatsApp:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3b. Disconnect WhatsApp (with sessionId in request body - for backward compatibility)
app.post('/api/whatsapp/disconnect/:userId', async (req, res) => {
  const { userId } = req.params;
  const { sessionId } = req.body;
  
  try {
    console.log(`🔌 Disconnecting WhatsApp for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    
    const result = await sessionStorageManager.disconnectSession(userId, sessionId);
    
    if (result.success) {
      removeConnection(userId, sessionId || 'default');
      res.json({ success: true, message: 'WhatsApp disconnected successfully' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error(`❌ Error disconnecting WhatsApp:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get QR Code
app.get('/api/whatsapp/qr/:userId', async (req, res) => {
  const { userId } = req.params;
  const { sessionId } = req.query;
  
  try {
    const connection = getConnection(userId, sessionId);
    
    if (!connection || !connection.qrCode) {
      return res.json({ success: false, message: 'No QR code available' });
    }
    
    // Generate QR code image
    const qrCodeDataURL = await qrcode.toDataURL(connection.qrCode);
    
    res.json({
      success: true,
      qrCode: connection.qrCode,
      qrCodeDataURL: qrCodeDataURL
    });
  } catch (error) {
    console.error(`❌ Error getting QR code:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Get User Sessions
app.get('/api/sessions/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await sessionStorageManager.getUserSessions(userId);
    
    if (result.success) {
      res.json({ success: true, sessions: result.sessions });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error(`❌ Error getting user sessions:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Delete Session
app.delete('/api/sessions/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    const result = await sessionStorageManager.deleteSession(userId, sessionId);
    
    if (result.success) {
      removeConnection(userId, sessionId);
      res.json({ success: true, message: 'Session deleted successfully' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error(`❌ Error deleting session:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Sync Session to Cloud
app.post('/api/sessions/:userId/:sessionId/sync', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    const localSessionPath = path.join(__dirname, 'sessions', userId, sessionId);
    const result = await sessionStorageManager.syncSessionToCloud(userId, sessionId, localSessionPath);
    
    res.json(result);
  } catch (error) {
    console.error(`❌ Error syncing session:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Restore Session from Cloud
app.post('/api/sessions/:userId/:sessionId/restore', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    const localSessionPath = path.join(__dirname, 'sessions', userId, sessionId);
    const result = await sessionStorageManager.restoreSessionFromCloud(userId, sessionId, localSessionPath);
    
    res.json(result);
  } catch (error) {
    console.error(`❌ Error restoring session:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Automation Server with Cloud Storage running on port ${PORT}`);
  console.log(`☁️  Cloud Storage: Supabase Storage enabled`);
  console.log(`🔄 Periodic Sync: Every 5 minutes`);
  console.log(`📱 Health Check: http://localhost:${PORT}/api/health`);
});

module.exports = app;

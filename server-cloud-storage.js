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

// Auto-connect all existing sessions on startup for persistent message listening
async function initializePersistentConnections() {
  try {
    console.log('🚀 Initializing persistent WhatsApp connections for location monitoring...');
    
    // Get all active sessions from database
    const { data: sessions, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'connected');
    
    if (error) {
      console.error('❌ Error fetching active sessions:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('📋 No active sessions found. Location monitoring will start when sessions are created.');
      return;
    }
    
    console.log(`📱 Found ${sessions.length} active sessions to reconnect:`);
    
    // Group sessions by user
    const userSessions = {};
    sessions.forEach(session => {
      if (!userSessions[session.user_id]) {
        userSessions[session.user_id] = [];
      }
      userSessions[session.user_id].push(session);
    });
    
    // Reconnect each user's sessions
    for (const [userId, userSessionList] of Object.entries(userSessions)) {
      console.log(`👤 Reconnecting sessions for user: ${userId}`);
      
      for (const session of userSessionList) {
        try {
          console.log(`🔄 Reconnecting session: ${session.session_id}`);
          
          // Reconnect the session
          const result = await sessionStorageManager.connectWhatsApp(userId, session.session_id);
          
          if (result.success) {
            console.log(`✅ Session reconnected: ${session.session_id}`);
          } else {
            console.log(`❌ Failed to reconnect session ${session.session_id}: ${result.error}`);
          }
          
          // Add small delay between reconnections
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error reconnecting session ${session.session_id}:`, error);
        }
      }
    }
    
    console.log('🎉 Persistent connection initialization completed!');
    console.log('📡 Location message listener is now active for all reconnected sessions.');
    
  } catch (error) {
    console.error('❌ Error initializing persistent connections:', error);
  }
}

// Start persistent connections after a short delay to ensure server is ready
setTimeout(initializePersistentConnections, 5000);

// Background monitoring service to ensure all sessions stay connected
async function backgroundSessionMonitoring() {
  try {
    console.log('🔍 Background session monitoring: Checking for disconnected sessions...');
    
    // Get all active sessions that should be connected
    const { data: sessions, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('is_active', true)
      .in('status', ['connected', 'connecting', 'qr_generated']);
    
    if (error) {
      console.error('❌ Error in background monitoring:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('📋 No sessions to monitor in background.');
      return;
    }
    
    let reconnectedCount = 0;
    
    for (const session of sessions) {
      try {
        // Check if session is actually connected in memory
        const isConnected = sessionStorageManager.isSessionConnected(session.user_id, session.session_id);
        
        if (!isConnected && session.status === 'connected') {
          console.log(`🔄 Background reconnection: ${session.session_id} (status: ${session.status})`);
          
          const result = await sessionStorageManager.connectWhatsApp(session.user_id, session.session_id);
          
          if (result.success) {
            reconnectedCount++;
            console.log(`✅ Background reconnection successful: ${session.session_id}`);
          } else {
            console.log(`❌ Background reconnection failed: ${session.session_id} - ${result.error}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error in background monitoring for session ${session.session_id}:`, error);
      }
    }
    
    if (reconnectedCount > 0) {
      console.log(`🔄 Background monitoring: Reconnected ${reconnectedCount} sessions`);
    }
    
  } catch (error) {
    console.error('❌ Error in background session monitoring:', error);
  }
}

// Start background monitoring every 2 minutes
setInterval(backgroundSessionMonitoring, 120000); // 2 minutes

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
      console.error(`❌ Session storage manager failed:`, result.error);
      throw new Error(result.error);
    }
    
    console.log(`✅ WhatsApp connection initiated for user: ${userId}, session: ${sessionId}`);
    return result;
  } catch (error) {
    console.error(`❌ Error connecting WhatsApp for user ${userId}:`, error);
    console.error(`❌ Error stack:`, error.stack);
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

// Test endpoint to check locations table structure
app.get('/api/test/locations-table/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if locations table exists and has required columns
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    
    if (error) {
      console.error('❌ Error checking locations table:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    
    res.json({
      success: true,
      message: 'Locations table check completed',
      data: {
        hasLocations: locations && locations.length > 0,
        sampleLocation: locations?.[0] || null,
        tableExists: true
      }
    });
  } catch (error) {
    console.error('❌ Error in locations table test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint to manually trigger persistent connection initialization
app.post('/api/whatsapp/initialize-persistent', async (req, res) => {
  try {
    console.log('🔄 Manual trigger: Initializing persistent connections...');
    
    // Trigger the initialization function
    await initializePersistentConnections();
    
    res.json({
      success: true,
      message: 'Persistent connection initialization triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in manual persistent initialization:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint to check background monitoring status
app.get('/api/whatsapp/monitoring-status', async (req, res) => {
  try {
    // Get all active sessions
    const { data: sessions, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      throw error;
    }
    
    // Check which sessions are connected in memory
    const connectedSessions = [];
    const disconnectedSessions = [];
    
    sessions.forEach(session => {
      const isConnected = sessionStorageManager.isSessionConnected(session.user_id, session.session_id);
      
      if (isConnected) {
        connectedSessions.push({
          userId: session.user_id,
          sessionId: session.session_id,
          status: session.status
        });
      } else {
        disconnectedSessions.push({
          userId: session.user_id,
          sessionId: session.session_id,
          status: session.status
        });
      }
    });
    
    res.json({
      success: true,
      message: 'Background monitoring status',
      data: {
        totalSessions: sessions.length,
        connectedSessions: connectedSessions.length,
        disconnectedSessions: disconnectedSessions.length,
        connected: connectedSessions,
        disconnected: disconnectedSessions,
        monitoringActive: true
      }
    });
  } catch (error) {
    console.error('❌ Error checking monitoring status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to simulate a location message for debugging
app.post('/api/test/location-message/:userId/:sessionId', async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    const { phoneNumber, latitude, longitude, name } = req.body;
    
    console.log(`🧪 ===== TESTING LOCATION MESSAGE PROCESSING =====`);
    console.log(`🧪 User: ${userId}`);
    console.log(`🧪 Session: ${sessionId}`);
    console.log(`🧪 Test data:`, { phoneNumber, latitude, longitude, name });
    
    // Create a mock message object
    const mockMessage = {
      key: {
        remoteJid: `${phoneNumber}@s.whatsapp.net`,
        fromMe: false
      },
      pushName: name || 'Test User',
      messageTimestamp: Date.now()
    };
    
    // Create mock location data
    const mockLocationData = {
      degreesLatitude: latitude || 32.0853,
      degreesLongitude: longitude || 34.7818,
      name: name || 'Test Location',
      address: 'Test Address'
    };
    
    console.log(`🧪 Mock message:`, mockMessage);
    console.log(`🧪 Mock location data:`, mockLocationData);
    
    // Process the location message
    await sessionStorageManager.processLocationMessage(userId, sessionId, mockMessage, mockLocationData);
    
    res.json({
      success: true,
      message: 'Location message test completed',
      data: {
        userId,
        sessionId,
        phoneNumber,
        latitude,
        longitude,
        name
      }
    });
  } catch (error) {
    console.error('❌ Error in location message test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to verify WhatsApp connection is actually working
app.post('/api/test/whatsapp-connection/:userId/:sessionId', async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    const { testPhoneNumber } = req.body;
    
    console.log(`🧪 ===== TESTING WHATSAPP CONNECTION =====`);
    console.log(`🧪 User: ${userId}`);
    console.log(`🧪 Session: ${sessionId}`);
    console.log(`🧪 Test phone: ${testPhoneNumber}`);
    
    // Check if session is actually connected
    const isConnected = sessionStorageManager.isSessionConnected(userId, sessionId);
    console.log(`🧪 Session connected in memory: ${isConnected}`);
    
    if (!isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Session is not connected in memory',
        data: {
          userId,
          sessionId,
          connected: false
        }
      });
    }
    
    // Get the actual socket
    const userSessions = sessionStorageManager.activeSessions.get(userId);
    const sock = userSessions?.get(sessionId);
    
    if (!sock || sock.destroyed) {
      return res.status(400).json({
        success: false,
        error: 'Socket is not available or destroyed',
        data: {
          userId,
          sessionId,
          socketAvailable: false,
          socketDestroyed: sock?.destroyed || true
        }
      });
    }
    
    console.log(`🧪 Socket is available and not destroyed`);
    
    // Try to send a test message
    const testMessage = {
      text: `🧪 Test message from server at ${new Date().toISOString()}`
    };
    
    const phoneJid = `${testPhoneNumber}@s.whatsapp.net`;
    console.log(`🧪 Sending test message to: ${phoneJid}`);
    
    const result = await sock.sendMessage(phoneJid, testMessage);
    console.log(`🧪 Message sent result:`, result);
    
    res.json({
      success: true,
      message: 'WhatsApp connection test completed',
      data: {
        userId,
        sessionId,
        connected: true,
        socketAvailable: true,
        messageSent: true,
        messageId: result?.key?.id,
        testPhoneNumber
      }
    });
    
  } catch (error) {
    console.error('❌ Error in WhatsApp connection test:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        userId: req.params.userId,
        sessionId: req.params.sessionId,
        connected: false
      }
    });
  }
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
    console.log(`📋 Request body:`, { sessionName, isDefault });
    
    // Create session
    console.log(`📝 Creating session in database...`);
    const createResult = await sessionStorageManager.createSession(userId, {
      sessionId,
      name: sessionName || `Session ${sessionId}`,
      isDefault: isDefault || false
    });
    
    if (!createResult.success) {
      console.error(`❌ Failed to create session:`, createResult.error);
      return res.status(500).json({ 
        success: false, 
        error: `Failed to create session: ${createResult.error}`,
        step: 'session_creation'
      });
    }
    
    console.log(`✅ Session created successfully`);
    
    // Connect WhatsApp
    console.log(`🔗 Initiating WhatsApp connection...`);
    const result = await connectWhatsApp(userId, sessionId);
    
    console.log(`✅ WhatsApp connection result:`, result);
    
    res.json({
      success: true,
      sessionId: result.sessionId,
      message: 'WhatsApp connection initiated'
    });
  } catch (error) {
    console.error(`❌ Error connecting WhatsApp:`, error);
    console.error(`❌ Error stack:`, error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      step: 'whatsapp_connection',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
    console.log(`📱 Getting QR code for user: ${userId}, session: ${sessionId}`);
    
    // Get QR code from session storage manager
    const qrResult = sessionStorageManager.getQRCode(userId, sessionId);
    
    if (!qrResult.success) {
      return res.status(500).json({ success: false, error: qrResult.error });
    }
    
    if (!qrResult.qrCode) {
      return res.json({ success: false, message: 'No QR code available' });
    }
    
    // Generate QR code image
    const qrCodeDataURL = await qrcode.toDataURL(qrResult.qrCode);
    
    res.json({
      success: true,
      qrCode: qrResult.qrCode,
      qrCodeDataURL: qrCodeDataURL
    });
  } catch (error) {
    console.error(`❌ Error getting QR code:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4b. Generate QR Code (mobile app endpoint) - GET
app.get('/api/whatsapp/generate-qr/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    console.log(`📱 Generating QR code (GET) for user: ${userId}, session: ${sessionId}`);
    
    // Get QR code from session storage manager
    const qrResult = sessionStorageManager.getQRCode(userId, sessionId);
    
    if (!qrResult.success) {
      return res.status(500).json({ success: false, error: qrResult.error });
    }
    
    if (!qrResult.qrCode) {
      return res.json({ success: false, message: 'No QR code available. Please ensure the session is connected.' });
    }
    
    res.json({
      success: true,
      data: {
        qrCode: qrResult.qrCode
      }
    });
  } catch (error) {
    console.error(`❌ Error generating QR code:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4b. Generate QR Code (mobile app endpoint) - POST
app.post('/api/whatsapp/generate-qr/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    console.log(`📱 Generating QR code (POST) for user: ${userId}, session: ${sessionId}`);
    
    // Get QR code from session storage manager
    const qrResult = sessionStorageManager.getQRCode(userId, sessionId);
    
    if (!qrResult.success) {
      return res.status(500).json({ success: false, error: qrResult.error });
    }
    
    if (!qrResult.qrCode) {
      return res.json({ success: false, message: 'No QR code available. Please ensure the session is connected.' });
    }
    
    res.json({
      success: true,
      qrCode: qrResult.qrCode,
      data: {
        qrCode: qrResult.qrCode
      }
    });
  } catch (error) {
    console.error(`❌ Error generating QR code:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4c. Get WhatsApp Status (mobile app endpoint)
app.get('/api/whatsapp/status/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    console.log(`📊 Getting WhatsApp status for user: ${userId}, session: ${sessionId}`);
    
    // Get session status from session storage manager
    const statusResult = sessionStorageManager.getSessionStatus(userId, sessionId);
    
    if (!statusResult.success) {
      return res.status(500).json({ success: false, error: statusResult.error });
    }
    
    // Get QR code if status is qr_generated
    let qrCode = null;
    if (statusResult.status === 'qr_generated') {
      const qrResult = sessionStorageManager.getQRCode(userId, sessionId);
      if (qrResult.success && qrResult.qrCode) {
        qrCode = qrResult.qrCode;
        console.log(`📱 Including QR code in status response for session: ${sessionId}`);
      }
    }
    
    res.json({
      success: true,
      connected: statusResult.connected,
      connecting: statusResult.status === 'connecting' || statusResult.status === 'qr_generated',
      qrCode: qrCode,
      session: {
        sessionId: sessionId,
        userId: userId,
        status: statusResult.status
      },
      data: {
        status: statusResult.status,
        connected: statusResult.connected,
        sessionId: sessionId,
        userId: userId
      }
    });
  } catch (error) {
    console.error(`❌ Error getting WhatsApp status:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4d. Clean Session (mobile app endpoint)
app.post('/api/whatsapp/clean-session/:userId', async (req, res) => {
  const { userId } = req.params;
  const { sessionId } = req.body;
  
  try {
    console.log(`🧹 Cleaning session for user: ${userId}, session: ${sessionId}`);
    
    // Clean session using session storage manager
    const cleanResult = sessionStorageManager.cleanSession(userId, sessionId);
    
    if (!cleanResult.success) {
      return res.status(500).json({ success: false, error: cleanResult.error });
    }
    
    res.json({
      success: true,
      message: 'Session cleaned successfully',
      data: {
        userId: userId,
        sessionId: sessionId
      }
    });
  } catch (error) {
    console.error(`❌ Error cleaning session:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Send Background Messages (mobile app endpoint)
app.post('/api/messages/send-background', async (req, res) => {
  try {
    const { userId, sessionId, messages, processedMessages, customerIds } = req.body;
    
    console.log(`📤 Sending background messages - Request body:`, req.body);
    console.log(`📤 User ID: ${userId}, Session ID: ${sessionId}`);
    console.log(`📤 Messages:`, messages);
    console.log(`📤 Processed Messages:`, processedMessages);
    console.log(`📤 Customer IDs:`, customerIds);
    
    // Check for missing fields with detailed logging
    const missingFields = [];
    if (!userId) missingFields.push('userId');
    if (!sessionId) missingFields.push('sessionId');
    if (!customerIds) missingFields.push('customerIds');
    
    // Use processedMessages from mobile app, fallback to messages, then default
    let messagesToSend = processedMessages || messages;
    
    // If no messages provided, use default
    if (!messagesToSend || messagesToSend.length === 0) {
      messagesToSend = [{ 
        id: 'default', 
        content: 'Hello! This is a message from WhatsApp Automation.' 
      }];
    }
    
    console.log(`📤 Messages to send:`, messagesToSend);
    
    if (missingFields.length > 0) {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false, 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        received: {
          userId: !!userId,
          sessionId: !!sessionId,
          messages: !!messages,
          customerIds: !!customerIds
        }
      });
    }
    
    console.log(`📤 Using messages:`, messagesToSend);
    
    // Check if session is connected
    const statusResult = sessionStorageManager.getSessionStatus(userId, sessionId);
    if (!statusResult.success || !statusResult.connected) {
      return res.status(400).json({ 
        success: false, 
        error: 'WhatsApp session is not connected' 
      });
    }
    
    // Get the WhatsApp socket
    const sock = sessionStorageManager.activeSessions.get(userId)?.get(sessionId);
    if (!sock) {
      return res.status(400).json({ 
        success: false, 
        error: 'WhatsApp session not found' 
      });
    }
    
    const results = [];
    
    // Generate a unique process ID for this batch
    const processId = `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📤 Process ID generated: ${processId}`);
    
    // Send messages to each customer
    for (const customerId of customerIds) {
      try {
        console.log(`👤 Processing customer ID: ${customerId}`);
        
        // Get customer details from database
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .eq('user_id', userId)
          .single();
        
        if (customerError || !customer) {
          console.error(`❌ Customer not found: ${customerId}`, customerError);
          results.push({
            customerId,
            success: false,
            error: 'Customer not found',
            processId: processId
          });
          continue;
        }
        
        // Get phone number from either 'phone' or 'phone_number' field
        const phoneNumber = customer.phone || customer.phone_number;
        console.log(`👤 Customer found: ${customer.name} (${phoneNumber})`);
        
        // Validate phone number
        if (!phoneNumber) {
          console.error(`❌ Customer has no phone number: ${customerId} (${customer.name})`);
          console.error(`❌ Available fields:`, Object.keys(customer));
          results.push({
            customerId,
            success: false,
            error: 'Customer has no phone number',
            customerName: customer.name,
            processId: processId
          });
          continue;
        }
        
        // Send each message to this customer
        for (const message of messagesToSend) {
          try {
            console.log(`📤 Processing message for customer ${customerId}:`, JSON.stringify(message, null, 2));
            
            // Handle the mobile app's message structure: { customerId, name, phone, messages: [string] }
            let messageText;
            if (message.messages && Array.isArray(message.messages) && message.messages.length > 0) {
              messageText = message.messages[0]; // Use the first message
            } else {
              messageText = message.content || message.text || message.message || message.body;
            }
            console.log(`📤 Extracted message text:`, messageText);
            
            if (!messageText) {
              console.error(`❌ No message content for customer: ${customerId}`);
              console.error(`❌ Message object keys:`, Object.keys(message));
              console.error(`❌ Message object:`, message);
              results.push({
                customerId,
                messageId: message.id || 'unknown',
                success: false,
                error: 'No message content'
              });
              continue;
            }
            
            // Format phone number for WhatsApp with country code
            let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            console.log(`📱 Original phone: ${phoneNumber} -> Clean: ${cleanNumber}`);
            
            // Add country code if missing (Israel +972)
            if (cleanNumber.startsWith('0')) {
              cleanNumber = '972' + cleanNumber.substring(1);
              console.log(`📱 Added country code: ${cleanNumber}`);
            } else if (!cleanNumber.startsWith('972')) {
              cleanNumber = '972' + cleanNumber;
              console.log(`📱 Added country code: ${cleanNumber}`);
            }
            
            const whatsappJid = cleanNumber + '@s.whatsapp.net';
            console.log(`📱 Final WhatsApp JID: ${whatsappJid}`);
            console.log(`📱 Sending message: ${messageText.substring(0, 50)}...`);
            
            // Send WhatsApp message with timeout
            const sent = await Promise.race([
              sock.sendMessage(whatsappJid, { text: messageText }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Message send timeout')), 30000)
              )
            ]);
            
            console.log(`✅ Message sent to ${phoneNumber}: ${messageText.substring(0, 50)}...`);
            
            results.push({
              customerId,
              messageId: message.id || 'unknown',
              success: true,
              whatsappMessageId: sent.key.id,
              phoneNumber: phoneNumber,
              processId: processId
            });
            
            // Add delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (messageError) {
            console.error(`❌ Error sending message to ${phoneNumber}:`, messageError);
            results.push({
              customerId,
              messageId: message.id || 'unknown',
              success: false,
              error: messageError.message,
              phoneNumber: phoneNumber,
              processId: processId
            });
          }
        }
        
        // Add delay between customers
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (customerError) {
        console.error(`❌ Error processing customer ${customerId}:`, customerError);
        results.push({
          customerId,
          success: false,
          error: customerError.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`📊 Background message sending completed: ${successCount} success, ${failureCount} failures`);
    console.log(`📊 Process ID: ${processId}`);
    
    const response = {
      success: true,
      message: `Background messages processed: ${successCount} success, ${failureCount} failures`,
      processId: processId,
      data: {
        processId: processId,
        totalMessages: results.length,
        successCount,
        failureCount,
        results,
        totalCustomers: customerIds.length,
        estimatedTime: `${Math.ceil(customerIds.length * 2 / 60)} minutes`
      }
    };
    
    console.log(`📤 Sending response to mobile app:`, JSON.stringify(response, null, 2));
    
    // Always return success with processID, even if all messages failed
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Error sending background messages:`, error);
    
    // Generate a process ID even for errors
    const errorProcessId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorResponse = { 
      success: false, 
      error: error.message,
      processId: errorProcessId,
      data: {
        processId: errorProcessId,
        totalMessages: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        totalCustomers: 0,
        estimatedTime: '0 minutes'
      }
    };
    
    console.log(`📤 Sending error response to mobile app:`, JSON.stringify(errorResponse, null, 2));
    
    res.status(500).json(errorResponse);
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

// 8. Test Customer Data (debug endpoint)
app.get('/api/customers/test/:userId/:customerId', async (req, res) => {
  const { userId, customerId } = req.params;
  
  try {
    console.log(`🔍 Testing customer data for user: ${userId}, customer: ${customerId}`);
    
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error(`❌ Error fetching customer:`, error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log(`👤 Customer data:`, customer);
    
    res.json({
      success: true,
      customer: customer,
      hasPhoneNumber: !!customer?.phone_number,
      phoneNumber: customer?.phone_number || 'No phone number'
    });
  } catch (error) {
    console.error(`❌ Error testing customer:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Fetch Customers (mobile app endpoint)
app.post('/api/customers/fetch/:userId', async (req, res) => {
  const { userId } = req.params;
  const { filters = {}, limit = 100, offset = 0 } = req.body;
  
  try {
    console.log(`👥 Fetching customers for user: ${userId}`);
    console.log(`👥 Filters:`, filters);
    console.log(`👥 Limit: ${limit}, Offset: ${offset}`);
    
    let query = supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId);
    
    // Apply filters
    if (filters.area) {
      query = query.eq('area', filters.area);
    }
    if (filters.preferred_language) {
      query = query.eq('preferred_language', filters.preferred_language);
    }
    if (filters.phone_number) {
      query = query.ilike('phone_number', `%${filters.phone_number}%`);
    }
    if (filters.name) {
      query = query.ilike('name', `%${filters.name}%`);
    }
    
    // Apply pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });
    
    const { data: customers, error } = await query;
    
    if (error) {
      console.error(`❌ Error fetching customers:`, error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log(`✅ Found ${customers?.length || 0} customers for user: ${userId}`);
    
    res.json({
      success: true,
      data: customers || [],
      pagination: {
        limit,
        offset,
        count: customers?.length || 0
      }
    });
  } catch (error) {
    console.error(`❌ Error fetching customers:`, error);
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

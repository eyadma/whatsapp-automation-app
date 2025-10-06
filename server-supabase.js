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
const { dbLogger } = require('./database-logger');


require('dotenv').config();

// Retry utility function for database operations
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        console.log(`✅ Operation succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error(`❌ Operation failed after ${maxRetries} attempts:`, lastError);
  throw lastError;
}

// Export for testing
module.exports = { retryOperation };

// 24/7 Connection Persistence Manager
const connectionPersistenceManager = {
  connections: new Map(),
  statusListeners: new Map(),
  statusUpdateInterval: null, // Global status update interval
  
  // Initialize the persistence manager
  initialize() {
    console.log('🚀 Initializing connection persistence manager...');
    
    // Start global status update interval (every 30 seconds)
    this.statusUpdateInterval = setInterval(() => {
      this.broadcastStatusUpdates();
    }, 30000);
    
    console.log('✅ Connection persistence manager initialized');
  },
  
  // Broadcast status updates to all connected clients
  broadcastStatusUpdates() {
    const statusUpdates = [];
    
    this.connections.forEach((connection, key) => {
      const [userId, sessionId] = key.split('_');
      const statusData = {
        userId,
        sessionId,
        status: connection.status || 'unknown',
        connected: connection.connected || false,
        connecting: connection.connecting || false,
        lastSeen: connection.lastSeen || Date.now(),
        timestamp: new Date().toISOString()
      };
      
      statusUpdates.push(statusData);
      
      // Notify listeners
      this.notifyStatusChange(userId, sessionId, statusData.status);
    });
    
    if (statusUpdates.length > 0) {
      console.log(`📡 Broadcasting status updates for ${statusUpdates.length} connections`);
    }
  },
  
  // Add connection to persistence monitoring
  addConnection(userId, sessionId, connection) {
    const key = `${userId}_${sessionId}`;
    this.connections.set(key, {
      ...connection,
      lastSeen: Date.now(),
      status: 'connected',
      reconnectAttempts: 0
    });
    
    // Start monitoring this connection
    this.startConnectionMonitoring(userId, sessionId);
    
    // Notify status listeners
    this.notifyStatusChange(userId, sessionId, 'connected');
  },
  
  // Remove connection from monitoring
  removeConnection(userId, sessionId) {
    const key = `${userId}_${sessionId}`;
    this.connections.delete(key);
    this.notifyStatusChange(userId, sessionId, 'disconnected');
  },
  
  // Start monitoring connection health
  startConnectionMonitoring(userId, sessionId) {
    const key = `${userId}_${sessionId}`;
    const connection = this.connections.get(key);
    
    if (!connection) return;
    
    // Wait 60 seconds before starting health checks to allow connection to stabilize
    setTimeout(() => {
      const currentConnection = this.connections.get(key);
      if (!currentConnection) return;
      
      // Health check every 2 minutes (less aggressive)
      const healthCheck = setInterval(async () => {
        const currentConnection = this.connections.get(key);
        if (!currentConnection) {
          clearInterval(healthCheck);
          return;
        }
        
        try {
          // Check if socket is still alive using comprehensive WebSocket detection
          let wsReady = false;
          let wsState = 'unknown';
          
          if (currentConnection.sock?.ws?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.ws.readyState === 1';
          } else if (currentConnection.sock?.ws?.socket?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.ws.socket.readyState === 1';
          } else if (currentConnection.sock?.conn?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.conn.readyState === 1';
          } else if (currentConnection.sock?.connection?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.connection.readyState === 1';
          } else if (currentConnection.sock?.socket?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.socket.readyState === 1';
          }
          
          // Also check if the connection is actually working by testing sendMessage method
          const hasSendMessage = currentConnection.sock && typeof currentConnection.sock.sendMessage === 'function';
          
          // Check if connection is actually working by looking at the main connections map
          const mainConnection = getConnection(userId, sessionId);
          const isActuallyConnected = mainConnection && mainConnection.connected;
          
          if ((wsReady && hasSendMessage) || isActuallyConnected) {
            // Send ping to keep connection alive
            try {
              if (currentConnection.sock && typeof currentConnection.sock.ping === 'function') {
                await currentConnection.sock.ping();
              }
            } catch (pingError) {
              // Ping might fail but connection could still be working
              console.log(`⚠️ Ping failed but connection might still be working: ${pingError.message}`);
            }
            currentConnection.lastSeen = Date.now();
            currentConnection.status = 'connected';
            // Reset failure counter on successful health check
            currentConnection.healthCheckFailures = 0;
            console.log(`✅ Health check passed for user ${userId} (${wsState}, actuallyConnected: ${isActuallyConnected})`);
          } else {
            console.log(`⚠️ Socket not ready for user ${userId} (${wsState}, hasSendMessage: ${hasSendMessage}, actuallyConnected: ${isActuallyConnected}), but not triggering reconnection yet`);
            // Don't immediately trigger reconnection - just log the issue
            currentConnection.status = 'checking';
          }
        } catch (error) {
          console.log(`⚠️ Connection health check failed for ${userId}: ${error.message}`);
          // Only trigger reconnection after multiple failures
          if (!currentConnection.healthCheckFailures) {
            currentConnection.healthCheckFailures = 0;
          }
          currentConnection.healthCheckFailures++;
          
          // Only reconnect after 3 consecutive failures (6 minutes)
          if (currentConnection.healthCheckFailures >= 3) {
            console.log(`🔄 Triggering reconnection for ${userId} after ${currentConnection.healthCheckFailures} failures`);
            currentConnection.status = 'reconnecting';
            this.notifyStatusChange(userId, sessionId, 'reconnecting');
            
            // Reset failure counter
            currentConnection.healthCheckFailures = 0;
            
            // Trigger reconnection
            try {
              await connectWhatsApp(userId, sessionId);
            } catch (reconnectError) {
              console.error(`❌ Reconnection failed for ${userId}: ${reconnectError.message}`);
              currentConnection.status = 'failed';
              this.notifyStatusChange(userId, sessionId, 'failed');
            }
          } else {
            console.log(`⚠️ Health check failure ${currentConnection.healthCheckFailures}/3 for user ${userId}`);
          }
        }
      }, 120000); // Check every 2 minutes instead of 30 seconds
      
      // Store interval for cleanup
      currentConnection.healthCheckInterval = healthCheck;
    }, 60000); // Wait 60 seconds before starting health checks
  },
  
  // Add status change listener
  addStatusListener(userId, sessionId, callback) {
    const key = `${userId}_${sessionId}`;
    if (!this.statusListeners.has(key)) {
      this.statusListeners.set(key, []);
    }
    this.statusListeners.get(key).push(callback);
  },
  
  // Remove status change listener
  removeStatusListener(userId, sessionId, callback) {
    const key = `${userId}_${sessionId}`;
    const listeners = this.statusListeners.get(key);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  },
  
  // Notify all listeners of status change
  notifyStatusChange(userId, sessionId, status) {
    const key = `${userId}_${sessionId}`;
    const listeners = this.statusListeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(userId, sessionId, status);
        } catch (error) {
          console.error('Error in status listener:', error);
        }
      });
    }
  },
  
  // Get connection status
  getConnectionStatus(userId, sessionId) {
    const key = `${userId}_${sessionId}`;
    const connection = this.connections.get(key);
    return connection ? connection.status : 'disconnected';
  },
  
  // Get all connection statuses for a user
  getUserConnectionStatuses(userId) {
    const statuses = {};
    for (const [key, connection] of this.connections) {
      if (key.startsWith(`${userId}_`)) {
        const sessionId = key.split('_')[1];
        statuses[sessionId] = connection.status;
      }
    }
    return statuses;
  }
};

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// WhatsApp connection management - Updated for multi-session support
const connections = new Map(); // userId -> Map of sessionId -> connection
const userSessions = new Map(); // userId -> Set of active sessionIds
const connectionLocks = new Map(); // connectionKey -> connectionId (prevents multiple simultaneous connections)

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
  
  // Clear connection lock to prevent conflicts
  const connectionKey = `${userId}_${sessionId || 'default'}`;
  if (connectionLocks.has(connectionKey)) {
    connectionLocks.delete(connectionKey);
    console.log(`🔒 Cleared connection lock for ${connectionKey} during connection removal`);
  }
}

function getUserConnections(userId) {
  return connections.has(userId) ? Array.from(connections.get(userId).keys()) : [];
}

function getDefaultSession(userId) {
  if (!connections.has(userId)) return null;
  
  const userConnections = connections.get(userId);
  for (const [sessionId, connection] of userConnections) {
    if (connection.isDefault) {
      return sessionId;
    }
  }
  return null;
}

// Utility function to normalize phone numbers for comparison
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  let normalized = phoneNumber.replace(/\D/g, '');
  
  // Handle Israeli numbers: if it starts with 05, remove the 0
  if (normalized.startsWith('05') && normalized.length === 10) {
    normalized = normalized.substring(1);
  }
  
  // Handle international format: if it starts with 972, keep as is
  if (normalized.startsWith('972')) {
    return normalized;
  }
  
  // For other formats, add 972 prefix if it's a 9-digit number starting with 5
  if (normalized.startsWith('5') && normalized.length === 9) {
    normalized = '972' + normalized;
  }
  
  return normalized;
}

// Background message processing function with processed messages
async function processMessagesInBackgroundWithProcessed(processId, customers, processedMessages, userId, speedDelay, connection) {
  console.log(`🚀 Starting background processing for ${customers.length} customers with ${processedMessages.length} processed message groups`);
  
  const process = backgroundProcesses.get(processId);
  if (!process) {
    console.error(`❌ Process ${processId} not found`);
    return;
  }

  // Create a map of customer ID to processed message group
  const messageMap = new Map();
  processedMessages.forEach(pm => {
    messageMap.set(pm.customerId, pm);
  });

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    
    try {
      // Check if process was cancelled
      if (process.status === 'cancelled') {
        console.log(`⏹️ Process ${processId} was cancelled`);
        break;
      }

      // Get the pre-processed message group for this customer
      const customerMessageGroup = messageMap.get(customer.id);
      
      if (!customerMessageGroup) {
        console.warn(`⚠️ No processed message found for customer ${customer.name} (ID: ${customer.id})`);
        process.failed++;
        continue;
      }

      const { messages, languages, phone, phone2 } = customerMessageGroup;
      console.log(`📤 Processing ${messages.length} messages for ${customer.name} (${phone})`);

      // Send each message for this customer
      for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
        const message = messages[msgIndex];
        const language = languages[msgIndex] || 'unknown';
        
        // logger.info(`Sending message ${msgIndex + 1}/${messages.length} to ${customer.name}`); // Reduced logging

        // Send to primary phone number
        let phoneNumber = phone;
        if (!phoneNumber.startsWith('+')) {
          if (phoneNumber.startsWith('972')) {
            phoneNumber = '+' + phoneNumber;
          } else if (phoneNumber.startsWith('0')) {
            phoneNumber = '+972' + phoneNumber.substring(1);
          } else {
            phoneNumber = '+972' + phoneNumber;
          }
        }

        // Create JID for primary phone
        const jid = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
        
        // Send message to primary phone
        await connection.sock.sendMessage(jid, { text: message });
        console.log(`✅ Message sent to ${customer.name} (${phoneNumber}) - ${language}`);
        
        // Send to secondary phone number if available
        if (phone2 && phone2.trim() !== '') {
          let phoneNumber2 = phone2;
          if (!phoneNumber2.startsWith('+')) {
            if (phoneNumber2.startsWith('972')) {
              phoneNumber2 = '+' + phoneNumber2;
            } else if (phoneNumber2.startsWith('0')) {
              phoneNumber2 = '+972' + phoneNumber2.substring(1);
            } else {
              phoneNumber2 = '+972' + phoneNumber2;
            }
          }

          // Create JID for secondary phone
          const jid2 = `${phoneNumber2.replace(/\D/g, '')}@s.whatsapp.net`;
          
          try {
            await connection.sock.sendMessage(jid2, { text: message });
            console.log(`✅ Message sent to ${customer.name} (secondary: ${phoneNumber2}) - ${language}`);
          } catch (secondaryError) {
            console.error(`❌ Failed to send to secondary phone for ${customer.name}:`, secondaryError.message);
          }
        }
        
        // Add small delay between multiple messages to same customer
        if (msgIndex < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between messages
        }
      }
      
      // Update process status
      process.completed++;
      process.status = 'running';
      
      // Log to message history for each message sent
      for (const message of messages) {
        await supabase
          .from('message_history')
          .insert([{
            user_id: userId,
            customer_id: customer.id,
            message_text: message,
            status: 'sent',
            process_id: processId
          }]);
      }

      // Add delay between customers (except for the last customer)
      if (speedDelay > 0 && i < customers.length - 1) {
        // logger.info(`Waiting ${speedDelay} seconds`); // Reduced logging
        await new Promise(resolve => setTimeout(resolve, speedDelay * 1000));
      }

    } catch (error) {
      dbLogger.error('background', `Background message failed for ${customer.name}: ${error.message}`, { customerId: customer.id, customerName: customer.name, error: error.message }, userId);
      process.failed++;
      
      // Log failed message
      await supabase
        .from('message_history')
        .insert([{
          user_id: userId,
          customer_id: customer.id,
          message_text: 'Message failed to send',
          status: 'failed',
          error_message: error.message,
          process_id: processId
        }]);
    }
  }

  // Process completed
  process.status = 'completed';
  process.endTime = new Date();
  const duration = (process.endTime - process.startTime) / 1000;
  
  dbLogger.info('background', `Background process ${processId} completed in ${Math.floor(duration / 60)}m ${duration % 60}s`, { processId, duration, completed: process.completed, failed: process.failed }, userId);
  dbLogger.info('background', `Results: ${process.completed} sent, ${process.failed} failed`, { processId, completed: process.completed, failed: process.failed }, userId);
  
  // Send completion update message
  try {
    // Get user profile for completion message
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    
    const userName = userProfile?.full_name || 'User';
    const completionMessage = `✅ Background message sending completed!\n\n👤 Sent by: ${userName}\n📊 Results:\n- Total: ${customers.length}\n- Sent: ${process.completed}\n- Failed: ${process.failed}\n- Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`;
    
    const updateJid = '972526686285@s.whatsapp.net';
    await connection.sock.sendMessage(updateJid, { text: completionMessage });
    console.log(`✅ Completion message sent to ${updateJid}`);
  } catch (updateError) {
    console.error(`⚠️ Failed to send completion message:`, updateError.message);
  }
}

// Background message processing function (original - for backward compatibility)
async function processMessagesInBackground(processId, customers, messageTemplate, userId, speedDelay, connection) {
  console.log(`🔄 Starting background processing for ${customers.length} customers`);
  
  const process = backgroundProcesses.get(processId);
  if (!process) {
    console.error(`❌ Process ${processId} not found`);
    return;
  }

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    
    try {
      // Check if process was cancelled
      if (process.status === 'cancelled') {
        console.log(`⏹️ Process ${processId} was cancelled`);
        break;
      }

      // Debug customer data
      console.log(`🔍 Customer data for ${customer.name}:`, {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        area: customer.area,
        package_price: customer.package_price,
        package_id: customer.package_id,
        allFields: Object.keys(customer)
      });

      // Replace placeholders in message
      let personalizedMessage = messageTemplate
        .replace(/{name}/g, customer.name || 'Customer')
        .replace(/{phone}/g, customer.phone || 'Phone')
        .replace(/{area}/g, customer.area || 'Area')
        .replace(/{packagePrice}/g, customer.package_price || 'Price')
        .replace(/{packageId}/g, customer.package_id || 'ID');

      console.log(`📝 Message template:`, messageTemplate);
      console.log(`📝 Personalized message:`, personalizedMessage);

      // Format phone number for WhatsApp
      let phoneNumber = customer.phone;
      if (!phoneNumber.startsWith('+')) {
        if (phoneNumber.startsWith('972')) {
          phoneNumber = '+' + phoneNumber;
        } else if (phoneNumber.startsWith('0')) {
          phoneNumber = '+972' + phoneNumber.substring(1);
        } else {
          phoneNumber = '+972' + phoneNumber;
        }
      }

      // Create JID
      const jid = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
      
      // Check if we need to send multiple language messages
      const messagesToSend = Array.isArray(personalizedMessage) ? personalizedMessage : [personalizedMessage];
      
      for (let msgIndex = 0; msgIndex < messagesToSend.length; msgIndex++) {
        const message = messagesToSend[msgIndex];
        
        // Send message
        await connection.sock.sendMessage(jid, { text: message });
        console.log(`✅ Background message ${msgIndex + 1}/${messagesToSend.length} sent to ${customer.name} (${phoneNumber}) - ${i + 1}/${customers.length}`);
        
        // Add small delay between multiple messages to same customer
        if (msgIndex < messagesToSend.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between messages
        }
      }
      
      // Update process status
      process.completed++;
      process.status = 'running';
      
      // Log to message history
      await supabase
        .from('message_history')
        .insert([{
          user_id: userId,
          customer_id: customer.id,
          message_text: personalizedMessage,
          status: 'sent',
          process_id: processId
        }]);

      // Add delay between messages (except for the last message)
      if (speedDelay > 0 && i < customers.length - 1) {
        // logger.info(`Waiting ${speedDelay} seconds`); // Reduced logging
        await new Promise(resolve => setTimeout(resolve, speedDelay * 1000));
      }

    } catch (error) {
      dbLogger.error('background', `Background message failed for ${customer.name}: ${error.message}`, { customerId: customer.id, customerName: customer.name, error: error.message }, userId);
      process.failed++;
      
      // Log failed message
      await supabase
        .from('message_history')
        .insert([{
          user_id: userId,
          customer_id: customer.id,
          message_text: messageTemplate,
          status: 'failed',
          error_message: error.message,
          process_id: processId
        }]);
    }
  }

  // Process completed
  process.status = 'completed';
  process.endTime = new Date();
  const duration = (process.endTime - process.startTime) / 1000;
  
  dbLogger.info('background', `Background process ${processId} completed in ${Math.floor(duration / 60)}m ${duration % 60}s`, { processId, duration, completed: process.completed, failed: process.failed }, userId);
  dbLogger.info('background', `Results: ${process.completed} sent, ${process.failed} failed`, { processId, completed: process.completed, failed: process.failed }, userId);
  
  // Send completion update message
  try {
    // Get user profile for completion message
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    
    const userName = userProfile?.full_name || 'User';
    const completionMessage = `✅ Background message sending completed!\n\n👤 Sent by: ${userName}\n📊 Results:\n- Total: ${customers.length}\n- Sent: ${process.completed}\n- Failed: ${process.failed}\n- Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`;
    
    const updateJid = '972526686285@s.whatsapp.net';
    await connection.sock.sendMessage(updateJid, { text: completionMessage });
    console.log(`✅ Completion message sent to ${updateJid}`);
  } catch (updateError) {
    console.error(`⚠️ Failed to send completion message:`, updateError.message);
  }
}

// Connection health check function
async function checkConnectionHealth(connection) {
  if (!connection || !connection.sock) {
    console.log('❌ No connection or socket object');
    return false;
  }
  
  try {
    // Socket is valid - no need for verbose logging
    
    if (typeof connection.sock.sendMessage !== 'function') {
      console.log('❌ Socket missing sendMessage method');
      return false;
    }
    
    // Try different ways to check WebSocket state
    let wsReady = false;
    let wsState = 'unknown';
    
    if (connection.sock.ws) {
      wsReady = true;
      wsState = 'sock.ws.readyState === 1';
    } else if (connection.sock.conn) {
      wsReady = true;
      wsState = 'sock.conn.readyState === 1';
    } else if (connection.sock.connection) {
      wsReady = true;
      wsState = 'sock.connection.readyState === 1';
    } else if (connection.sock.socket) {
      wsReady = true;
      wsState = 'sock.socket.readyState === 1';
    }
    
    console.log(`📊 WebSocket ready: ${wsReady} (${wsState})`);
    
    if (!wsReady) {
      console.log('❌ WebSocket not ready');
      return false;
    }
    
    console.log('✅ Connection health check passed');
    return true;
  } catch (error) {
    console.error('❌ Connection health check failed:', error);
    return false;
  }
}

// Function to update connection states
function updateConnectionStates() {
  connections.forEach((connection, userId) => {
    if (connection.connecting) {
      let wsReady = false;
      if (connection.sock?.ws?.readyState === 1) {
        wsReady = true;
      } else if (connection.sock?.ws?.socket?.readyState === 1) {
        wsReady = true;
      } else if (connection.sock?.conn?.readyState === 1) {
        wsReady = true;
      } else if (connection.sock?.connection?.readyState === 1) {
        wsReady = true;
      } else if (connection.sock?.socket?.readyState === 1) {
        wsReady = true;
      }
      
      if (wsReady) {
        console.log(`🔄 Updating connection state for user: ${userId} - WebSocket is now ready`);
        connection.connected = true;
        connection.connecting = false;
        
        // Update Supabase
        supabase
          .from('whatsapp_sessions')
          .upsert([{
            session_id: userId,
            session_data: JSON.stringify({ connected: true, timestamp: new Date() })
          }])
          .then(() => console.log(`✅ Supabase updated for user: ${userId}`))
          .catch(error => console.error(`❌ Error updating Supabase for user ${userId}:`, error));
      }
    }
  });
}

// Start periodic connection state updates
setInterval(updateConnectionStates, 5000); // Check every 5 seconds

async function connectWhatsApp(userId, sessionId = null) {
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    dbLogger.info('connection', `Starting WhatsApp connection for user: ${userId}, session: ${sessionId || 'default'}`, {
      userId,
      sessionId: sessionId || 'default',
      connectionId,
      timestamp: new Date().toISOString()
    }, userId, sessionId);
    
    // Validate inputs
    if (!userId) {
      dbLogger.error('connection', 'Validation failed: userId is required', { connectionId }, userId, sessionId);
      throw new Error('userId is required');
    }
    
    // Add connection lock to prevent multiple simultaneous connections
    const connectionKey = `${userId}_${sessionId || 'default'}`;
    
    // Check if there's already a working connection
    const existingConnection = getConnection(userId, sessionId);
    if (existingConnection && existingConnection.connected) {
      dbLogger.info('connection', `Connection already exists and is connected for ${connectionKey}`, { connectionId, connectionKey }, userId, sessionId);
      return existingConnection;
    }
    
    if (connectionLocks.has(connectionKey)) {
      dbLogger.info('connection', `Connection already in progress for ${connectionKey}, waiting...`, { connectionId, connectionKey }, userId, sessionId);
      // Wait for existing connection to complete
      let attempts = 0;
      while (connectionLocks.has(connectionKey) && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      // Check if connection was established while waiting
      const establishedConnection = getConnection(userId, sessionId);
      if (establishedConnection && establishedConnection.connected) {
        dbLogger.info('connection', `Connection established while waiting for lock`, { connectionId }, userId, sessionId);
        return establishedConnection;
      }
    }
    
    // Set connection lock
    connectionLocks.set(connectionKey, connectionId);
    dbLogger.info('connection', `Set connection lock for ${connectionKey}`, { connectionId, connectionKey }, userId, sessionId);
    
    const sessionDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'sessions', userId, sessionId || 'default');
    dbLogger.debug('connection', `Session directory: ${sessionDir}`, {
      RAILWAY_VOLUME_MOUNT_PATH: process.env.RAILWAY_VOLUME_MOUNT_PATH,
      __dirname: __dirname,
      finalPath: sessionDir,
      connectionId
    }, userId, sessionId);
    
    try {
      const dirExists = fs.existsSync(sessionDir);
      dbLogger.debug('connection', `Session directory exists: ${dirExists}`, { connectionId, dirExists }, userId, sessionId);
      
      if (!dirExists) {
        dbLogger.info('connection', `Creating session directory for user: ${userId}, session: ${sessionId || 'default'}`, { connectionId }, userId, sessionId);
        const mkdirStart = Date.now();
        fs.mkdirSync(sessionDir, { recursive: true });
        const mkdirDuration = Date.now() - mkdirStart;
        dbLogger.info('connection', `Session directory created in ${mkdirDuration}ms`, { connectionId, mkdirDuration }, userId, sessionId);
      }
      
      const dirContents = fs.readdirSync(sessionDir);
      const totalSize = dirContents.reduce((total, file) => {
        try {
          const filePath = path.join(sessionDir, file);
          const stats = fs.statSync(filePath);
          return total + (stats.isFile() ? stats.size : 0);
        } catch (e) {
          return total;
        }
      }, 0);
      
      dbLogger.debug('connection', `Session directory contents: ${dirContents.length} files, ${totalSize} bytes`, {
        connectionId,
        fileCount: dirContents.length,
        files: dirContents,
        totalSize
      }, userId, sessionId);
    } catch (fsError) {
      dbLogger.error('connection', `File system error for user ${userId}: ${fsError.message}`, {
        connectionId,
        error: fsError.message,
        stack: fsError.stack,
        sessionDir,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
      throw new Error(`Failed to create session directory: ${fsError.message}`);
    }

    dbLogger.info('auth', `Loading auth state for user: ${userId}`, { connectionId }, userId, sessionId);
    let state, saveCreds;
    try {
      const authStart = Date.now();
      dbLogger.debug('auth', 'Starting auth state loading...', { connectionId }, userId, sessionId);
      
      const authResult = await useMultiFileAuthState(sessionDir);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
      
      const authDuration = Date.now() - authStart;
      dbLogger.info('auth', `Auth state loaded for user: ${userId} in ${authDuration}ms`, {
        connectionId,
        hasState: !!state,
        hasSaveCreds: !!saveCreds,
        stateKeys: state ? Object.keys(state) : [],
        duration: authDuration
      }, userId, sessionId);
    } catch (authError) {
      dbLogger.error('auth', `Auth state error for user ${userId}: ${authError.message}`, {
        connectionId,
        error: authError.message,
        stack: authError.stack,
        sessionDir,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
      throw new Error(`Failed to load auth state: ${authError.message}`);
    }

    dbLogger.info('socket', `Creating WhatsApp socket for user: ${userId}`, { connectionId }, userId, sessionId);
    let sock;
    try {
      console.log(`🔧 Creating socket for user ${userId}, session: ${sessionId || 'default'}`);
      
      // Set initial connection status to connecting
      const initialConnectionData = {
        userId,
        sessionId: sessionId || 'default',
        status: 'connecting',
        connectionId,
        startTime: new Date().toISOString(),
        reconnectAttempts: 0
      };
      connectionPersistenceManager.addConnection(userId, sessionId || 'default', initialConnectionData);
      console.log(`🔄 Set initial connecting status for user ${userId}`);
      
      // Create proper logger according to Baileys docs
      const logger = {
        level: 'info',
        child: () => logger,
        trace: (obj, msg) => console.log(`[TRACE] ${msg}`, obj),
        debug: (obj, msg) => console.log(`[DEBUG] ${msg}`, obj),
        info: (obj, msg) => console.log(`[INFO] ${msg}`, obj),
        warn: (obj, msg) => console.warn(`[WARN] ${msg}`, obj),
        error: (obj, msg) => console.error(`[ERROR] ${msg}`, obj),
        fatal: (obj, msg) => console.error(`[FATAL] ${msg}`, obj)
      };

      const socketConfig = {
        auth: state,
        logger: logger,
        // Proper browser configuration for desktop emulation
        browser: ['WhatsApp Desktop', 'Chrome', '1.0.0'],
        // Connection settings - enhanced for better timing
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 3000, // Increased from 2000 to 3000ms for better timing
        maxRetries: 5,
        defaultQueryTimeoutMs: 120000,
        // Additional timing settings to prevent 515 errors
        requestTimeoutMs: 60000,
        // Session settings
        emitOwnEvents: false,
        markOnlineOnConnect: false, // Don't mark online to avoid notification issues
        generateHighQualityLinkPreview: true,
        // Message retrieval function - required by Baileys
        getMessage: async (key) => {
          try {
            // Try to retrieve message from database or return null
            // This is required for message decryption and resending
            dbLogger.debug('message', `Retrieving message for key: ${JSON.stringify(key)}`, { connectionId }, userId, sessionId);
            return null; // For now, return null - implement database lookup if needed
          } catch (error) {
            dbLogger.error('message', `Error retrieving message: ${error.message}`, { connectionId, error: error.message }, userId, sessionId);
            return null;
          }
        }
      };
      
      dbLogger.debug('socket', 'Socket configuration', {
        connectionId,
        connectTimeoutMs: socketConfig.connectTimeoutMs,
        keepAliveIntervalMs: socketConfig.keepAliveIntervalMs,
        retryRequestDelayMs: socketConfig.retryRequestDelayMs,
        maxRetries: socketConfig.maxRetries,
        defaultQueryTimeoutMs: socketConfig.defaultQueryTimeoutMs,
        emitOwnEvents: socketConfig.emitOwnEvents,
        markOnlineOnConnect: socketConfig.markOnlineOnConnect
      }, userId, sessionId);
      
      const socketStart = Date.now();
      console.log(`🔧 Making WhatsApp socket for user ${userId}...`);
      sock = makeWASocket(socketConfig);
      const socketDuration = Date.now() - socketStart;
      console.log(`✅ WhatsApp socket created for user ${userId} in ${socketDuration}ms`);
      
      dbLogger.info('socket', `WhatsApp socket created for user: ${userId} in ${socketDuration}ms`, {
        connectionId,
        socketId: sock.id,
        duration: socketDuration,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
    } catch (socketError) {
      dbLogger.error('socket', `Socket creation error for user ${userId}: ${socketError.message}`, {
        connectionId,
        error: socketError.message,
        stack: socketError.stack,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
      throw new Error(`Failed to create WhatsApp socket: ${socketError.message}`);
    }

    // Session health monitoring
    const sessionStartTime = new Date();
    let streamErrorCount = 0;
    const maxStreamErrors = 5; // Allow up to 5 stream errors before considering connection unstable
    
    const sessionHealthCheck = setInterval(() => {
      const sessionDuration = new Date() - sessionStartTime;
      const hoursAlive = Math.floor(sessionDuration / (1000 * 60 * 60));
      const minutesAlive = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));
      
      dbLogger.debug('connection', `Session health check for user ${userId}: ${hoursAlive}h ${minutesAlive}m alive, stream errors: ${streamErrorCount}`, {
        connectionId,
        hoursAlive,
        minutesAlive,
        sessionDuration: `${hoursAlive}h ${minutesAlive}m`,
        streamErrorCount
      }, userId, sessionId);
      
      // Log session milestone every hour
      if (minutesAlive === 0 && hoursAlive > 0) {
        dbLogger.info('connection', `Session milestone: ${hoursAlive} hours alive for user ${userId}`, {
          connectionId,
          hoursAlive,
          milestone: true
        }, userId, sessionId);
        
        // Reset stream error count every hour
        if (streamErrorCount > 0) {
          console.log(`🔄 Resetting stream error count for user ${userId} after ${hoursAlive} hours (was ${streamErrorCount})`);
          streamErrorCount = 0;
        }
      }
      
      // Check if socket is still healthy
      const socketState = sock?.ws?.readyState;
      const socketHealthy = socketState === 1;
      
      const readyStateText = socketState === 0 ? 'CONNECTING' : 
                             socketState === 1 ? 'OPEN' : 
                             socketState === 2 ? 'CLOSING' : 
                             socketState === 3 ? 'CLOSED' : 'UNKNOWN';
      
      dbLogger.debug('socket', `Socket health details: ${socketHealthy ? 'HEALTHY' : 'WARNING'} - ${readyStateText}`, {
        connectionId,
        socketHealthy,
        readyState: socketState,
        readyStateText,
        sessionDuration: `${hoursAlive}h ${minutesAlive}m`,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
      
      if (!socketHealthy) {
        dbLogger.warn('socket', `Socket health warning for user ${userId} - ReadyState: ${socketState} (${readyStateText})`, {
          connectionId,
          readyState: socketState,
          readyStateText
        }, userId, sessionId);
      }
    }, 300000); // Check every 5 minutes

    // Handle stream errors
    sock.ev.on('stream:error', (error) => {
      console.log(`❌ Stream error for user ${userId}:`, error);
      
      // Increment stream error counter
      streamErrorCount++;
      
      // Extract error information from different possible structures
      const errorCode = error?.node?.attrs?.code;
      const errorContent = error?.node?.content;
      const errorTag = error?.node?.tag;
      
      // Log detailed error information for debugging
      console.log(`🔍 Stream error details (${streamErrorCount}/${maxStreamErrors}):`, {
        tag: errorTag,
        attrs: error?.node?.attrs,
        content: errorContent,
        fullError: error
      });
      
      // Handle specific error codes
      if (errorCode === '515') {
        console.log(`⏰ 515 Stream error detected for user ${userId} - pairing timing issue`);
        dbLogger.warn('connection', `515 Stream error detected for user ${userId} - pairing timing issue`, {
          connectionId,
          userId,
          sessionId: sessionId || 'default',
          errorCode: '515',
          error: error,
          timestamp: new Date().toISOString()
        }, userId, sessionId);
        
        // Don't immediately disconnect, let the connection.update handler deal with it
        return;
      }
      
      // Handle 503 Service Unavailable errors
      if (errorCode === '503') {
        console.log(`🚫 503 Service Unavailable error for user ${userId} - WhatsApp server temporarily unavailable`);
        dbLogger.warn('connection', `503 Service Unavailable error for user ${userId} - WhatsApp server temporarily unavailable`, {
          connectionId,
          userId,
          sessionId: sessionId || 'default',
          errorCode: '503',
          error: error,
          timestamp: new Date().toISOString()
        }, userId, sessionId);
        
        // 503 errors are typically temporary, don't treat as fatal
        console.log(`🔄 503 error is temporary, continuing connection for user ${userId}`);
        return;
      }
      
      // Handle errors with empty attrs but content
      if (!errorCode && errorContent && Array.isArray(errorContent)) {
        console.log(`⚠️ Stream error with content for user ${userId}:`, errorContent);
        
        // Try to extract more information from the content
        let errorDetails = 'Unknown stream error';
        if (errorContent.length > 0) {
          const firstContent = errorContent[0];
          if (typeof firstContent === 'object') {
            errorDetails = JSON.stringify(firstContent);
          } else {
            errorDetails = String(firstContent);
          }
        }
        
        dbLogger.warn('connection', `Stream error with content for user ${userId}: ${errorDetails}`, {
          connectionId,
          userId,
          sessionId: sessionId || 'default',
          errorTag: errorTag,
          errorContent: errorContent,
          errorDetails: errorDetails,
          error: error,
          timestamp: new Date().toISOString()
        }, userId, sessionId);
        
        // Check if this is a recoverable error
        const isRecoverableError = errorTag === 'stream:error' && 
                                 (!errorCode || errorCode === '0' || errorCode === '');
        
        // Check if we have too many stream errors
        if (streamErrorCount >= maxStreamErrors) {
          console.log(`🚨 Too many stream errors (${streamErrorCount}/${maxStreamErrors}) for user ${userId}, connection may be unstable`);
          dbLogger.error('connection', `Too many stream errors for user ${userId}: ${streamErrorCount}/${maxStreamErrors}`, {
            connectionId,
            userId,
            sessionId: sessionId || 'default',
            streamErrorCount,
            maxStreamErrors,
            error: error,
            timestamp: new Date().toISOString()
          }, userId, sessionId);
          
          // Don't disconnect immediately, but log the concern
          return;
        }
        
        if (isRecoverableError) {
          console.log(`🔄 Treating stream error as recoverable for user ${userId}, continuing connection`);
          // Don't treat this as a fatal error, just log it and continue
          return;
        }
        
        // For non-recoverable errors, log but don't immediately disconnect
        console.log(`⚠️ Non-recoverable stream error for user ${userId}, monitoring connection state`);
        return;
      }
      
      // Handle other stream errors
      dbLogger.error('connection', `Stream error for user ${userId}: ${error.message || 'Unknown error'}`, {
        connectionId,
        userId,
        sessionId: sessionId || 'default',
        errorCode: errorCode || 'unknown',
        errorTag: errorTag,
        errorContent: errorContent,
        error: error,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
    });

    // Handle connection errors
    sock.ev.on('connection.error', (error) => {
      console.log(`❌ Connection error for user ${userId}:`, error);
      dbLogger.error('connection', `Connection error for user ${userId}: ${error.message}`, {
        connectionId,
        userId,
        sessionId: sessionId || 'default',
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
    });

    // Handle connection updates according to Baileys documentation
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log(`🔄 Connection update for user ${userId}:`, JSON.stringify(update, null, 2));
      dbLogger.info('connection', `Connection update for user ${userId}`, {
        connectionId,
        userId,
        sessionId: sessionId || 'default',
        update,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
      
      dbLogger.debug('connection', 'Connection update details', {
        connectionId,
        connection,
        hasLastDisconnect: !!lastDisconnect,
        hasQR: !!qr,
        lastDisconnectReason: lastDisconnect?.error?.message,
        lastDisconnectCode: lastDisconnect?.error?.output?.statusCode
      }, userId, sessionId);
      
      // Handle QR code generation
      if (qr) {
        dbLogger.info('connection', `QR Code received for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`, {
          connectionId,
          userId,
          sessionId: sessionId || 'default',
          qrLength: qr.length,
          qrPrefix: qr.substring(0, 20) + '...',
          timestamp: new Date().toISOString()
        }, userId, sessionId);
        
        const connectionData = {
          sock,
          connected: false,
          connecting: true,
          qrCode: qr,
          sessionId: sessionId || 'default',
          sessionName: sessionId ? `Session ${sessionId}` : 'Default Session',
          isDefault: !sessionId || sessionId === 'default',
          connectionType: 'qr_required' // Indicates QR code is needed
        };
        
        dbLogger.debug('connection', 'Setting connection data for QR required', {
          connectionId,
          userId,
          sessionId: sessionId || 'default',
          connected: false,
          connecting: true,
          hasSocket: !!sock,
          socketReady: sock?.ws?.readyState === 1,
          connectionType: 'qr_required',
          timestamp: new Date().toISOString()
        }, userId, sessionId);
        
        setConnection(userId, sessionId || 'default', connectionData);
        
        // Update persistence manager with QR status
        const qrConnectionData = {
          userId,
          sessionId: sessionId || 'default',
          status: 'qr_required',
          connectionId,
          qrCode: qr,
          startTime: new Date().toISOString(),
          reconnectAttempts: 0
        };
        connectionPersistenceManager.addConnection(userId, sessionId || 'default', qrConnectionData);
        console.log(`🔄 Updated persistence manager with QR status for user ${userId}`);
        
        dbLogger.debug('connection', `Connection set for user ${userId}`, { connectionId }, userId, sessionId);
      }
      
      // Handle connection close according to Baileys documentation
      if (connection === 'close') {
        console.log(`❌ Connection closed for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
        console.log(`📊 Disconnect details:`, {
          reason: lastDisconnect?.error?.output?.statusCode,
          message: lastDisconnect?.error?.message,
          timestamp: new Date().toISOString()
        });
        
        // Handle restartRequired disconnect - this is normal after QR scan
        if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.restartRequired) {
          console.log(`🔄 Restart required for user ${userId} - this is normal after QR scan`);
          dbLogger.info('connection', `Restart required for user ${userId} - creating new socket`, {
            connectionId,
            userId,
            sessionId: sessionId || 'default',
            reason: 'restartRequired',
            timestamp: new Date().toISOString()
          }, userId, sessionId);
          
          // Clean up current connection
          removeConnection(userId, sessionId || 'default');
          
          // Create new socket as recommended by Baileys docs
          setTimeout(async () => {
            try {
              console.log(`🔄 Creating new socket after restart required for user ${userId}`);
              
              // Check if there's already a working connection before creating new one
              const existingConnection = getConnection(userId, sessionId);
              if (existingConnection && existingConnection.connected) {
                console.log(`✅ Connection already exists and is connected, skipping restart for user ${userId}`);
                return;
              }
              
              await connectWhatsApp(userId, sessionId);
            } catch (error) {
              console.error(`❌ Failed to create new socket after restart: ${error.message}`);
              dbLogger.error('connection', `Failed to create new socket after restart: ${error.message}`, {
                connectionId,
                userId,
                sessionId: sessionId || 'default',
                error: error.message,
                stack: error.stack
              }, userId, sessionId);
            }
          }, 3000); // Wait 3 seconds before creating new socket to ensure old connection is fully closed
          
          return; // Don't proceed with normal disconnect handling
        }
        
        // Handle device_removed disconnect - session was revoked by user
        if (lastDisconnect?.error?.output?.statusCode === 401 && 
            lastDisconnect?.error?.data?.content?.[0]?.attrs?.type === 'device_removed') {
          console.log(`📱 Device removed for user ${userId} - session was revoked, cleaning up`);
          dbLogger.warn('connection', `Device removed for user ${userId} - session was revoked by user`, {
            connectionId,
            userId,
            sessionId: sessionId || 'default',
            reason: 'device_removed',
            timestamp: new Date().toISOString()
          }, userId, sessionId);
          
          // Clean up current connection
          removeConnection(userId, sessionId || 'default');
          
          // Clean up session files since they're no longer valid
          const sessionDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'sessions', userId, sessionId || 'default');
          try {
            if (fs.existsSync(sessionDir)) {
              console.log(`🧹 Cleaning up invalid session files for user: ${userId}, session: ${sessionId || 'default'}`);
              const files = fs.readdirSync(sessionDir);
              for (const file of files) {
                const filePath = path.join(sessionDir, file);
                if (fs.statSync(filePath).isFile()) {
                  fs.unlinkSync(filePath);
                  console.log(`🗑️ Removed invalid session file: ${file}`);
                }
              }
              console.log(`✅ Invalid session files cleaned up for user: ${userId}, session: ${sessionId || 'default'}`);
            }
          } catch (cleanupError) {
            console.error(`❌ Error cleaning up invalid session files for user ${userId}, session ${sessionId || 'default'}:`, cleanupError);
          }
          
          // Update database status to indicate session needs QR scan
          try {
            await supabase
              .from('whatsapp_sessions')
              .update({ 
                status: 'qr_required',
                last_activity: new Date().toISOString()
              })
              .eq('session_id', sessionId || 'default')
              .eq('user_id', userId);
            console.log(`📊 Updated database status to 'qr_required' for user: ${userId}, session: ${sessionId || 'default'}`);
          } catch (dbError) {
            console.error(`❌ Error updating database status for user ${userId}, session ${sessionId || 'default'}:`, dbError);
          }
          
          return; // Don't proceed with normal disconnect handling or reconnection
        }
        
        // Handle 515 stream error - pairing code timing issues
        if (lastDisconnect?.error?.output?.statusCode === 515) {
          console.log(`⏰ 515 Stream error for user ${userId} - pairing code timing issue, will retry`);
          dbLogger.warn('connection', `515 Stream error for user ${userId} - pairing code timing issue`, {
            connectionId,
            userId,
            sessionId: sessionId || 'default',
            reason: 'pairing_timing_error',
            timestamp: new Date().toISOString()
          }, userId, sessionId);
          
          // Clean up current connection
          removeConnection(userId, sessionId || 'default');
          
          // Wait longer before reconnecting to allow proper timing
          setTimeout(async () => {
            try {
              console.log(`🔄 Retrying connection after 515 error for user ${userId} with longer delay`);
              
              // Check if there's already a working connection before creating new one
              const existingConnection = getConnection(userId, sessionId);
              if (existingConnection && existingConnection.connected) {
                console.log(`✅ Connection already exists and is connected, skipping retry for user ${userId}`);
                return;
              }
              
              await connectWhatsApp(userId, sessionId);
            } catch (error) {
              console.error(`❌ Failed to retry connection after 515 error for user ${userId}: ${error.message}`);
              dbLogger.error('connection', `Failed to retry connection after 515 error: ${error.message}`, {
                connectionId,
                userId,
                sessionId: sessionId || 'default',
                error: error.message,
                stack: error.stack
              }, userId, sessionId);
            }
          }, 10000); // Wait 10 seconds before retrying to ensure proper timing
          
          return; // Don't proceed with normal disconnect handling
        }
        
        // Handle 503 Service Unavailable errors
        if (lastDisconnect?.error?.output?.statusCode === 503) {
          console.log(`🚫 503 Service Unavailable for user ${userId} - WhatsApp server temporarily unavailable, will retry`);
          dbLogger.warn('connection', `503 Service Unavailable for user ${userId} - WhatsApp server temporarily unavailable`, {
            connectionId,
            userId,
            sessionId: sessionId || 'default',
            reason: 'service_unavailable',
            timestamp: new Date().toISOString()
          }, userId, sessionId);
          
          // Clean up current connection
          removeConnection(userId, sessionId || 'default');
          
          // Wait before reconnecting - 503 errors are temporary server issues
          setTimeout(async () => {
            try {
              console.log(`🔄 Retrying connection after 503 error for user ${userId} - server should be available`);
              
              // Check if there's already a working connection before creating new one
              const existingConnection = getConnection(userId, sessionId);
              if (existingConnection && existingConnection.connected) {
                console.log(`✅ Connection already exists and is connected, skipping retry for user ${userId}`);
                return;
              }
              
              await connectWhatsApp(userId, sessionId);
            } catch (error) {
              console.error(`❌ Failed to retry connection after 503 error for user ${userId}: ${error.message}`);
              dbLogger.error('connection', `Failed to retry connection after 503 error: ${error.message}`, {
                connectionId,
                userId,
                sessionId: sessionId || 'default',
                error: error.message,
                stack: error.stack
              }, userId, sessionId);
            }
          }, 15000); // Wait 15 seconds before retrying - 503 errors may need more time
          
          return; // Don't proceed with normal disconnect handling
        }
        
        dbLogger.warn('connection', `Connection closed for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`, {
          connectionId,
          userId,
          sessionId: sessionId || 'default',
          lastDisconnect,
          disconnectReason: lastDisconnect?.error?.output?.statusCode,
          disconnectMessage: lastDisconnect?.error?.message,
          timestamp: new Date().toISOString()
        }, userId, sessionId);
        
        // Clear the health check interval
        if (sessionHealthCheck) {
          clearInterval(sessionHealthCheck);
          dbLogger.debug('connection', `Cleared health check interval for user: ${userId}`, { connectionId }, userId, sessionId);
        }
        
        // Clear the keep-alive interval
        const connection = getConnection(userId, sessionId || 'default');
        if (connection && connection.keepAliveInterval) {
          clearInterval(connection.keepAliveInterval);
          dbLogger.debug('connection', `Cleared keep-alive interval for user: ${userId}`, { connectionId }, userId, sessionId);
        }
        
        // Don't reconnect for loggedOut, device_removed, or handled error scenarios
        const isLoggedOut = (lastDisconnect?.error)?.output?.statusCode === DisconnectReason.loggedOut;
        const isDeviceRemoved = (lastDisconnect?.error)?.output?.statusCode === 401 && 
                               lastDisconnect?.error?.data?.content?.[0]?.attrs?.type === 'device_removed';
        const isHandledError = (lastDisconnect?.error)?.output?.statusCode === 515 || 
                              (lastDisconnect?.error)?.output?.statusCode === 503;
        const shouldReconnect = !isLoggedOut && !isDeviceRemoved && !isHandledError;
        
        dbLogger.debug('connection', `Reconnection decision: ${shouldReconnect ? 'WILL_RECONNECT' : 'WILL_NOT_RECONNECT'}`, {
          connectionId,
          shouldReconnect,
          disconnectCode: lastDisconnect?.error?.output?.statusCode,
          loggedOutCode: DisconnectReason.loggedOut,
          isLoggedOut,
          isDeviceRemoved,
          isHandledError
        }, userId, sessionId);
        
        if (shouldReconnect) {
          dbLogger.info('connection', `Attempting 24/7 reconnect for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`, { connectionId }, userId, sessionId);
          // Less aggressive reconnection to prevent conflicts: 5s, 15s, 30s, 60s, then every 2 minutes
          const reconnectDelays = [5000, 15000, 30000, 60000, 120000];
          let reconnectAttempts = 0;
          
          const attemptReconnect = () => {
            reconnectAttempts++;
            const delay = reconnectDelays[Math.min(reconnectAttempts - 1, reconnectDelays.length - 1)];
            
            // Check if there's already a connection in progress
            const connectionKey = `${userId}_${sessionId || 'default'}`;
            if (connectionLocks.has(connectionKey)) {
              dbLogger.info('connection', `Skipping reconnection attempt ${reconnectAttempts} - connection already in progress for ${connectionKey}`, {
                connectionId,
                userId,
                sessionId: sessionId || 'default',
                attempt: reconnectAttempts,
                connectionKey
              }, userId, sessionId);
              
              // Try again after the delay
              setTimeout(attemptReconnect, delay);
              return;
            }
            
            dbLogger.info('connection', `24/7 Reconnection attempt ${reconnectAttempts} for user ${userId} in ${delay/1000}s`, {
              connectionId,
              userId,
              sessionId: sessionId || 'default',
              attempt: reconnectAttempts,
              delay: delay,
              maxAttempts: 'UNLIMITED',
              timestamp: new Date().toISOString()
            }, userId, sessionId);
            
            setTimeout(() => {
              connectWhatsApp(userId, sessionId).catch(error => {
                dbLogger.error('connection', `24/7 Reconnection attempt ${reconnectAttempts} failed for user ${userId}: ${error.message}`, {
                  connectionId,
                  userId,
                  sessionId: sessionId || 'default',
                  attempt: reconnectAttempts,
                  error: error.message,
                  stack: error.stack,
                  timestamp: new Date().toISOString()
                }, userId, sessionId);
                
                // For 24/7 operation, keep trying indefinitely
                attemptReconnect();
              });
            }, delay);
          };
          
          attemptReconnect();
        } else {
          if (isDeviceRemoved) {
            dbLogger.info('connection', `Device removed for user ${userId}, not attempting reconnection`, { connectionId }, userId, sessionId);
          } else if (isHandledError) {
            dbLogger.info('connection', `Handled error (${lastDisconnect?.error?.output?.statusCode}) for user ${userId}, not attempting reconnection`, { connectionId }, userId, sessionId);
          } else {
            dbLogger.info('connection', `User ${userId} logged out, removing connection`, { connectionId }, userId, sessionId);
          }
          removeConnection(userId, sessionId || 'default');
        }
      } 
      
      // Handle connection open
      else if (connection === 'open') {
        dbLogger.info('connection', `Connection opened for user: ${userId}`, {
          connectionId,
          userId,
          sessionId: sessionId || 'default',
          timestamp: new Date().toISOString(),
          totalConnectionTime: Date.now() - startTime
        }, userId, sessionId);
        
        // Start session keep-alive mechanism
        const keepAliveInterval = setInterval(async () => {
          try {
            if (sock && sock.ws && sock.ws.readyState === 1) {
              // Send a ping to keep the connection alive
              await sock.ping();
              dbLogger.debug('connection', `Keep-alive ping sent for user: ${userId}`, { connectionId }, userId, sessionId);
            } else {
              dbLogger.warn('connection', `Cannot send keep-alive ping for user ${userId} - socket not ready`, { connectionId }, userId, sessionId);
            }
          } catch (error) {
            dbLogger.error('connection', `Keep-alive ping failed for user ${userId}: ${error.message}`, {
              connectionId,
              userId,
              error: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            }, userId, sessionId);
          }
        }, 300000); // Send ping every 5 minutes
        
        // Store the keep-alive interval for cleanup
        const connection = getConnection(userId, sessionId || 'default');
        if (connection) {
          connection.keepAliveInterval = keepAliveInterval;
        }
        
        // Wait a moment for WebSocket to be fully initialized
        setTimeout(async () => {
          console.log(`🔍 Checking WebSocket state for user: ${userId}`);
          console.log(`📊 Socket details:`, {
            hasSock: !!sock,
            hasWs: !!(sock && sock.ws),
            readyState: sock?.ws?.readyState,
            sockKeys: sock ? Object.keys(sock) : []
          });
          
          // Check if WebSocket is ready
          let wsReady = false;
          let wsState = 'unknown';
          
          if (sock?.ws?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.ws.readyState === 1';
          } else if (sock?.ws?.socket?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.ws.socket.readyState === 1';
          } else if (sock?.conn?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.conn.readyState === 1';
          } else if (sock?.connection?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.connection.readyState === 1';
          } else if (sock?.socket?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.socket.readyState === 1';
          }
          
          if (wsReady) {
            console.log(`✅ WebSocket is ready for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
            
            // Check if this connection was established from a saved session (no QR code needed)
            const existingConnection = getConnection(userId, sessionId || 'default');
            const connectionType = existingConnection && existingConnection.connectionType === 'qr_required' 
              ? 'qr_required' 
              : 'saved_session'; // Connected from saved session
            
            const connectionData = {
              sock,
              connected: true,
              connecting: false,
              qrCode: null,
              sessionId: sessionId || 'default',
              sessionName: sessionId ? `Session ${sessionId}` : 'Default Session',
              isDefault: !sessionId || sessionId === 'default',
              connectionType: connectionType
            };
            console.log(`🔗 Setting connected connection data:`, {
              userId,
              sessionId: sessionId || 'default',
              connected: true,
              hasSocket: !!sock,
              socketReady: sock?.ws?.readyState === 1,
              connectionType: connectionType,
              userInfo: sock?.user ? {
                id: sock.user.id,
                name: sock.user.name
              } : null
            });
            setConnection(userId, sessionId || 'default', connectionData);
            
            console.log(`🔍 Connected for user ${userId}`);
            
            // Add to 24/7 persistence manager immediately when connection is established
            const connectedStatusData = {
              userId,
              sessionId: sessionId || 'default',
              status: 'connected',
              connectionId,
              startTime: new Date().toISOString(),
              reconnectAttempts: 0
            };
            connectionPersistenceManager.addConnection(userId, sessionId || 'default', connectedStatusData);
            console.log(`🔄 Added to persistence manager for user ${userId}`);
            
            // Update Supabase
            try {
              await supabase
                .from('whatsapp_sessions')
                .upsert([{
                  session_id: sessionId || userId,
                  user_id: userId,
                  status: 'connected',
                  last_activity: new Date().toISOString(),
                  session_data: JSON.stringify({ connected: true, timestamp: new Date() })
                }]);
              console.log(`✅ Supabase updated for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
            } catch (error) {
              console.error(`❌ Error updating Supabase for user ${userId}${sessionId ? `, session: ${sessionId}` : ''}:`, error);
            }
          } else {
            console.log(`⚠️ WebSocket not ready yet for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
            console.log(`📊 Socket state:`, {
              ws: sock?.ws?.readyState,
              conn: sock?.conn?.readyState,
              connection: sock?.connection?.readyState,
              socket: sock?.socket?.readyState
            });
            // Set as connecting until WebSocket is ready
            setConnection(userId, sessionId || 'default', {
              sock,
              connected: false,
              connecting: true,
              qrCode: null,
              sessionId: sessionId || 'default',
              sessionName: sessionId ? `Session ${sessionId}` : 'Default Session',
              isDefault: !sessionId || sessionId === 'default'
            });
          }
        }, 2000); // Wait 2 seconds for WebSocket initialization
      }
    });

    sock.ev.on('creds.update', saveCreds);
    
    // Add error handling for the socket
    sock.ev.on('error', (error) => {
      dbLogger.error('socket', `WhatsApp socket error for user ${userId}: ${error.message}`, {
        connectionId,
        userId,
        sessionId: sessionId || 'default',
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }, userId, sessionId);
    });

    // Add message listener for location handling
    sock.ev.on('messages.upsert', async (event) => {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const messageStartTime = Date.now();
      
      try {
        dbLogger.info('message', `Message event received for user ${userId}: ${event.messages?.length || 0} messages`, {
          connectionId,
          messageId,
          userId,
          sessionId: sessionId || 'default',
          messageCount: event.messages?.length || 0,
          eventType: event.type,
          timestamp: new Date().toISOString()
        }, userId, sessionId);
        
        for (const message of event.messages) {
          const individualMessageId = `${messageId}_${event.messages.indexOf(message)}`;
          
          // // Skip if message is from self
          // if (message.key.fromMe) continue;
          
          dbLogger.debug('message', `Processing message for user ${userId}`, {
            connectionId,
            messageId: individualMessageId,
            userId,
            sessionId: sessionId || 'default',
            messageType: message.message?.conversation ? 'text' : Object.keys(message.message || {}).join(', '),
            from: message.key.remoteJid,
            fromMe: message.key.fromMe,
            timestamp: message.messageTimestamp,
            messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
            hasLocation: !!(message.message?.locationMessage || message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.locationMessage),
            messageKeys: Object.keys(message.message || {}),
            processingStartTime: new Date().toISOString()
          }, userId, sessionId);

          // Check if message is a location or has quoted location
          let locationData = null;

          // Check direct location message
          if (message.message?.locationMessage) {
            locationData = message.message.locationMessage;
            dbLogger.info('location', `Direct location received for user ${userId}`, {
              connectionId,
              messageId: individualMessageId,
              userId,
              sessionId: sessionId || 'default',
              latitude: locationData.degreesLatitude,
              longitude: locationData.degreesLongitude,
              name: locationData.name,
              address: locationData.address,
              accuracy: locationData.accuracyInMeters,
              speed: locationData.speedInMps,
              degreesClockwiseFromMagneticNorth: locationData.degreesClockwiseFromMagneticNorth,
              timestamp: new Date().toISOString()
            }, userId, sessionId);
          }
          // Check quoted message for location
          else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.locationMessage) {
            locationData = message.message.extendedTextMessage.contextInfo.quotedMessage.locationMessage;
            dbLogger.info('location', `Quoted location received for user ${userId}`, {
              connectionId,
              messageId: individualMessageId,
              userId,
              sessionId: sessionId || 'default',
              latitude: locationData.degreesLatitude,
              longitude: locationData.degreesLongitude,
              name: locationData.name,
              address: locationData.address,
              accuracy: locationData.accuracyInMeters,
              speed: locationData.speedInMps,
              degreesClockwiseFromMagneticNorth: locationData.degreesClockwiseFromMagneticNorth,
              timestamp: new Date().toISOString()
            }, userId, sessionId);
          }

          // If we have location data, process it
          if (locationData) {
            const locationProcessingId = `${individualMessageId}_loc`;
            const locationStartTime = Date.now();
            
            try {
              dbLogger.info('location', `Starting location processing for user ${userId}`, { connectionId, messageId: locationProcessingId }, userId, sessionId);
              
              // Get contact information
              const contactJid = message.key.remoteJid;
              const whatsappPhoneNumber = contactJid.replace('@s.whatsapp.net', '');
              
              // Convert WhatsApp phone number to Israeli local format
              const phoneNumber = convertWhatsAppPhoneToLocal(whatsappPhoneNumber);
              
              // Try to get contact name from message
              let contactName = 'Unknown Contact';
              if (message.pushName) {
                contactName = message.pushName;
              } else if (locationData.name) {
                contactName = locationData.name;
              }

              dbLogger.info('location', `Processing location for contact: ${contactName}`, {
                connectionId,
                messageId: locationProcessingId,
                userId,
                sessionId: sessionId || 'default',
                whatsappPhoneNumber,
                convertedPhoneNumber: phoneNumber,
                contactName,
                timestamp: new Date().toISOString()
              }, userId, sessionId);

              // Check if customer exists by phone number (try both formats)
              dbLogger.debug('location', `Searching for customer with phone numbers: ${phoneNumber}, ${whatsappPhoneNumber}`, { connectionId, messageId: locationProcessingId }, userId, sessionId);
              
              // Normalize phone numbers for comparison
              const normalizedWhatsAppPhone = normalizePhoneNumber(whatsappPhoneNumber);
              const normalizedLocalPhone = normalizePhoneNumber(phoneNumber);
              
              dbLogger.debug('location', `Normalized phone numbers`, {
                connectionId,
                messageId: locationProcessingId,
                userId,
                sessionId: sessionId || 'default',
                normalizedWhatsAppPhone,
                normalizedLocalPhone,
                timestamp: new Date().toISOString()
              }, userId, sessionId);
              
              // First, let's get all locations for this user to debug
              dbLogger.debug('database', `Fetching all locations for user ${userId}`, { connectionId, messageId: locationProcessingId }, userId, sessionId);
              const { data: allLocations, error: allLocationsError } = await retryOperation(async () => {
                const { data, error } = await supabase
                  .from('locations')
                  .select('id, name, phone, phone2')
                  .eq('user_id', userId);

                if (error) {
                  throw new Error(`Database query error: ${error.message}`);
                }
                
                return { data, error };
              }, 3, 1000);

              if (allLocationsError) {
                dbLogger.error('database', `Error fetching all locations: ${allLocationsError.message}`, {
                  connectionId,
                  messageId: locationProcessingId,
                  userId,
                  sessionId: sessionId || 'default',
                  error: allLocationsError.message,
                  stack: allLocationsError.stack,
                  timestamp: new Date().toISOString()
                }, userId, sessionId);
                continue;
              }

              dbLogger.debug('database', `Total locations for user ${userId}: ${allLocations?.length || 0}`, {
                connectionId,
                messageId: locationProcessingId,
                userId,
                sessionId: sessionId || 'default',
                locationCount: allLocations?.length || 0,
                processingTime: Date.now() - locationStartTime,
                timestamp: new Date().toISOString()
              }, userId, sessionId);
              
              // Check for exact matches - find ALL matching locations
              let matchingLocations = [];
              if (allLocations && allLocations.length > 0) {
                dbLogger.debug('location', `Checking ${allLocations.length} locations for phone matches`, { connectionId, messageId: locationProcessingId }, userId, sessionId);
                
                for (const location of allLocations) {
                  const locationPhoneNormalized = normalizePhoneNumber(location.phone);
                  const locationPhone2Normalized = normalizePhoneNumber(location.phone2);
                  
                  dbLogger.debug('location', `Checking location: ${location.name}`, {
                    connectionId,
                    messageId: locationProcessingId,
                    userId,
                    sessionId: sessionId || 'default',
                    locationId: location.id,
                    locationName: location.name,
                    phone: location.phone,
                    phoneNormalized: locationPhoneNormalized,
                    phone2: location.phone2,
                    phone2Normalized: locationPhone2Normalized,
                    timestamp: new Date().toISOString()
                  }, userId, sessionId);
                  
                  const isMatch = locationPhoneNormalized === normalizedWhatsAppPhone || 
                                 locationPhoneNormalized === normalizedLocalPhone ||
                                 locationPhone2Normalized === normalizedWhatsAppPhone || 
                                 locationPhone2Normalized === normalizedLocalPhone;
                  
                  if (isMatch) {
                    dbLogger.info('location', `Found matching location: ${location.name} (ID: ${location.id})`, { connectionId, messageId: locationProcessingId, locationId: location.id }, userId, sessionId);
                    matchingLocations.push(location);
                  }
                }
              }

              if (matchingLocations.length === 0) {
                console.log(`❌ No matching locations found. Creating new one.`);
                
                // Additional check: try to find by exact phone number match before creating
                console.log(`🔍 Double-checking for exact phone matches...`);
                const exactMatches = allLocations.filter(location => 
                  location.phone === phoneNumber || 
                  location.phone === whatsappPhoneNumber ||
                  location.phone2 === phoneNumber || 
                  location.phone2 === whatsappPhoneNumber
                );
                
                if (exactMatches.length > 0) {
                  console.log(`⚠️  Found ${exactMatches.length} exact matches that were missed by normalization:`);
                  exactMatches.forEach(match => {
                    console.log(`     - ${match.name} (ID: ${match.id})`);
                  });
                  matchingLocations = exactMatches;
                } else {
                  console.log(`✅ Confirmed no existing locations found. Safe to create new one.`);
                }
              }

              const locationUpdateData = {
                longitude: locationData.degreesLongitude,
                latitude: locationData.degreesLatitude,
                user_id: userId,
                location_received: true,
                updated_at: new Date()
              };

              if (matchingLocations.length > 0) {
                // Update ALL matching locations
                console.log(`🔄 Updating ${matchingLocations.length} matching locations with location data`);
                
                let updatedCount = 0;
                let errorCount = 0;
                
                for (const location of matchingLocations) {
                  try {
                    console.log(`   Updating location: ${location.name} (ID: ${location.id})`);
                    
                    await retryOperation(async () => {
                      const { error: updateError } = await supabase
                        .from('locations')
                        .update(locationUpdateData)
                        .eq('id', location.id);

                      if (updateError) {
                        throw new Error(`Database update error: ${updateError.message}`);
                      }
                      
                      console.log(`✅ Successfully updated location: ${location.name}`);
                      updatedCount++;
                    }, 3, 1000);
                    
                  } catch (updateError) {
                    console.error(`❌ Failed to update location ${location.name} after retries:`, updateError.message);
                    errorCount++;
                  }
                }
                
                console.log(`📊 Update Summary: ${updatedCount} successful, ${errorCount} failed`);
              } else {
                // Create new location entry
                console.log(`🆕 Creating new location entry: ${contactName}`);
                const newLocationData = {
                  ...locationUpdateData,
                  name: contactName,
                  phone: phoneNumber, // This is now in Israeli local format (0567891234)
                  area: locationData.address || 'Unknown Area',
                  created_at: new Date()
                };

                await retryOperation(async () => {
                  const { error: insertError } = await supabase
                    .from('locations')
                    .insert([newLocationData]);

                  if (insertError) {
                    throw new Error(`Database insert error: ${insertError.message}`);
                  }
                  
                  console.log(`✅ Successfully created new location entry: ${contactName}`);
                }, 3, 1000);
              }

              // Log the location message to message history for each updated location
              if (matchingLocations.length > 0) {
                console.log(`📝 Logging location message to history for ${matchingLocations.length} locations`);
                
                for (const location of matchingLocations) {
                  try {
                    await supabase
                      .from('message_history')
                      .insert([{
                        user_id: userId,
                        customer_id: location.id, // Using location ID as customer_id for message history
                        message_text: `Location shared: ${locationData.name || 'Unknown location'} at ${locationData.degreesLatitude}, ${locationData.degreesLongitude}`,
                        status: 'received',
                        message_type: 'location'
                      }]);
                    console.log(`   ✅ Logged for location: ${location.name}`);
                  } catch (logError) {
                    console.error(`❌ Error logging for location ${location.name}:`, logError);
                  }
                }
              } else {
                // Log for new location
                await supabase
                  .from('message_history')
                  .insert([{
                    user_id: userId,
                    customer_id: null,
                    message_text: `Location shared: ${locationData.name || 'Unknown location'} at ${locationData.degreesLatitude}, ${locationData.degreesLongitude}`,
                    status: 'received',
                    message_type: 'location'
                  }]);
              }

              // Summary log
              if (matchingLocations.length > 0) {
                console.log(`📝 Summary: Updated ${matchingLocations.length} existing locations with location data`);
                matchingLocations.forEach(location => {
                  console.log(`   - ${location.name} (ID: ${location.id})`);
                });
              } else {
                console.log(`📝 Summary: Created new location entry "${contactName}" with phone ${phoneNumber} and location data`);
              }

            } catch (locationError) {
              console.error(`❌ Error processing location message:`, locationError);
            }
          }
        }
      } catch (error) {
        dbLogger.error('message', `Error in message listener for user ${userId}: ${error.message}`, {
          connectionId,
          messageId,
          userId,
          sessionId: sessionId || 'default',
          error: error.message,
          stack: error.stack,
          processingTime: Date.now() - messageStartTime,
          timestamp: new Date().toISOString()
        }, userId, sessionId);
      }
    });

    const totalConnectionTime = Date.now() - startTime;
    
    // Clean up connection lock on successful connection
    const successConnectionKey = `${userId}_${sessionId || 'default'}`;
    if (connectionLocks.has(successConnectionKey)) {
      connectionLocks.delete(successConnectionKey);
      dbLogger.info('connection', `Cleared connection lock for ${successConnectionKey} after successful connection`, { connectionId, connectionKey: successConnectionKey }, userId, sessionId);
    }
    
    dbLogger.info('connection', `WhatsApp connection setup completed for user: ${userId}`, {
      connectionId,
      userId,
      sessionId: sessionId || 'default',
      totalConnectionTime,
      timestamp: new Date().toISOString()
    }, userId, sessionId);
    return sock;
  } catch (error) {
    const totalConnectionTime = Date.now() - startTime;
    
    // Clean up connection lock
    const errorConnectionKey = `${userId}_${sessionId || 'default'}`;
    if (connectionLocks.has(errorConnectionKey)) {
      connectionLocks.delete(errorConnectionKey);
      dbLogger.info('connection', `Cleared connection lock for ${errorConnectionKey} due to error`, { connectionId, connectionKey: errorConnectionKey }, userId, sessionId);
    }
    
    dbLogger.error('connection', `Error connecting WhatsApp for user: ${userId} - ${error.message}`, {
      connectionId,
      userId,
      sessionId: sessionId || 'default',
      error: error.message,
      stack: error.stack,
      totalConnectionTime,
      timestamp: new Date().toISOString()
    }, userId, sessionId);
    throw error;
  }
}

// API Routes

// 0. Logging Management
app.get('/api/logs', async (req, res) => {
  try {
    const { level, category, userId, sessionId, limit = 100, startDate, endDate } = req.query;
    
    const filters = {};
    if (level) filters.level = level;
    if (category) filters.category = category;
    if (userId) filters.userId = userId;
    if (sessionId) filters.sessionId = sessionId;
    if (limit) filters.limit = parseInt(limit);
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const logs = await dbLogger.getLogs(filters);
    
    res.json({
      success: true,
      logs,
      count: logs.length,
      filters
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/logs/stats', async (req, res) => {
  try {
    const stats = await dbLogger.getLogStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching log stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/logs/cleanup', async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;
    const result = await dbLogger.cleanupOldLogs(retentionDays);
    
    res.json({
      success: result,
      message: result ? `Cleaned up logs older than ${retentionDays} days` : 'Failed to clean up logs'
    });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1. WhatsApp Connection Management
app.get('/api/whatsapp/status/:userId', async (req, res) => {
  const { userId } = req.params;
  const { sessionId } = req.query; // Optional session ID parameter
  
  console.log(`🔍 Checking status for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
  
  try {
    const connection = getConnection(userId, sessionId);
    if (connection) {
      // Socket status check - no verbose logging needed
      
      // Try different ways to check WebSocket state
      let wsReady = false;
      let wsState = 'unknown';
      
      if (connection.sock?.ws?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.ws.readyState === 1';
      } else if (connection.sock?.ws?.socket?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.ws.socket.readyState === 1';
      } else if (connection.sock?.conn?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.conn.readyState === 1';
      } else if (connection.sock?.connection?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.connection.readyState === 1';
      } else if (connection.sock?.socket?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.socket.readyState === 1';
      }
      
      console.log(`📊 WebSocket ready: ${wsReady} (${wsState})`);
      
      console.log(`📊 Connection state:`, {
        connected: connection.connected,
        connecting: connection.connecting,
        hasQR: !!connection.qrCode,
        hasSocket: !!connection.sock,
        socketState: wsState,
        wsReady: wsReady,
        sessionId: connection.sessionId,
        isDefault: connection.isDefault
      });
      
      res.json({
        connected: connection.connected && wsReady, // Only truly connected if WebSocket is ready
        connecting: connection.connecting,
        qrCode: connection.qrCode,
        socketState: wsState,
        wsReady: wsReady,
        session: {
          id: connection.sessionId,
          name: connection.sessionName,
          isDefault: connection.isDefault
        }
      });
    } else {
      console.log(`📊 Connection state: NOT FOUND`);
      res.json({
        connected: false,
        connecting: false,
        qrCode: null,
        socketState: 'not_found',
        wsReady: false,
        session: null
      });
    }
  } catch (error) {
    console.error(`❌ Error checking status for user ${userId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 1.1. Session-specific WhatsApp status endpoint
app.get('/api/whatsapp/status/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  console.log(`🔍 Checking status for user: ${userId}, session: ${sessionId}`);
  
  // Debug: Log connection status
  console.log(`🔍 Checking connections for user ${userId}`);
  
  try {
    const connection = getConnection(userId, sessionId);
    console.log(`🔍 Retrieved connection for session ${sessionId}:`, connection);
    
    if (connection) {
      // Check WebSocket state
      let wsReady = false;
      let wsState = 'unknown';
      
      if (connection.sock?.ws?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.ws.readyState === 1';
      } else if (connection.sock?.ws?.socket?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.ws.socket.readyState === 1';
      } else if (connection.sock?.conn?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.conn.readyState === 1';
      }
      
      res.json({
        connected: connection.connected && wsReady,
        connecting: connection.connecting,
        qrCode: connection.qrCode,
        socketState: wsState,
        wsReady: wsReady,
        connectionType: connection.connectionType || 'unknown',
        session: {
          id: connection.sessionId,
          name: connection.sessionName,
          isDefault: connection.isDefault
        }
      });
    } else {
      res.json({
        connected: false,
        connecting: false,
        qrCode: null,
        socketState: 'not_found',
        wsReady: false,
        session: null
      });
    }
  } catch (error) {
    console.error(`❌ Error checking status for user ${userId}, session ${sessionId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/whatsapp/connect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.body; // Get session ID from request body
    
    console.log(`🔗 Attempting to connect WhatsApp for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    
    // Check if there's an existing connection for this session
    const existingConnection = getConnection(userId, sessionId);
    if (existingConnection) {
      console.log(`📱 Existing connection found for user: ${userId}, session: ${sessionId}`);
      console.log(`📊 Connection state:`, {
        isConnected: existingConnection.connected,
        isConnecting: existingConnection.connecting,
        hasSocket: !!existingConnection.sock
      });
      
      // If already connected, return success
      if (existingConnection.connected) {
        console.log(`✅ User ${userId}, session ${sessionId} is already connected`);
        return res.json({ success: true, message: 'Already connected to WhatsApp' });
      }
      
      // If connecting, return success
      if (existingConnection.connecting) {
        console.log(`🔄 User ${userId}, session ${sessionId} is already connecting`);
        return res.json({ success: true, message: 'Already connecting to WhatsApp...' });
      }
      
      // If connection exists but not connected/connecting, clean it up
      console.log(`🧹 Cleaning up stale connection for user: ${userId}, session: ${sessionId}`);
      removeConnection(userId, sessionId);
    }

    console.log(`🚀 Starting new WhatsApp connection for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    await connectWhatsApp(userId, sessionId);
    res.json({ success: true, message: 'Connecting to WhatsApp...' });
  } catch (error) {
    console.error('Error connecting WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to connect' });
  }
});

// 1.2. Session-specific connect endpoint
app.post('/api/whatsapp/connect/:userId/:sessionId', async (req, res) => {
  const startTime = Date.now();
  let errorDetails = null;
  
  try {
    const { userId, sessionId } = req.params;
    
    // Validate parameters
    if (!userId || !sessionId) {
      errorDetails = { type: 'validation', message: 'Missing userId or sessionId' };
      console.error(`❌ Validation error: ${errorDetails.message}`, { userId, sessionId });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters',
        details: errorDetails.message 
      });
    }
    
    console.log(`🔗 Attempting to connect WhatsApp for user: ${userId}, session: ${sessionId}`);
    
    // Debug: Log all available connections for this user
    console.log(`🔍 Available connections for user ${userId}:`, getUserConnections(userId));
    console.log(`🔍 Current connections map:`, Array.from(connections.entries()));
    
    // Check if there's an existing connection for this session
    const existingConnection = getConnection(userId, sessionId);
    console.log(`🔍 Retrieved existing connection for session ${sessionId}:`, existingConnection);
    
    if (existingConnection) {
      console.log(`📱 Existing connection found for user: ${userId}, session: ${sessionId}`);
      console.log(`📊 Connection state:`, {
        isConnected: existingConnection.connected,
        isConnecting: existingConnection.connecting,
        hasSocket: !!existingConnection.sock
      });
      
      // If already connected, return success
      if (existingConnection.connected) {
        console.log(`✅ User ${userId}, session ${sessionId} is already connected`);
        return res.json({ success: true, message: 'Already connected to WhatsApp' });
      }
      
      // If connecting, return success
      if (existingConnection.connecting) {
        console.log(`🔄 User ${userId}, session ${sessionId} is already connecting`);
        return res.json({ success: true, message: 'Already connecting to WhatsApp...' });
      }
      
      // If connection exists but not connected/connecting, clean it up
      console.log(`🧹 Cleaning up stale connection for user: ${userId}, session: ${sessionId}`);
      removeConnection(userId, sessionId);
    }

    console.log(`🚀 Starting new WhatsApp connection for user: ${userId}, session: ${sessionId}`);
    
    // Call connectWhatsApp with detailed error handling
    try {
      await connectWhatsApp(userId, sessionId);
      console.log(`✅ WhatsApp connection initiated successfully for user: ${userId}, session: ${sessionId}`);
      res.json({ success: true, message: 'Connecting to WhatsApp...' });
    } catch (connectError) {
      errorDetails = { 
        type: 'connectWhatsApp', 
        message: connectError.message,
        stack: connectError.stack,
        userId,
        sessionId
      };
      console.error(`❌ connectWhatsApp error for user ${userId}, session ${sessionId}:`, errorDetails);
      throw connectError; // Re-throw to be caught by outer catch
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    errorDetails = errorDetails || { 
      type: 'general', 
      message: error.message,
      stack: error.stack,
      duration
    };
    
    console.error(`❌ WhatsApp connection error for user ${req.params?.userId}, session ${req.params?.sessionId}:`, {
      error: errorDetails,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Ensure response is sent only once
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to connect to WhatsApp',
        details: errorDetails.message,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }
  }
});

app.post('/api/whatsapp/disconnect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.body; // Get session ID from request body
    
    console.log(`🔌 Disconnecting WhatsApp for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    
    const connection = getConnection(userId, sessionId);
    
    if (connection && connection.sock) {
      console.log(`🔌 Logging out WhatsApp session for user: ${userId}, session: ${sessionId || 'default'}`);
      await connection.sock.logout();
      removeConnection(userId, sessionId);
      
      // Clean up session files after logout to allow fresh reconnection
      const sessionDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'sessions', userId, sessionId || 'default');
      try {
        if (fs.existsSync(sessionDir)) {
          console.log(`🧹 Cleaning up session files for user: ${userId}, session: ${sessionId || 'default'}`);
          // Remove all files in the session directory
          const files = fs.readdirSync(sessionDir);
          for (const file of files) {
            const filePath = path.join(sessionDir, file);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Removed file: ${file}`);
            }
          }
          console.log(`✅ Session files cleaned up for user: ${userId}, session: ${sessionId || 'default'}`);
        }
      } catch (cleanupError) {
        console.error(`❌ Error cleaning up session files for user ${userId}, session ${sessionId || 'default'}:`, cleanupError);
        // Don't throw error here, just log it
      }
    }

    // Update session status in Supabase instead of deleting
    if (sessionId) {
      await supabase
        .from('whatsapp_sessions')
        .update({ 
          status: 'disconnected',
          last_activity: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('user_id', userId);
    }

    res.json({ success: true, message: 'Disconnected from WhatsApp' });
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

// 1.3. Session-specific disconnect endpoint
app.post('/api/whatsapp/disconnect/:userId/:sessionId', async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    console.log(`🔌 Disconnecting WhatsApp for user: ${userId}, session: ${sessionId}`);
    
    const connection = getConnection(userId, sessionId);
    
    if (connection && connection.sock) {
      console.log(`🔌 Logging out WhatsApp session for user: ${userId}, session: ${sessionId}`);
      await connection.sock.logout();
      removeConnection(userId, sessionId);
      
      // Clean up session files after logout to allow fresh reconnection
      const sessionDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'sessions', userId, sessionId);
      try {
        if (fs.existsSync(sessionDir)) {
          console.log(`🧹 Cleaning up session files for user: ${userId}, session: ${sessionId}`);
          // Remove all files in the session directory
          const files = fs.readdirSync(sessionDir);
          for (const file of files) {
            const filePath = path.join(sessionDir, file);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Removed file: ${file}`);
            }
          }
          console.log(`✅ Session files cleaned up for user: ${userId}, session: ${sessionId}`);
        }
      } catch (cleanupError) {
        console.error(`❌ Error cleaning up session files for user ${userId}, session ${sessionId}:`, cleanupError);
        // Don't throw error here, just log it
      }
    }

    // Update session status in Supabase
    await supabase
      .from('whatsapp_sessions')
      .update({ 
        status: 'disconnected',
        last_activity: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    res.json({ success: true, message: 'Disconnected from WhatsApp' });
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

app.post('/api/whatsapp/delete-session/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🗑️ Deleting session for user: ${userId}`);
    
    // Disconnect if connected
    const connection = connections.get(userId);
    if (connection && connection.sock) {
      try {
        await connection.sock.logout();
        console.log(`✅ Logged out from WhatsApp for user: ${userId}`);
      } catch (logoutError) {
        console.log(`⚠️ Logout error (continuing):`, logoutError.message);
      }
      connections.delete(userId);
    }

    // Remove from Supabase
    await supabase
      .from('whatsapp_sessions')
      .delete()
      .eq('session_id', userId);

    // Delete session files
    const sessionDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'sessions', userId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`🗂️ Deleted session directory for user: ${userId}`);
    }

    console.log(`✅ Session completely deleted for user: ${userId}`);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

// Manual QR code generation endpoint
app.post('/api/whatsapp/generate-qr/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📱 Manual QR generation requested for user: ${userId}`);
    
    // Check if there's an existing connection
    let connection = connections.get(userId);
    
    if (!connection) {
      console.log(`🔄 No connection found, creating new one for user: ${userId}`);
      await connectWhatsApp(userId);
      connection = connections.get(userId);
    }
    
    if (!connection) {
      return res.status(500).json({ success: false, error: 'Failed to create connection' });
    }
    
    // Wait a bit for QR code to be generated
    let attempts = 0;
    const maxAttempts = 15; // Increased max attempts
    
    while (attempts < maxAttempts) {
      connection = connections.get(userId);
      if (connection && connection.qrCode) {
        console.log(`✅ QR code found for user: ${userId}`);
        return res.json({
          success: true,
          qrCode: connection.qrCode,
          message: 'QR code generated successfully'
        });
      }
      
      console.log(`⏳ Waiting for QR code... (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;
    }
    
    console.log(`❌ QR code generation timeout for user: ${userId}`);
    res.status(408).json({ success: false, error: 'QR code generation timeout' });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// Clean session endpoint to handle corrupted sessions
app.post('/api/whatsapp/clean-session/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🧹 Cleaning session for user: ${userId}`);
    
    // Disconnect if connected
    const connection = connections.get(userId);
    if (connection && connection.sock) {
      try {
        await connection.sock.logout();
        console.log(`✅ Logged out from WhatsApp for user: ${userId}`);
      } catch (logoutError) {
        console.log(`⚠️ Logout error (continuing):`, logoutError.message);
      }
      connections.delete(userId);
    }

    // Remove from Supabase
    await supabase
      .from('whatsapp_sessions')
      .delete()
      .eq('session_id', userId);

    // Delete session files completely
    const sessionDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'sessions', userId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`🗂️ Deleted session directory for user: ${userId}`);
    }

    // Wait a moment before creating new connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create fresh connection
    console.log(`🔄 Creating fresh connection for user: ${userId}`);
    await connectWhatsApp(userId);

    console.log(`✅ Session cleaned and fresh connection created for user: ${userId}`);
    res.json({ success: true, message: 'Session cleaned successfully' });
  } catch (error) {
    console.error('Error cleaning session:', error);
    res.status(500).json({ success: false, error: 'Failed to clean session' });
  }
});

// 2. Customer Management
app.get('/api/customers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      customers: customers || [],
      totalCustomers: customers?.length || 0
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, area, packagePrice, packageId, userId } = req.body;
    
    if (!name || !phone || !userId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        user_id: userId,
        name,
        phone,
        area: area || '',
        package_price: packagePrice || 0,
        package_id: packageId || ''
      }])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      customer: data[0]
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, area, packagePrice, packageId } = req.body;
    
    const { data, error } = await supabase
      .from('customers')
      .update({
        name,
        phone,
        area,
        package_price: packagePrice,
        package_id: packageId,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      customer: data[0]
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: 'Failed to update customer' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, error: 'Failed to delete customer' });
  }
});

// 3. Message Templates
app.get('/api/templates/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: templates, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      templates: templates || []
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const { name, template, userId } = req.body;
    
    if (!name || !template || !userId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('message_templates')
      .insert([{
        user_id: userId,
        name,
        template
      }])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      template: data[0]
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

// 4. Send Messages
app.post('/api/messages/send', async (req, res) => {
  try {
    const { userId, messageTemplate, customerIds, speedDelay = 35, sessionId } = req.body;
    
    if (!userId || !messageTemplate || !customerIds || !customerIds.length) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Time restrictions are now handled at the UI level, not API level

    console.log(`🚀 Starting message sending for user ${userId}${sessionId ? `, session: ${sessionId}` : ''} with speed delay: ${speedDelay} seconds`);
    console.log(`🔍 Session: ${sessionId || 'default'}`);
    
    const connection = getConnection(userId, sessionId);
    console.log(`🔍 Connection status: ${connection ? (connection.connected ? 'Connected' : 'Disconnected') : 'Not found'}`);
    
    if (!connection || !connection.connected) {
      return res.status(400).json({ 
        success: false, 
        error: 'WhatsApp not connected',
        debug: {
          requestedUserId: userId,
          requestedSessionId: sessionId,
          availableConnections: getUserConnections(userId),
          connectionExists: !!connection,
          connectionStatus: connection ? {
            connected: connection.connected,
            hasSocket: !!connection.sock,
            sessionId: connection.sessionId
          } : 'null'
        }
      });
    }

    // Get customers
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .in('id', customerIds);

    if (error) throw error;

    const results = [];
    
    // Send update message to the specified number (972526686285)
    try {
      const updateMessage = `🚀 Starting to send messages to ${customers.length} customers\n\nSpeed: ${speedDelay === 0 ? 'Instant' : speedDelay <= 25 ? 'Fast' : speedDelay <= 35 ? 'Medium' : 'Slow'}\nDelay: ${speedDelay} seconds\nEstimated time: ${Math.floor((customers.length * speedDelay) / 60)}m ${(customers.length * speedDelay) % 60}s`;
      
      const updateJid = '972526686285@s.whatsapp.net';
      await connection.sock.sendMessage(updateJid, { text: updateMessage });
      console.log(`✅ Update message sent to ${updateJid}`);
    } catch (updateError) {
      console.error(`⚠️ Failed to send update message:`, updateError.message);
    }
    
    for (const customer of customers) {
      try {
        // Replace placeholders in message
        let personalizedMessage = messageTemplate
          .replace(/{name}/g, customer.name)
          .replace(/{phone}/g, customer.phone)
          .replace(/{area}/g, customer.area || '')
          .replace(/{packagePrice}/g, customer.package_price || '')
          .replace(/{packageId}/g, customer.package_id || '');

        // Format phone number for WhatsApp
        let phoneNumber = customer.phone;
        if (!phoneNumber.startsWith('+')) {
          if (phoneNumber.startsWith('972')) {
            phoneNumber = '+' + phoneNumber;
          } else if (phoneNumber.startsWith('0')) {
            phoneNumber = '+972' + phoneNumber.substring(1);
          } else {
            phoneNumber = '+972' + phoneNumber;
          }
        }
        
        console.log(`📱 Sending to ${customer.name} at ${phoneNumber}`);
        console.log(`📱 Connection: ${connection.connected ? 'Connected' : 'Disconnected'}`);
        
        // Validate phone number format
        if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
          throw new Error(`Invalid phone number format: ${phoneNumber}`);
        }
        
        // Check if connection is ready
        if (!connection.sock) {
          throw new Error('WhatsApp connection not established');
        }
        
        // Check if connection is actually connected
        if (!connection.connected) {
          throw new Error('WhatsApp not connected. Please connect first.');
        }
        
        // Connection state verified
        console.log(`📱 Connection: ${connection.connected ? 'Connected' : 'Disconnected'}`);
        
        // Socket state verified
        
        // More robust socket state check
        if (!connection.sock) {
          throw new Error('Socket not available');
        }
        
        // Check if socket has a connection method
        if (typeof connection.sock.sendMessage !== 'function') {
          throw new Error('Socket sendMessage method not available');
        }
        
        // Wait a bit to ensure connection is stable
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Send message with error handling
        try {
          console.log(`📤 Attempting to send message to ${phoneNumber}...`);
          
          // Format phone number for WhatsApp
          let formattedPhone = phoneNumber;
          
          // Remove any non-digit characters
          formattedPhone = formattedPhone.replace(/\D/g, '');
          
          // Remove country code if it starts with 00
          if (formattedPhone.startsWith('00')) {
            formattedPhone = formattedPhone.substring(2);
          }
          
          // Remove + if present
          if (formattedPhone.startsWith('+')) {
            formattedPhone = formattedPhone.substring(1);
          }
          
          // Ensure it's a valid number
          if (formattedPhone.length < 10) {
            throw new Error(`Invalid phone number: ${phoneNumber}`);
          }
          
          // Create JID
          const jid = `${formattedPhone}@s.whatsapp.net`;
          console.log(`📱 Original phone: ${phoneNumber}, Formatted: ${formattedPhone}, JID: ${jid}`);
          
          await connection.sock.sendMessage(jid, { text: personalizedMessage });
          console.log(`✅ Message sent successfully to ${customer.name}`);
          
          // Track message usage for time restrictions (only for first successful message)
          if (i === 0) {
            try {
              await supabase.rpc('track_message_usage', { user_id: userId });
              console.log(`📊 Message usage tracked for user ${userId}`);
            } catch (trackError) {
              console.error(`⚠️ Failed to track message usage:`, trackError.message);
            }
          }
        } catch (sendError) {
          console.error(`❌ Send error for ${customer.name}:`, sendError.message);
          console.error(`❌ Full error:`, sendError);
          throw sendError;
        }
        
        // Log to message history
        await supabase
          .from('message_history')
          .insert([{
            user_id: userId,
            customer_id: customer.id,
            message_text: personalizedMessage,
            status: 'sent'
          }]);

        results.push({
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          status: 'sent',
          message: personalizedMessage
        });
        
        // Add speed delay between messages (except for the last message)
        if (speedDelay > 0 && customers.indexOf(customer) < customers.length - 1) {
          console.log(`⏳ Waiting ${speedDelay} seconds before next message...`);
          await new Promise(resolve => setTimeout(resolve, speedDelay * 1000));
        }
      } catch (error) {
        console.error(`Error sending message to ${customer.name}:`, error);
        results.push({
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          status: 'failed',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        totalSent: results.filter(r => r.status === 'sent').length,
        totalFailed: results.filter(r => r.status === 'failed').length
      }
    });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4.1. Send Messages with Background Processing
app.post('/api/messages/send-background', async (req, res) => {
  try {
    const { userId, messageTemplate, processedMessages, customerIds, speedDelay = 35, sessionId } = req.body;
    
    if (!userId || (!messageTemplate && !processedMessages) || !customerIds || !customerIds.length) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    console.log(`🚀 Starting background message sending for user ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    console.log(`🔍 Using processed messages: ${!!processedMessages}`);
    console.log(`🔍 Message template: ${messageTemplate ? 'Yes' : 'No'}`);
    console.log(`🔍 Processed messages count: ${processedMessages ? processedMessages.length : 0}`);

    console.log(`🚀 Starting background message sending for user ${userId}${sessionId ? `, session: ${sessionId}` : ''} with speed delay: ${speedDelay} seconds`);
    console.log(`🔍 Session: ${sessionId || 'default'}`);
    
    const connection = getConnection(userId, sessionId);
    console.log(`🔍 Connection status: ${connection ? (connection.connected ? 'Connected' : 'Disconnected') : 'Not found'}`);
    
    if (!connection || !connection.connected) {
      return res.status(400).json({ 
        success: false, 
        error: 'WhatsApp not connected',
        debug: {
          requestedUserId: userId,
          requestedSessionId: sessionId,
          availableConnections: getUserConnections(userId),
          connectionExists: !!connection,
          connectionStatus: connection ? {
            connected: connection.connected,
            connecting: connection.connecting,
            hasSocket: !!connection.sock,
            sessionId: connection.sessionId
          } : 'null'
        }
      });
    }

    // Get customers
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .in('id', customerIds);

    if (error) throw error;

    // Send update message to the specified number (972526686285)
    try {
      const updateMessage = `🚀 Starting background message sending to ${customers.length} customers\n\nSpeed: ${speedDelay === 0 ? 'Instant' : speedDelay <= 25 ? 'Fast' : speedDelay <= 35 ? 'Medium' : 'Slow'}\nDelay: ${speedDelay} seconds\nEstimated time: ${Math.floor((customers.length * speedDelay) / 60)}m ${(customers.length * speedDelay) % 60}s\n\nMessages will continue even if app is closed`;
      
      const updateJid = '972526686285@s.whatsapp.net';
      await connection.sock.sendMessage(updateJid, { text: updateMessage });
      console.log(`✅ Background update message sent to ${updateJid}`);
    } catch (updateError) {
      console.error(`⚠️ Failed to send background update message:`, updateError.message);
    }

    // Start background processing
    const processId = `bg_${userId}_${Date.now()}`;
    
    // Store background process info
    backgroundProcesses.set(processId, {
      userId,
      status: 'running',
      total: customers.length,
      completed: 0,
      failed: 0,
      startTime: new Date(),
      speedDelay
    });

    // Process messages in background
    if (processedMessages) {
      // Use processed messages (new format)
      processMessagesInBackgroundWithProcessed(processId, customers, processedMessages, userId, speedDelay, connection);
    } else {
      // Use template (old format - for backward compatibility)
      processMessagesInBackground(processId, customers, messageTemplate, userId, speedDelay, connection);
    }

    res.json({
      success: true,
      data: {
        message: 'Background message processing started',
        processId,
        totalCustomers: customers.length,
        estimatedTime: `${Math.floor((customers.length * speedDelay) / 60)}m ${(customers.length * speedDelay) % 60}s`
      }
    });

  } catch (error) {
    console.error('Error starting background message sending:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4.2. Check Background Process Status
app.get('/api/messages/background-status/:processId', async (req, res) => {
  try {
    const { processId } = req.params;
    const process = backgroundProcesses.get(processId);
    
    if (!process) {
      return res.status(404).json({ success: false, error: 'Process not found' });
    }
    
    res.json({
      success: true,
      process: {
        id: processId,
        status: process.status,
        total: process.total,
        completed: process.completed,
        failed: process.failed,
        startTime: process.startTime,
        endTime: process.endTime,
        speedDelay: process.speedDelay
      }
    });
  } catch (error) {
    console.error('Error checking background process status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4.3. Check Active Connections (Debug endpoint)
app.get('/api/debug/connections', async (req, res) => {
  try {
    const activeConnections = {};
    
    for (const [userId, connection] of connections.entries()) {
      activeConnections[userId] = {
        connected: connection.connected,
        connecting: connection.connecting,
        hasSocket: !!connection.sock,
        socketState: connection.sock?.ws?.readyState,
        connectionTime: connection.connectionTime || 'unknown'
      };
    }
    
    res.json({
      success: true,
      totalConnections: connections.size,
      activeConnections,
      connectionKeys: Array.from(connections.keys())
    });
  } catch (error) {
    console.error('Error checking connections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4.4. Cancel Background Process
app.post('/api/messages/background-cancel/:processId', async (req, res) => {
  try {
    const { processId } = req.params;
    const process = backgroundProcesses.get(processId);
    
    if (!process) {
      return res.status(404).json({ success: false, error: 'Process not found' });
    }
    
    if (process.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Process already completed' });
    }
    
    process.status = 'cancelled';
    
    res.json({
      success: true,
      message: 'Background process cancelled',
      processId
    });
  } catch (error) {
    console.error('Error cancelling background process:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4.5. Time Restriction Management
app.get('/api/time-restrictions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('time_restriction_enabled, time_restriction_start, time_restriction_end, time_restriction_timezone, last_message_sent_during_window, daily_usage_tracked')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Check current restriction status
    const { data: canSend, error: canSendError } = await supabase
      .rpc('can_send_messages', { user_id: userId });

    if (canSendError) throw canSendError;

    const currentTime = new Date().toLocaleTimeString('en-US', { 
      timeZone: profile?.time_restriction_timezone || 'Asia/Jerusalem',
      hour12: false 
    });

    res.json({
      success: true,
      data: {
        ...profile,
        canSendMessages: canSend,
        currentTime,
        hasUsedMessagingToday: profile?.daily_usage_tracked ? new Date().toDateString() === new Date(profile.daily_usage_tracked).toDateString() : false
      }
    });
  } catch (error) {
    console.error('Error fetching time restrictions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/time-restrictions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { time_restriction_enabled, time_restriction_start, time_restriction_end, time_restriction_timezone } = req.body;
    
    const { data, error } = await supabase
      .from('profiles')
      .update({
        time_restriction_enabled,
        time_restriction_start,
        time_restriction_end,
        time_restriction_timezone
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Time restrictions updated successfully'
    });
  } catch (error) {
    console.error('Error updating time restrictions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// 5. Send Single Message
app.post('/api/messages/send-single', async (req, res) => {
  try {
    const { userId, phoneNumber, message, sessionId } = req.body;
    
    console.log(`📤 Send single message request:`, {
      userId,
      phoneNumber,
      messageLength: message?.length,
      messagePreview: message?.substring(0, 100) + '...',
      sessionId: sessionId || 'default'
    });
    
    if (!userId || !phoneNumber || !message) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Time restrictions are now handled at the UI level, not API level

    console.log(`📤 Send single message request for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    console.log(`📱 Available connections for user ${userId}: [ ${getUserConnections(userId).join(', ')} ]`);
    console.log(`📊 Requested sessionId: ${sessionId || 'default'}`);
    
    const connection = getConnection(userId, sessionId);
    console.log(`🔗 Connection found:`, connection ? 'YES' : 'NO');
    
    if (connection) {
      console.log(`📊 Connection state:`, {
        connected: connection.connected,
        connecting: connection.connecting,
        hasSocket: !!connection.sock,
        socketState: connection.sock?.ws?.readyState,
        connectionKeys: Object.keys(connection),
        sessionId: connection.sessionId
      });
    } else {
      console.log(`❌ No connection object found for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
    }
    
    if (!connection || !connection.connected) {
      return res.status(400).json({ 
        success: false, 
        error: 'WhatsApp not connected',
        debug: {
          requestedUserId: userId,
          requestedSessionId: sessionId,
          availableConnections: getUserConnections(userId),
          connectionExists: !!connection
        }
      });
    }

    // Perform connection health check
    const isHealthy = await checkConnectionHealth(connection);
    if (!isHealthy) {
      return res.status(400).json({ success: false, error: 'WhatsApp connection not healthy' });
    }

    console.log(`📱 Sending single message to ${phoneNumber}`);
    console.log(`🔗 Connection status:`, connection.connected);
    
    // Format phone number for WhatsApp
    let formattedPhone = phoneNumber;
    
    // Remove any non-digit characters
    formattedPhone = formattedPhone.replace(/\D/g, '');
    
    // Handle Israeli phone numbers that start with 0
    if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
      // Convert 0501234567 to 972501234567
      formattedPhone = '972' + formattedPhone.substring(1);
    }
    
    // Remove country code if it starts with 00
    if (formattedPhone.startsWith('00')) {
      formattedPhone = formattedPhone.substring(2);
    }
    
    // Remove + if present
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }
    
    // Ensure it's a valid number
    if (formattedPhone.length < 10) {
      throw new Error(`Invalid phone number: ${phoneNumber}`);
    }
    
    // Create JID
    const jid = `${formattedPhone}@s.whatsapp.net`;
    console.log(`📱 Original phone: ${phoneNumber}, Formatted: ${formattedPhone}, JID: ${jid}`);
    
    // Check if socket has a connection method
    if (!connection.sock || typeof connection.sock.sendMessage !== 'function') {
      throw new Error('Socket sendMessage method not available');
    }
    
    console.log(`🔍 Socket details:`, {
      hasSock: !!connection.sock,
      hasWs: !!(connection.sock && connection.sock.ws),
      hasWsSocket: !!(connection.sock && connection.sock.ws && connection.sock.ws.socket),
      hasConn: !!(connection.sock && connection.sock.conn),
      hasConnection: !!(connection.sock && connection.sock.connection),
      hasSocket: !!(connection.sock && connection.sock.socket),
      wsReadyState: connection.sock?.ws?.readyState,
      wsSocketReadyState: connection.sock?.ws?.socket?.readyState,
      connReadyState: connection.sock?.conn?.readyState,
      connectionReadyState: connection.sock?.connection?.readyState,
      socketReadyState: connection.sock?.socket?.readyState,
      sockKeys: connection.sock ? Object.keys(connection.sock) : []
    });
    
    try {
      // Check if WebSocket is ready using comprehensive detection
      let wsReady = false;
      let wsState = 'unknown';
      
      if (connection.sock?.ws?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.ws.readyState === 1';
      } else if (connection.sock?.conn?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.conn.readyState === 1';
      } else if (connection.sock?.connection?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.connection.readyState === 1';
      } else if (connection.sock?.socket?.readyState === 1) {
        wsReady = true;
        wsState = 'sock.socket.readyState === 1';
      }
      
      if (!wsReady) {
        console.log(`⚠️ WebSocket not ready. State: ${wsState}`);
        console.log(`🔍 Socket details:`, {
          hasSock: !!connection.sock,
          hasWs: !!(connection.sock && connection.sock.ws),
          hasConn: !!(connection.sock && connection.sock.conn),
          hasConnection: !!(connection.sock && connection.sock.connection),
          hasSocket: !!(connection.sock && connection.sock.socket),
          wsReadyState: connection.sock?.ws?.readyState,
          connReadyState: connection.sock?.conn?.readyState,
          connectionReadyState: connection.sock?.connection?.readyState,
          socketReadyState: connection.sock?.socket?.readyState,
          sockKeys: connection.sock ? Object.keys(connection.sock) : []
        });
        
        // Try to wait for connection to be ready
        console.log(`⏳ Waiting for WebSocket to be ready...`);
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          
          // Re-check WebSocket state
          if (connection.sock?.ws?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.ws.readyState === 1';
            break;
          } else if (connection.sock?.ws?.socket?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.ws.socket.readyState === 1';
            break;
          } else if (connection.sock?.conn?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.conn.readyState === 1';
            break;
          } else if (connection.sock?.connection?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.connection.readyState === 1';
            break;
          } else if (connection.sock?.socket?.readyState === 1) {
            wsReady = true;
            wsState = 'sock.socket.readyState === 1';
            break;
          }
          
          console.log(`⏳ Attempt ${attempts}/${maxAttempts}: WebSocket state = ${wsState}`);
        }
        
        if (!wsReady) {
          throw new Error(`WebSocket connection not ready after waiting. State: ${wsState}`);
        }
      }
      
      console.log(`✅ WebSocket is ready: ${wsState}`);
      
      console.log(`📤 Attempting to send message to ${jid}...`);
      console.log(`📝 Message content:`, message);
      
      // Add timeout to sendMessage call
      const sendPromise = connection.sock.sendMessage(jid, { text: message });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Send message timeout')), 10000)
      );
      
      await Promise.race([sendPromise, timeoutPromise]);
      console.log(`✅ Single message sent successfully to ${phoneNumber}`);
      
      // Track message usage for time restrictions
      try {
        await supabase.rpc('track_message_usage', { user_id: userId });
        console.log(`📊 Message usage tracked for user ${userId}`);
      } catch (trackError) {
        console.error(`⚠️ Failed to track message usage:`, trackError.message);
      }
    } catch (sendError) {
      console.error(`❌ Send message error:`, sendError);
      console.error(`❌ Error details:`, {
        message: sendError.message,
        stack: sendError.stack,
        jid: jid,
        messageLength: message.length,
        wsReadyState: connection.sock?.ws?.readyState,
        wsState: wsState,
        wsReady: wsReady,
        phoneNumber: phoneNumber,
        formattedPhone: formattedPhone
      });
      throw sendError;
    }
    
    res.json({
      success: true,
      message: 'Message sent successfully',
      phoneNumber: phoneNumber,
      jid: jid
    });
  } catch (error) {
    console.error('Error sending single message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Debug Connection State
app.get('/api/whatsapp/debug/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 Debug request for user: ${userId}`);
    console.log(`📱 Current connections:`, Array.from(connections.keys()));
    console.log(`📊 Connections Map size:`, connections.size);
    
    const connection = connections.get(userId);
    console.log(`🔗 Connection found:`, connection ? 'YES' : 'NO');
    
    if (connection) {
      console.log(`📊 Connection state:`, {
        connected: connection.connected,
        connecting: connection.connecting,
        hasQR: !!connection.qrCode,
        hasSocket: !!connection.sock,
        socketState: connection.sock?.ws?.readyState,
        connectionKeys: Object.keys(connection)
      });
    }
    
    res.json({
      success: true,
      userId,
      connectionsInMap: Array.from(connections.keys()),
      mapSize: connections.size,
      connectionFound: !!connection,
      connectionState: connection ? {
        connected: connection.connected,
        connecting: connection.connecting,
        hasSocket: !!connection.sock,
        socketState: connection.sock?.ws?.readyState
      } : null
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test locations table endpoint
app.get('/api/locations/test/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🧪 Testing locations table access for user: ${userId}`);
    
    // Test if locations table exists and is accessible
    const { data: locations, error: locationsError } = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .limit(5);
      
      if (error) {
        throw new Error(`Database query error: ${error.message}`);
      }
      
      return { data, error };
    }, 3, 1000);
    
    if (locationsError) {
      console.error('❌ Locations table error:', locationsError);
      return res.status(500).json({
        success: false,
        error: 'Locations table access failed',
        details: locationsError
      });
    }
    
    // Test if we can insert a test record
    const testData = {
      user_id: userId,
      name: 'Test Location',
      phone: '0501234567',
      shipment_id: 'test_' + Date.now(),
      package_id: 'test_package',
      area: 'Test Area'
    };
    
    const { data: insertedTest, error: insertError } = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('locations')
        .insert([testData])
        .select();
      
      if (error) {
        throw new Error(`Database insert error: ${error.message}`);
      }
      
      return { data, error };
    }, 3, 1000);
    
    if (insertError) {
      console.error('❌ Locations insert test failed:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Locations table insert test failed',
        details: insertError,
        existingLocations: locations
      });
    }
    
    // Clean up test record
    await retryOperation(async () => {
      const { error: deleteError } = await supabase
        .from('locations')
        .delete()
        .eq('id', insertedTest[0].id);
      
      if (deleteError) {
        throw new Error(`Database delete error: ${deleteError.message}`);
      }
    }, 3, 1000);
    
    res.json({
      success: true,
      message: 'Locations table is working correctly',
      existingLocations: locations,
      insertTest: 'Passed'
    });
    
  } catch (error) {
    console.error('❌ Locations test error:', error);
    res.status(500).json({
      success: false,
      error: 'Locations test failed',
      details: error.message
    });
  }
});

// 7. Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'WhatsApp Automation API is running',
    timestamp: new Date().toISOString()
  });
});

// 8. WhatsApp Connection Status Monitoring
app.get('/api/whatsapp/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.query;
    
    if (sessionId) {
      // Get specific session status
      const status = connectionPersistenceManager.getConnectionStatus(userId, sessionId);
      const connection = getConnection(userId, sessionId);
      
      res.json({
        success: true,
        data: {
          userId,
          sessionId,
          status,
          connected: connection?.connected || false,
          lastSeen: connection?.lastActivity,
          uptime: connection?.startTime ? Date.now() - connection.startTime.getTime() : 0
        }
      });
    } else {
      // Get all session statuses for user
      const statuses = connectionPersistenceManager.getUserConnectionStatuses(userId);
      const userConnections = getUserConnections(userId);
      
      res.json({
        success: true,
        data: {
          userId,
          sessions: statuses,
          totalSessions: Object.keys(statuses).length,
          activeSessions: Object.values(statuses).filter(s => s === 'connected').length,
          connections: userConnections
        }
      });
    }
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. WhatsApp Status Change WebSocket Endpoint
app.get('/api/whatsapp/status-stream/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.query;
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Send initial status
    const initialStatus = sessionId 
      ? connectionPersistenceManager.getConnectionStatus(userId, sessionId)
      : connectionPersistenceManager.getUserConnectionStatuses(userId);
    
    res.write(`data: ${JSON.stringify({
      type: 'status',
      userId,
      sessionId,
      status: initialStatus,
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // Add status change listener
    const statusListener = (targetUserId, targetSessionId, status) => {
      if (targetUserId === userId && (!sessionId || targetSessionId === sessionId)) {
        res.write(`data: ${JSON.stringify({
          type: 'status_change',
          userId: targetUserId,
          sessionId: targetSessionId,
          status,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    };
    
    if (sessionId) {
      connectionPersistenceManager.addStatusListener(userId, sessionId, statusListener);
    } else {
      // Add listener for all sessions of this user
      const userConnections = getUserConnections(userId);
      userConnections.forEach(conn => {
        connectionPersistenceManager.addStatusListener(userId, conn.sessionId, statusListener);
      });
    }
    
    // Clean up on disconnect
    req.on('close', () => {
      if (sessionId) {
        connectionPersistenceManager.removeStatusListener(userId, sessionId, statusListener);
      } else {
        const userConnections = getUserConnections(userId);
        userConnections.forEach(conn => {
          connectionPersistenceManager.removeStatusListener(userId, conn.sessionId, statusListener);
        });
      }
    });
    
  } catch (error) {
    console.error('Error setting up status stream:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Enhanced Status Endpoint - Returns current status of all connections
app.get('/api/whatsapp/status-all/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`📊 Getting status for all connections of user: ${userId}`);
    
    // Debug: Check what connections exist
    console.log(`🔍 Debug - connections map has user: ${connections.has(userId)}`);
    if (connections.has(userId)) {
      const userConnections = connections.get(userId);
      console.log(`🔍 Debug - user connections:`, Array.from(userConnections.keys()));
      userConnections.forEach((conn, sessionId) => {
        console.log(`🔍 Debug - session ${sessionId}:`, {
          connected: conn.connected,
          connecting: conn.connecting,
          hasQR: !!conn.qrCode,
          connectionType: conn.connectionType
        });
      });
    }
    
    const statusData = connectionPersistenceManager.getUserConnectionStatuses(userId);
    console.log(`🔍 Debug - statusData from persistence manager:`, statusData);
    
    // Get full connection data including QR codes - use actual connection status, not persistence manager status
    const fullConnectionData = {};
    if (connections.has(userId)) {
      const userConnections = connections.get(userId);
      userConnections.forEach((conn, sessionId) => {
        // Determine the actual status based on connection data, not persistence manager
        let actualStatus = 'disconnected';
        if (conn.connected) {
          actualStatus = 'connected';
        } else if (conn.connecting) {
          if (conn.qrCode) {
            actualStatus = 'qr_required';
          } else {
            actualStatus = 'connecting';
          }
        }
        
        fullConnectionData[sessionId] = {
          status: actualStatus, // Use actual connection status, not persistence manager status
          qrCode: conn.qrCode || null,
          connected: conn.connected || false,
          connecting: conn.connecting || false,
          connectionType: conn.connectionType || 'unknown'
        };
      });
    }
    
    res.json({
      success: true,
      userId,
      timestamp: new Date().toISOString(),
      sessions: fullConnectionData
    });
  } catch (error) {
    console.error(`❌ Error getting status for user ${req.params.userId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 11. Initiate Connection Endpoint - App only initiates, server maintains
app.post('/api/whatsapp/initiate/:userId/:sessionId?', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessionId = req.params.sessionId || 'default';
    
    console.log(`🚀 App initiating connection for user: ${userId}, session: ${sessionId}`);
    
    // Check if connection already exists and is active
    const existingConnection = connectionPersistenceManager.getConnectionStatus(userId, sessionId);
    if (existingConnection && existingConnection.status === 'connected') {
      console.log(`✅ Connection already active for user: ${userId}, session: ${sessionId}`);
      return res.json({
        success: true,
        message: 'Connection already active',
        status: 'connected',
        userId,
        sessionId
      });
    }
    
    // Initiate connection (server will maintain it)
    console.log(`🔧 About to call connectWhatsApp for user: ${userId}, session: ${sessionId}`);
    await connectWhatsApp(userId, sessionId);
    console.log(`✅ connectWhatsApp completed for user: ${userId}, session: ${sessionId}`);
    
    // Debug: Check if connection was added
    console.log(`🔍 Debug - After connectWhatsApp, connections map has user: ${connections.has(userId)}`);
    if (connections.has(userId)) {
      const userConnections = connections.get(userId);
      console.log(`🔍 Debug - user connections after connectWhatsApp:`, Array.from(userConnections.keys()));
    }
    
    res.json({
      success: true,
      message: 'Connection initiated successfully',
      status: 'initiated',
      userId,
      sessionId,
      note: 'Server will maintain this connection independently'
    });
    
  } catch (error) {
    console.error(`❌ Error initiating connection for user ${req.params.userId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 6. Fetch Customers from External API
app.post('/api/customers/fetch/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📥 Fetching customers from external API for user: ${userId}`);
    
    // Get user's driver_id from profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('driver_id')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError);
      const code = profileError.code || profileError.status || 500;
      if (code === 'PGRST116' || code === 406 || code === 404) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found. Make sure you are logged in and your profile exists.'
        });
      }
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch user profile' 
      });
    }
    
    if (!userProfile?.driver_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Driver ID not found. Please set your driver ID in your profile.' 
      });
    }
    
    console.log(`🚚 Fetching shipments for driver_id: ${userProfile.driver_id}`);
    
    // Fetch data from external API using axios (like your working code)
    const apiUrl = `https://opost.ps/api/resources/shipments?sort=area&filter=picked_up&limit=300&driver_id=${userProfile.driver_id}`;
    const bearerToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMTQ2MGE3NmY1MmZmNTQ0MTk1Mzg2ZTQ3MzFlYmQzMzY5YzAwMDFhZWQwYTg1MTVjNGRmMDNiODJlNjM5YWE4NjAwN2U3NjNlM2Q5Y2NhY2UiLCJpYXQiOjE3NDgxNzcwMTkuMDk0NjIxLCJuYmYiOjE3NDgxNzcwMTkuMDk0NjIzLCJleHAiOjE3Nzk3MTMwMTkuMDkzNDU3LCJzdWIiOiIxMDI4OSIsInNjb3BlcyI6W119.aUFywcWgDDp5URaamhA1Rkl9JLeExKCZaix0PxkhNGLi8EUNwutJpdO1FGOf7b9IWdDpi4zCfhhjzZJgqKnfdlAnfC-EBZ-VTvJEDQisinQaLt2MvgBDbTFvjJ5-RThocO2I6O7dRc1UPhRC_wRzK1I5XypAysiKR3GbA3Y5tgY-IbxFl-aE4DovYQ8cUDcsNi-qU-tdsJqadYx6lPLlLv5TYUmB0ArBEoyuft0F8i3XRQq4qES_LkVhmqLFvr3Xhk5V9kpNw8tUShwJzlqlC5BP0tNAlVKsDvWlqlm4qua1VhMpA-WCLjaY13Bgxj3r8ZG6iqzC3AzKFqI2bMzendWve1RgryphPtVwwrYgfGemG_LT7T1TnZhrybDeYrpYLePOSg8n10fdm1ccQuZ7U4LYpgwTzMO_TG2v4b7wiv6anT2WvYQM4D_Mp7wrWrrWOdnYLqSudHvJ55MPQUvpHfySHG3OZRGrFYaUH2s8nw7kThOS2jH6lOdzwz4EvOV5cEeuhwQEKDpXW1TttU_MEAxxnWvIzwdoL8dy3U6Qs3RdRB1W8nbiUVnLMPdGxQITSjqGTFiDXhON5veboy4eqoyx1mun294nSNA1yebkeICf4GdlvHeyUXqWeQvUk3l41-eY04-fA7GYN_Vy-7zss02KRfpgOaNJtCmL2kK_wBQ";
    
    console.log(`🌐 Making axios request to: ${apiUrl}`);
    
    let apiData;
    try {
      const response = await axios.request({
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
        method: "GET",
        url: apiUrl,
      });
      
      apiData = response.data;
      console.log(`✅ Axios request successful, status: ${response.status}`);
    } catch (axiosError) {
      console.error('❌ Axios request failed:', axiosError.message);
      if (axiosError.response) {
        console.error('❌ Response status:', axiosError.response.status);
        console.error('❌ Response data:', axiosError.response.data);
        return res.status(axiosError.response.status).json({ 
          success: false, 
          error: `External API error: ${axiosError.response.status} - ${axiosError.response.data?.message || axiosError.message}` 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: `Network error: ${axiosError.message}` 
        });
      }
    }
    
    // The API returns an array with one object containing data and pagination
    const shipmentsData = Array.isArray(apiData) ? apiData[0] : apiData;
    const shipments = shipmentsData?.data || [];
    const pagination = shipmentsData?.pagination;
    
    console.log(`📊 Received API response structure:`, JSON.stringify(shipmentsData, null, 2));
    console.log(`📦 Found ${shipments.length} shipments from API`);
    
    // 🔍 DEBUG: Log a warning about areas table protection
    console.log(`🔍 DEBUG: Areas table is READ-ONLY - no modifications will be made to areas during customer fetch`);
    
    // 🔍 DEBUG: Log the full API response structure to see what we're getting from Opost
    console.log(`🔍 DEBUG: Full Opost API Response:`, JSON.stringify(apiData, null, 2));
    
    // 🔍 DEBUG: Check areas table state before processing
    const { data: areasBefore, error: areasBeforeError } = await supabase
      .from('areas')
      .select('areaId, name_arabic, name_english, name_hebrew, preferred_language_1, preferred_language_2')
      .limit(5);
    
    if (areasBeforeError) {
      console.error('🔍 DEBUG: Error checking areas before processing:', areasBeforeError);
    } else {
      console.log('🔍 DEBUG: Areas table state BEFORE processing:', areasBefore);
    }
    
    // 🔍 DEBUG: Log timestamp for tracking
    console.log('🔍 DEBUG: Customer fetch started at:', new Date().toISOString());
    
    if (!shipments || shipments.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No shipments found for this driver',
        totalFetched: 0,
        totalCreated: 0,
        totalUpdated: 0,
        pagination
      });
    }
    
    let totalCreated = 0;
    let totalUpdated = 0;
    
    // Process each shipment
    for (const shipment of shipments) {
      try {
        // Check if area exists in areas table (FK target) - READ ONLY
        const areaIdVal = shipment['consignee.area']?.id || null;
        const areaName = shipment['consignee.area']?.name || null;
        
        // 🔍 DEBUG: Log the area data from Opost API
        console.log(`🔍 DEBUG Opost Area Data for shipment ${shipment.id}:`, {
          areaId: areaIdVal,
          areaName: areaName,
          fullAreaObject: shipment['consignee.area']
        });
        
        if (areaIdVal) {
          // Only check if area exists, don't create new ones
          const { data: existingArea, error: areaCheckError } = await supabase
            .from('areas')
            .select('areaId, name_arabic, name_english, name_hebrew, preferred_language_1, preferred_language_2')
            .eq('areaId', areaIdVal)
            .single();
          
        // 🔍 DEBUG: Log existing area data
        console.log(`🔍 DEBUG Existing Area Data for areaId ${areaIdVal}:`, existingArea);
        
        // 🔍 DEBUG: Check if the area data from Opost matches what's in the database
        if (existingArea && areaName) {
          console.log(`🔍 DEBUG Area Comparison for areaId ${areaIdVal}:`);
          console.log(`   - Opost area name: "${areaName}"`);
          console.log(`   - DB name_arabic: "${existingArea.name_arabic}"`);
          console.log(`   - DB name_english: "${existingArea.name_english}"`);
          console.log(`   - DB name_hebrew: "${existingArea.name_hebrew}"`);
          console.log(`   - DB preferred_language_1: "${existingArea.preferred_language_1}"`);
          console.log(`   - DB preferred_language_2: "${existingArea.preferred_language_2}"`);
          
          // Check if Opost name matches any of the database names
          const matchesArabic = existingArea.name_arabic && existingArea.name_arabic.includes(areaName);
          const matchesEnglish = existingArea.name_english && existingArea.name_english.includes(areaName);
          const matchesHebrew = existingArea.name_hebrew && existingArea.name_hebrew.includes(areaName);
          
          console.log(`   - Matches Arabic: ${matchesArabic}`);
          console.log(`   - Matches English: ${matchesEnglish}`);
          console.log(`   - Matches Hebrew: ${matchesHebrew}`);
        }
          
          if (areaCheckError && areaCheckError.code === 'PGRST116') {
            console.warn(`⚠️ Area ${areaIdVal} (${areaName}) not found in areas table - contact admin to add it`);
            // Don't create the area - areas table should be managed by admin only
          } else if (areaCheckError) {
            console.warn(`⚠️ Error checking area ${areaIdVal}:`, areaCheckError);
          } else {
            console.log(`✅ Area ${areaIdVal} (${areaName}) exists in areas table`);
            console.log(`🔍 DEBUG Area details:`, {
              name_arabic: existingArea.name_arabic,
              name_english: existingArea.name_english,
              name_hebrew: existingArea.name_hebrew,
              preferred_language_1: existingArea.preferred_language_1,
              preferred_language_2: existingArea.preferred_language_2
            });
          }
        }

        // Extract customer data from shipment
        const customerData = {
          user_id: userId,
          name: shipment['consignee.name'] || 'Unknown Customer',
          phone: shipment['consignee.phone'] || '',
          area: shipment['consignee.area']?.name || 'Unknown Area',
          package_price: shipment.cod_amount || 0,
          package_id: shipment.id?.toString() || '',
          has_return: shipment.has_return || false,
          business_name: shipment['business.name'] || '',
          areaId: areaIdVal, // Changed from areaid to areaId (camelCase)
          tracking_number: shipment.tracking_number || '',
          shipment_id: shipment.id || null,
          whatsapp_message: shipment.whatsapp_api_message || '',
          items_description: shipment.items_description || '',
          quantity: shipment.quantity || 1,
          created_date: shipment.created_at ? new Date(shipment.created_at) : null,
          updated_date: shipment.updated_at ? new Date(shipment.updated_at) : null,
          status: shipment.status || ''
        };

        // Add phone2 if it exists and is in Israeli format
        const phone2 = shipment['consignee.phone2'];
        if (phone2 && phone2.trim() !== '') {
          // Check if it's in Israeli format (starts with 05 and has 10 digits)
          const phone2Clean = phone2.trim();
          if (phone2Clean.startsWith('05') && phone2Clean.length === 10 && /^\d+$/.test(phone2Clean)) {
            customerData.phone2 = phone2Clean;
            console.log(`📱 Added phone2 for ${customerData.name}: ${phone2Clean}`);
          } else {
            console.log(`⚠️ Skipping invalid phone2 for ${customerData.name}: ${phone2} (not in Israeli format)`);
          }
        }
        
        // Check if customer already exists (by shipment_id)
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('shipment_id', shipment.id)
          .eq('user_id', userId)
          .single();
        
        if (existingCustomer) {
          // Update existing customer
          const { error: updateError } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existingCustomer.id);
          
          if (!updateError) {
            totalUpdated++;
            console.log(`✅ Updated customer: ${customerData.name}`);
          } else {
            console.error(`❌ Error updating customer ${customerData.name}:`, updateError);
            console.error(`❌ Customer data:`, JSON.stringify(customerData, null, 2));
          }
        } else {
          // Create new customer
          const { error: createError } = await supabase
            .from('customers')
            .insert([customerData]);
          
          if (!createError) {
            totalCreated++;
            console.log(`✅ Created customer: ${customerData.name}`);
          } else {
            console.error(`❌ Error creating customer ${customerData.name}:`, createError);
            console.error(`❌ Customer data:`, JSON.stringify(customerData, null, 2));
          }
        }

        // Also insert/update in locations table
        try {
          console.log(`📍 Processing location for shipment ${shipment.id}, customer: ${customerData.name}`);
          
          // Check if location already exists (by shipment_id)
          const { data: existingLocation, error: checkLocationError } = await retryOperation(async () => {
            const { data, error } = await supabase
              .from('locations')
              .select('id')
              .eq('shipment_id', shipment.id)
              .eq('user_id', userId)
              .single();
            
            if (error && error.code !== 'PGRST116') {
              throw new Error(`Database check error: ${error.message}`);
            }
            
            return { data, error };
          }, 3, 1000);
          
          if (checkLocationError && checkLocationError.code !== 'PGRST116') {
            console.error(`❌ Error checking existing location:`, checkLocationError);
          }
          
          if (existingLocation) {
            // Update existing location
            console.log(`📍 Updating existing location for ${customerData.name}`);
            
            await retryOperation(async () => {
              const { error: updateLocationError } = await supabase
                .from('locations')
                .update(customerData)
                .eq('id', existingLocation.id);
              
              if (updateLocationError) {
                throw new Error(`Database update error: ${updateLocationError.message}`);
              }
              
              console.log(`✅ Updated location: ${customerData.name}`);
            }, 3, 1000);
          } else {
            // Create new location
            console.log(`📍 Creating new location for ${customerData.name}`);
            console.log(`📍 Location data:`, JSON.stringify(customerData, null, 2));
            
            await retryOperation(async () => {
              const { data: insertedLocation, error: createLocationError } = await supabase
                .from('locations')
                .insert([customerData])
                .select();
              
              if (createLocationError) {
                throw new Error(`Database insert error: ${createLocationError.message}`);
              }
              
              console.log(`✅ Created location: ${customerData.name}`, insertedLocation);
            }, 3, 1000);
          }
        } catch (locationError) {
          console.error(`❌ Error processing location for shipment ${shipment.id}:`, locationError);
          console.error(`❌ Location error details:`, locationError.message);
        }
      } catch (shipmentError) {
        console.error(`❌ Error processing shipment ${shipment.id}:`, shipmentError);
      }
    }
    
    console.log(`📊 Fetch completed: ${totalCreated} created, ${totalUpdated} updated`);
    
    // 🔍 DEBUG: Check areas table state after processing
    const { data: areasAfter, error: areasAfterError } = await supabase
      .from('areas')
      .select('areaId, name_arabic, name_english, name_hebrew, preferred_language_1, preferred_language_2')
      .limit(5);
    
    if (areasAfterError) {
      console.error('🔍 DEBUG: Error checking areas after processing:', areasAfterError);
    } else {
      console.log('🔍 DEBUG: Areas table state AFTER processing:', areasAfter);
      
      // Compare before and after states
      if (areasBefore && areasAfter) {
        const changed = areasBefore.some((before, index) => {
          const after = areasAfter[index];
          return after && (
            before.name_arabic !== after.name_arabic ||
            before.name_english !== after.name_english ||
            before.name_hebrew !== after.name_hebrew ||
            before.preferred_language_1 !== after.preferred_language_1 ||
            before.preferred_language_2 !== after.preferred_language_2
          );
        });
        
        if (changed) {
          console.error('🚨 DEBUG: AREAS TABLE WAS MODIFIED DURING CUSTOMER FETCH!');
          console.error('🚨 This should not happen - areas table should be read-only!');
        } else {
          console.log('✅ DEBUG: Areas table unchanged during customer fetch');
        }
      }
    }
    
    res.json({
      success: true,
      message: `Successfully fetched ${shipments.length} shipments and synced to both customers and locations tables`,
      totalFetched: shipments.length,
      totalCreated,
      totalUpdated,
      pagination,
      note: "Data has been inserted into both 'customers' and 'locations' tables"
    });
    
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch customers from external API' 
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WhatsApp Automation API running on port ${PORT}`);
  console.log(`📱 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📱 Mobile Access: http://192.168.0.113:${PORT}/api`);
  
  // Initialize connection persistence manager for 24/7 operation
  connectionPersistenceManager.initialize();
});

// Test endpoint for areas and preferred languages
app.get('/api/areas/test/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    console.log(`🧪 Testing areas and preferred languages for user ${userId}`);
    
    // Get customers for this user
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, areaId, area')
      .eq('user_id', userId)
      .not('areaId', 'is', null);
    
    if (customersError) {
      console.error('❌ Failed to get customers:', customersError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get customers',
        details: customersError 
      });
    }
    
    console.log(`📊 Found ${customers.length} customers with areaIds`);
    
    // Get unique areaIds
    const areaIds = [...new Set(customers.map(c => c.areaId).filter(id => id != null))];
    console.log(`📍 Unique areaIds:`, areaIds);
    
    // Get area details
    const { data: areas, error: areasError } = await supabase
      .from('areas')
      .select('areaId, name_arabic, name_english, name_hebrew, preferred_language_1, preferred_language_2')
      .in('areaId', areaIds);
    
    if (areasError) {
      console.error('❌ Failed to get areas:', areasError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get areas',
        details: areasError 
      });
    }
    
    console.log(`📍 Found ${areas.length} areas in database`);
    
    // Check for missing areas
    const foundAreaIds = areas.map(a => a.areaId);
    const missingAreaIds = areaIds.filter(id => !foundAreaIds.includes(id));
    
    console.log(`❌ Missing areas:`, missingAreaIds);
    
    // Check preferred languages
    const areasWithLanguages = areas.filter(a => a.preferred_language_1 || a.preferred_language_2);
    const areasWithoutLanguages = areas.filter(a => !a.preferred_language_1 && !a.preferred_language_2);
    
    console.log(`✅ Areas with preferred languages: ${areasWithLanguages.length}`);
    console.log(`⚠️ Areas without preferred languages: ${areasWithoutLanguages.length}`);
    
    res.json({ 
      success: true, 
      message: 'Areas test completed',
      results: {
        totalCustomers: customers.length,
        uniqueAreaIds: areaIds,
        foundAreas: areas.length,
        missingAreas: missingAreaIds,
        areasWithLanguages: areasWithLanguages.length,
        areasWithoutLanguages: areasWithoutLanguages.length,
        areas: areas.map(area => ({
          areaId: area.areaId,
          name_english: area.name_english,
          name_hebrew: area.name_hebrew,
          name_arabic: area.name_arabic,
          preferred_language_1: area.preferred_language_1,
          preferred_language_2: area.preferred_language_2,
          hasLanguages: !!(area.preferred_language_1 || area.preferred_language_2)
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Areas test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

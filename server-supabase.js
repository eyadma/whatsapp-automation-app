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
const { logger } = require('./optimized-logger');

// Environment-based logging control
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// Override logger methods for production
if (isProduction) {
  const originalInfo = logger.info.bind(logger);
  const originalWarn = logger.warn.bind(logger);
  
  logger.info = (message, data) => {
    if (LOG_LEVEL === 'error' || LOG_LEVEL === 'warn') return;
    originalInfo(message, data);
  };
  
  logger.warn = (message, data) => {
    if (LOG_LEVEL === 'error') return;
    originalWarn(message, data);
  };
}


// Batch logging for high-frequency events
function logBatchMessages(messages, customerName) {
  if (messages.length > 5) {
    logger.batchLog('info', messages.map((msg, idx) => `Message ${idx + 1} to ${customerName}`));
  } else {
    messages.forEach((msg, idx) => logger.info(`Message ${idx + 1} to ${customerName}`));
  }
}


require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
      logger.error(`Background message failed for ${customer.name}`, error.message);
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
  
  logger.info(`Background process ${processId} completed in ${Math.floor(duration / 60)}m ${duration % 60}s`);
  logger.info(`Results: ${process.completed} sent, ${process.failed} failed`);
  
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
      logger.error(`Background message failed for ${customer.name}`, error.message);
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
  
  logger.info(`Background process ${processId} completed in ${Math.floor(duration / 60)}m ${duration % 60}s`);
  logger.info(`Results: ${process.completed} sent, ${process.failed} failed`);
  
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
  try {
    console.log(`🚀 Starting WhatsApp connection for user: ${userId}, session: ${sessionId || 'default'}`);
    
    // Validate inputs
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const sessionDir = path.join(__dirname, 'sessions', userId, sessionId || 'default');
    console.log(`📁 Session directory: ${sessionDir}`);
    
    try {
      if (!fs.existsSync(sessionDir)) {
        console.log(`📁 Creating session directory for user: ${userId}, session: ${sessionId || 'default'}`);
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      console.log(`🔍 Session directory exists: ${fs.existsSync(sessionDir)}`);
      console.log(`🔍 Session directory contents:`, fs.readdirSync(sessionDir));
    } catch (fsError) {
      console.error(`❌ File system error for user ${userId}:`, fsError);
      throw new Error(`Failed to create session directory: ${fsError.message}`);
    }

    console.log(`🔐 Loading auth state for user: ${userId}`);
    let state, saveCreds;
    try {
      const authResult = await useMultiFileAuthState(sessionDir);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
      console.log(`✅ Auth state loaded for user: ${userId}`);
    } catch (authError) {
      console.error(`❌ Auth state error for user ${userId}:`, authError);
      throw new Error(`Failed to load auth state: ${authError.message}`);
    }

    console.log(`🔗 Creating WhatsApp socket for user: ${userId}`);
    let sock;
    try {
      sock = makeWASocket({
        auth: state,
        browser: ['WhatsApp Long Session', 'Chrome', '1.0.0'],
        // Extended timeout settings for 10+ hour sessions
        connectTimeoutMs: 60000, // 1 minute connection timeout
        keepAliveIntervalMs: 30000, // Send keep-alive every 30 seconds
        retryRequestDelayMs: 2000, // 2 seconds between retries
        maxRetries: 5, // More retries for stability
        defaultQueryTimeoutMs: 120000, // 2 minutes for queries
        // Session persistence settings
        emitOwnEvents: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        // Extended session settings
        shouldSyncHistoryMessage: () => false, // Don't sync old messages
        shouldIgnoreJid: () => false, // Don't ignore any JIDs
        // Keep session alive settings
        getMessage: async (key) => {
          // Implement message retrieval logic for session persistence
          return null;
        }
      });
      console.log(`✅ WhatsApp socket created for user: ${userId}`);
    } catch (socketError) {
      console.error(`❌ Socket creation error for user ${userId}:`, socketError);
      throw new Error(`Failed to create WhatsApp socket: ${socketError.message}`);
    }

    // Session health monitoring
    const sessionStartTime = new Date();
    const sessionHealthCheck = setInterval(() => {
      const sessionDuration = new Date() - sessionStartTime;
      const hoursAlive = Math.floor(sessionDuration / (1000 * 60 * 60));
      const minutesAlive = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`💚 Session health check for user ${userId}: ${hoursAlive}h ${minutesAlive}m alive`);
      
      // Log session milestone every hour
      if (minutesAlive === 0 && hoursAlive > 0) {
        console.log(`🎉 Session milestone: ${hoursAlive} hours alive for user ${userId}`);
      }
      
      // Check if socket is still healthy
      if (sock && sock.ws && sock.ws.readyState === 1) {
        console.log(`✅ Socket healthy for user ${userId} - ReadyState: ${sock.ws.readyState}`);
      } else {
        console.log(`⚠️ Socket health warning for user ${userId} - ReadyState: ${sock?.ws?.readyState}`);
      }
    }, 300000); // Check every 5 minutes

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      console.log(`📱 Connection update for user ${userId}:`, update);
      
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code generation
      if (qr) {
        console.log(`📱 QR Code received for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
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
        console.log(`🔗 Setting connection data:`, {
          userId,
          sessionId: sessionId || 'default',
          connected: false,
          connecting: true,
          hasSocket: !!sock,
          socketReady: sock?.ws?.readyState === 1,
          connectionType: 'qr_required'
        });
        setConnection(userId, sessionId || 'default', connectionData);
        console.log(`🔍 Connection set. Available connections for user ${userId}:`, getUserConnections(userId));
      }
      
      // Handle connection close
      if (connection === 'close') {
        console.log(`❌ Connection closed for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
        
        // Clear the health check interval
        if (sessionHealthCheck) {
          clearInterval(sessionHealthCheck);
          console.log(`🧹 Cleared health check interval for user: ${userId}`);
        }
        
        // Clear the keep-alive interval
        const connection = getConnection(userId, sessionId || 'default');
        if (connection && connection.keepAliveInterval) {
          clearInterval(connection.keepAliveInterval);
          console.log(`🧹 Cleared keep-alive interval for user: ${userId}`);
        }
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log(`🔄 Attempting to reconnect for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
          // Progressive reconnection delay: 3s, 10s, 30s, 60s, then every 2 minutes
          const reconnectDelays = [3000, 10000, 30000, 60000, 120000];
          let reconnectAttempts = 0;
          
          const attemptReconnect = () => {
            reconnectAttempts++;
            const delay = reconnectDelays[Math.min(reconnectAttempts - 1, reconnectDelays.length - 1)];
            
            console.log(`🔄 Reconnection attempt ${reconnectAttempts} for user ${userId} in ${delay/1000}s`);
            
            setTimeout(() => {
              connectWhatsApp(userId, sessionId).catch(error => {
                console.error(`❌ Reconnection attempt ${reconnectAttempts} failed for user ${userId}:`, error);
                if (reconnectAttempts < 10) { // Max 10 reconnection attempts
                  attemptReconnect();
                } else {
                  console.log(`❌ Max reconnection attempts reached for user ${userId}`);
                  removeConnection(userId, sessionId || 'default');
                }
              });
            }, delay);
          };
          
          attemptReconnect();
        } else {
          console.log(`❌ Connection closed permanently for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
          removeConnection(userId, sessionId || 'default');
        }
      } 
      
      // Handle connection open
      else if (connection === 'open') {
        console.log(`✅ Connection opened for user: ${userId}`);
        
        // Start session keep-alive mechanism
        const keepAliveInterval = setInterval(async () => {
          try {
            if (sock && sock.ws && sock.ws.readyState === 1) {
              // Send a ping to keep the connection alive
              await sock.ping();
              console.log(`💓 Keep-alive ping sent for user: ${userId}`);
            } else {
              console.log(`⚠️ Cannot send keep-alive ping for user ${userId} - socket not ready`);
            }
          } catch (error) {
            console.error(`❌ Keep-alive ping failed for user ${userId}:`, error);
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
            console.log(`🔍 Connected connection set. Available connections for user ${userId}:`, getUserConnections(userId));
            
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
      console.error(`❌ WhatsApp socket error for user ${userId}:`, error);
    });

    // Add message listener for location handling
    sock.ev.on('messages.upsert', async (event) => {
      try {
        for (const message of event.messages) {
          // Skip if message is from self
          if (message.key.fromMe) continue;
          
          console.log(`📱 Received message for user ${userId}:`, {
            type: message.message?.conversation ? 'text' : Object.keys(message.message || {}).join(', '),
            from: message.key.remoteJid,
            timestamp: message.messageTimestamp
          });

          // Check if message is a location or has quoted location
          let locationData = null;

          // Check direct location message
          if (message.message?.locationMessage) {
            locationData = message.message.locationMessage;
            console.log(`📍 Direct location received for user ${userId}:`, {
              latitude: locationData.degreesLatitude,
              longitude: locationData.degreesLongitude,
              name: locationData.name,
              address: locationData.address
            });
          }
          // Check quoted message for location
          else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.locationMessage) {
            locationData = message.message.extendedTextMessage.contextInfo.quotedMessage.locationMessage;
            console.log(`📍 Quoted location received for user ${userId}:`, {
              latitude: locationData.degreesLatitude,
              longitude: locationData.degreesLongitude,
              name: locationData.name,
              address: locationData.address
            });
          }

          // If we have location data, process it
          if (locationData) {
            try {
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

              console.log(`📞 Processing location for contact: ${contactName}`);
              console.log(`📱 WhatsApp phone: ${whatsappPhoneNumber} -> Converted: ${phoneNumber}`);
              console.log(`🔍 Searching for customer with phone: ${phoneNumber} or original: ${whatsappPhoneNumber}`);

              // Check if customer exists by phone number (try both formats)
              console.log(`🔍 Searching for customer with phone numbers: ${phoneNumber}, ${whatsappPhoneNumber}`);
              
              // Normalize phone numbers for comparison
              const normalizedWhatsAppPhone = normalizePhoneNumber(whatsappPhoneNumber);
              const normalizedLocalPhone = normalizePhoneNumber(phoneNumber);
              
              console.log(`🔍 Normalized phone numbers: WhatsApp=${normalizedWhatsAppPhone}, Local=${normalizedLocalPhone}`);
              
              // First, let's get all locations for this user to debug
              const { data: allLocations, error: allLocationsError } = await supabase
                .from('locations')
                .select('id, name, phone, phone2')
                .eq('user_id', userId);

              if (allLocationsError) {
                console.error(`❌ Error fetching all locations:`, allLocationsError);
                continue;
              }

              console.log(`🔍 Total locations for user ${userId}: ${allLocations?.length || 0}`);
              
              // Check for exact matches - find ALL matching locations
              let matchingLocations = [];
              if (allLocations && allLocations.length > 0) {
                for (const location of allLocations) {
                  const locationPhoneNormalized = normalizePhoneNumber(location.phone);
                  const locationPhone2Normalized = normalizePhoneNumber(location.phone2);
                  
                  console.log(`   Checking location: ${location.name}`);
                  console.log(`     Phone: ${location.phone} -> Normalized: ${locationPhoneNormalized}`);
                  console.log(`     Phone2: ${location.phone2} -> Normalized: ${locationPhone2Normalized}`);
                  
                  if (locationPhoneNormalized === normalizedWhatsAppPhone || 
                      locationPhoneNormalized === normalizedLocalPhone ||
                      locationPhone2Normalized === normalizedWhatsAppPhone || 
                      locationPhone2Normalized === normalizedLocalPhone) {
                    console.log(`✅ Found matching location: ${location.name} (ID: ${location.id})`);
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
                    const { error: updateError } = await supabase
                      .from('locations')
                      .update(locationUpdateData)
                      .eq('id', location.id);

                    if (updateError) {
                      console.error(`❌ Error updating location ${location.name}:`, updateError);
                      errorCount++;
                    } else {
                      console.log(`✅ Successfully updated location: ${location.name}`);
                      updatedCount++;
                    }
                  } catch (updateError) {
                    console.error(`❌ Exception updating location ${location.name}:`, updateError);
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

                const { error: insertError } = await supabase
                  .from('locations')
                  .insert([newLocationData]);

                if (insertError) {
                  console.error(`❌ Error creating new location:`, insertError);
                } else {
                  console.log(`✅ Successfully created new location entry: ${contactName}`);
                }
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
        console.error(`❌ Error in message listener for user ${userId}:`, error);
      }
    });

    console.log(`✅ WhatsApp connection setup completed for user: ${userId}`);
    return sock;
  } catch (error) {
    console.error(`❌ Error connecting WhatsApp for user: ${userId}`, error);
    throw error;
  }
}

// API Routes

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
  
  // Debug: Log all available connections for this user
  console.log(`🔍 Available connections for user ${userId}:`, getUserConnections(userId));
  console.log(`🔍 Current connections map:`, Array.from(connections.entries()));
  
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
      await connection.sock.logout();
      removeConnection(userId, sessionId);
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
      await connection.sock.logout();
      removeConnection(userId, sessionId);
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
    const sessionDir = path.join(__dirname, 'sessions', userId);
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
    const sessionDir = path.join(__dirname, 'sessions', userId);
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

    console.log(`🚀 Starting message sending for user ${userId}${sessionId ? `, session: ${sessionId}` : ''} with speed delay: ${speedDelay} seconds`);
    console.log(`🔍 Available connections for user ${userId}: [ ${getUserConnections(userId).join(', ')} ]`);
    console.log(`🔍 Requested sessionId: ${sessionId || 'default'}`);
    
    const connection = getConnection(userId, sessionId);
    console.log(`🔍 Connection object:`, connection ? {
      hasConnection: !!connection,
      connected: connection.connected,
      connecting: connection.connecting,
      hasSocket: !!connection.sock,
      sessionId: connection.sessionId
    } : 'null');
    
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
        
        console.log(`📱 Sending message to ${customer.name} at ${phoneNumber}`);
        console.log(`🔗 Connection status:`, connection.connected);
        console.log(`📱 Socket state:`, connection.sock ? 'Connected' : 'Not connected');
        console.log(`📱 Connection object:`, {
          isConnected: connection.connected,
          isConnecting: connection.connecting,
          hasSocket: !!connection.sock,
          socketState: connection.sock?.ws?.readyState
        });
        
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
        
        // Additional connection state check
        console.log(`🔗 Connection status: ${connection.connected}`);
        console.log(`📱 Socket state: ${connection.sock ? 'Available' : 'Not Available'}`);
        console.log(`📱 Connection object:`, {
          isConnected: connection.connected,
          isConnecting: connection.connecting,
          hasSocket: !!connection.sock,
          socketState: connection.sock?.ws?.readyState
        });
        
        // Check socket state - improved check
        console.log(`🔍 Socket state check:`, {
          hasSock: !!connection.sock,
          hasWs: !!(connection.sock && connection.sock.ws),
          readyState: connection.sock?.ws?.readyState,
          sockKeys: connection.sock ? Object.keys(connection.sock) : []
        });
        
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
    console.log(`🔍 Available connections for user ${userId}: [ ${getUserConnections(userId).join(', ')} ]`);
    console.log(`🔍 Requested sessionId: ${sessionId || 'default'}`);
    
    const connection = getConnection(userId, sessionId);
    console.log(`🔍 Connection object:`, connection ? {
      hasConnection: !!connection,
      connected: connection.connected,
      connecting: connection.connecting,
      hasSocket: !!connection.sock,
      sessionId: connection.sessionId
    } : 'null');
    
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
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', userId)
      .limit(5);
    
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
    
    const { data: insertedTest, error: insertError } = await supabase
      .from('locations')
      .insert([testData])
      .select();
    
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
    await supabase
      .from('locations')
      .delete()
      .eq('id', insertedTest[0].id);
    
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
        // Ensure area exists in areas table (FK target)
        const areaIdVal = shipment['consignee.area']?.id || null;
        const areaName = shipment['consignee.area']?.name || null;
        if (areaIdVal) {
          const { error: upsertAreaError } = await supabase
            .from('areas')
            .upsert([
              {
                areaId: areaIdVal,
                name_arabic: areaName || `منطقة ${areaIdVal}`,
                name_english: areaName || `Area ${areaIdVal}`,
                name_hebrew: areaName || `אזור ${areaIdVal}`,
                preferred_language_1: 'ar',
                preferred_language_2: null,
              },
            ], { onConflict: 'areaId' });
          if (upsertAreaError) {
            console.warn(`⚠️ Failed to upsert area ${areaIdVal}:`, upsertAreaError);
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
          const { data: existingLocation, error: checkLocationError } = await supabase
            .from('locations')
            .select('id')
            .eq('shipment_id', shipment.id)
            .eq('user_id', userId)
            .single();
          
          if (checkLocationError && checkLocationError.code !== 'PGRST116') {
            console.error(`❌ Error checking existing location:`, checkLocationError);
          }
          
          if (existingLocation) {
            // Update existing location
            console.log(`📍 Updating existing location for ${customerData.name}`);
            const { error: updateLocationError } = await supabase
              .from('locations')
              .update(customerData)
              .eq('id', existingLocation.id);
            
            if (!updateLocationError) {
              console.log(`✅ Updated location: ${customerData.name}`);
            } else {
              console.error(`❌ Error updating location ${customerData.name}:`, updateLocationError);
              console.error(`❌ Location update data:`, JSON.stringify(customerData, null, 2));
            }
          } else {
            // Create new location
            console.log(`📍 Creating new location for ${customerData.name}`);
            console.log(`📍 Location data:`, JSON.stringify(customerData, null, 2));
            
            const { data: insertedLocation, error: createLocationError } = await supabase
              .from('locations')
              .insert([customerData])
              .select();
            
            if (!createLocationError) {
              console.log(`✅ Created location: ${customerData.name}`, insertedLocation);
            } else {
              console.error(`❌ Error creating location ${customerData.name}:`, createLocationError);
              console.error(`❌ Location creation data:`, JSON.stringify(customerData, null, 2));
            }
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
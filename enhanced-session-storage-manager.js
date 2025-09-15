const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const SupabaseStorageService = require('./supabase-storage-service');
const supabase = require('./config/supabase');

class EnhancedSessionStorageManager {
  constructor() {
    this.storageService = new SupabaseStorageService();
    this.activeSessions = new Map(); // userId -> Map of sessionId -> connection
    this.sessionMetadata = new Map(); // sessionId -> metadata
  }

  /**
   * Create a new WhatsApp session with cloud storage integration
   */
  async createSession(userId, sessionData = {}) {
    try {
      const sessionId = sessionData.sessionId || `session_${Date.now()}_${uuidv4().substr(0, 8)}`;
      const localSessionPath = path.join(__dirname, 'sessions', userId, sessionId);
      
      console.log(`🚀 Creating/updating session: ${sessionId} for user: ${userId}`);
      
      // Create local directory
      if (!fs.existsSync(localSessionPath)) {
        fs.mkdirSync(localSessionPath, { recursive: true });
      }

      // Check if session already exists
      const { data: existingSession, error: checkError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .single();

      if (existingSession && !checkError) {
        console.log(`📋 Session already exists: ${sessionId}, updating...`);
        
        // Update existing session
        const { data: updatedSession, error: updateError } = await supabase
          .from('whatsapp_sessions')
          .update({
            session_name: sessionData.name || existingSession.session_name,
            session_alias: sessionData.alias || existingSession.session_alias,
            phone_number: sessionData.phoneNumber || existingSession.phone_number,
            connection_type: sessionData.connectionType || existingSession.connection_type,
            max_connections: sessionData.maxConnections || existingSession.max_connections,
            status: 'initializing',
            is_default: sessionData.isDefault !== undefined ? sessionData.isDefault : existingSession.is_default,
            is_active: true,
            last_activity: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('session_id', sessionId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Store metadata in memory
        this.sessionMetadata.set(sessionId, {
          userId,
          sessionId,
          localPath: localSessionPath,
          status: 'initializing',
          createdAt: new Date(existingSession.created_at),
          lastActivity: new Date()
        });

        console.log(`✅ Session updated: ${sessionId}`);
        return { success: true, sessionId, session: updatedSession, action: 'updated' };
      }

      // Create new session
      const { data: dbSession, error: dbError } = await supabase
        .from('whatsapp_sessions')
        .insert({
          user_id: userId,
          session_id: sessionId,
          session_name: sessionData.name || 'New Session',
          session_alias: sessionData.alias || this.generateAlias(sessionData.name),
          phone_number: sessionData.phoneNumber,
          connection_type: sessionData.connectionType || 'mobile',
          max_connections: sessionData.maxConnections || 5,
          status: 'initializing',
          is_default: sessionData.isDefault || false,
          is_active: true,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Store metadata in memory
      this.sessionMetadata.set(sessionId, {
        userId,
        sessionId,
        localPath: localSessionPath,
        status: 'initializing',
        createdAt: new Date(),
        lastActivity: new Date()
      });

      console.log(`✅ Session created: ${sessionId}`);
      return { success: true, sessionId, session: dbSession, action: 'created' };
    } catch (error) {
      console.error(`❌ Error creating session:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Connect to WhatsApp with cloud storage integration
   */
  async connectWhatsApp(userId, sessionId) {
    try {
      console.log(`🔗 Connecting WhatsApp for user: ${userId}, session: ${sessionId}`);
      
      const localSessionPath = path.join(__dirname, 'sessions', userId, sessionId);
      
      // Check if session exists in cloud storage
      try {
        const { exists } = await this.storageService.sessionExists(userId, sessionId);
        
        if (exists) {
          console.log(`📥 Session exists in cloud, restoring...`);
          const restoreResult = await this.storageService.restoreSessionFromCloud(userId, sessionId, localSessionPath);
          
          if (!restoreResult.success) {
            console.warn(`⚠️ Failed to restore from cloud: ${restoreResult.error}`);
          }
        }
      } catch (storageError) {
        console.warn(`⚠️ Cloud storage check failed: ${storageError.message}`);
        // Continue with local session creation
      }

      // Create local directory if it doesn't exist
      if (!fs.existsSync(localSessionPath)) {
        fs.mkdirSync(localSessionPath, { recursive: true });
        console.log(`📁 Created local session directory: ${localSessionPath}`);
      }

      // Load auth state
      console.log(`🔐 Loading auth state for session: ${sessionId}`);
      const { state, saveCreds } = await useMultiFileAuthState(localSessionPath);
      console.log(`✅ Auth state loaded for session: ${sessionId}`);
      
      // Create WhatsApp socket
      console.log(`🔗 Creating WhatsApp socket for session: ${sessionId}`);
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Disable deprecated option
        logger: {
          level: 'silent',
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {},
          child: () => ({ 
            level: 'silent', 
            trace: () => {}, 
            debug: () => {}, 
            info: () => {}, 
            warn: () => {}, 
            error: () => {}, 
            fatal: () => {} 
          })
        }
      });
      console.log(`✅ WhatsApp socket created for session: ${sessionId}`);

      // Store connection
      if (!this.activeSessions.has(userId)) {
        this.activeSessions.set(userId, new Map());
      }
      this.activeSessions.get(userId).set(sessionId, sock);

      // Ensure session metadata exists
      if (!this.sessionMetadata.has(sessionId)) {
        this.sessionMetadata.set(sessionId, {
          userId,
          sessionId,
          localPath: localSessionPath,
          status: 'connecting',
          createdAt: new Date(),
          lastActivity: new Date(),
          qrCode: null
        });
      }

      // Set up event handlers
      this.setupEventHandlers(sock, userId, sessionId, localSessionPath, saveCreds);

      // Update session status
      await this.updateSessionStatus(userId, sessionId, 'connecting');

      console.log(`✅ WhatsApp connection initiated for session: ${sessionId}`);
      
      // Return the session ID - QR code will be available via getQRCode method
      return { success: true, sessionId };
    } catch (error) {
      console.error(`❌ Error connecting WhatsApp:`, error);
      console.error(`❌ Error details:`, {
        message: error.message,
        stack: error.stack,
        userId,
        sessionId
      });
      
      try {
        await this.updateSessionStatus(userId, sessionId, 'error');
      } catch (statusError) {
        console.error(`❌ Failed to update session status:`, statusError);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up WhatsApp event handlers
   */
  setupEventHandlers(sock, userId, sessionId, localSessionPath, saveCreds) {
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log(`📱 QR Code generated for session: ${sessionId}`);
        console.log(`📱 QR Code data: ${qr.substring(0, 50)}...`);
        await this.updateSessionStatus(userId, sessionId, 'qr_generated');
        
        // Store QR code in memory for API access
        if (this.sessionMetadata.has(sessionId)) {
          const metadata = this.sessionMetadata.get(sessionId);
          metadata.qrCode = qr;
          metadata.lastActivity = new Date();
          this.sessionMetadata.set(sessionId, metadata);
          console.log(`✅ QR Code stored in session metadata for: ${sessionId}`);
        } else {
          console.log(`❌ Session metadata not found for: ${sessionId}`);
        }
      }

      if (connection === 'close') {
        console.log(`🔌 Connection closed for session: ${sessionId}`);
        console.log(`🔌 Last disconnect reason:`, lastDisconnect);
        console.log(`🔌 Disconnect error:`, lastDisconnect?.error);
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log(`🔄 Connection closed, reconnecting session: ${sessionId}`);
          await this.updateSessionStatus(userId, sessionId, 'reconnecting');
          
          // Sync session to cloud before reconnecting
          await this.syncSessionToCloud(userId, sessionId, localSessionPath);
          
          // Reconnect after delay
          setTimeout(() => {
            this.connectWhatsApp(userId, sessionId);
          }, 5000);
        } else {
          console.log(`❌ Session logged out: ${sessionId}`);
          await this.updateSessionStatus(userId, sessionId, 'logged_out');
          await this.disconnectSession(userId, sessionId);
        }
      } else if (connection === 'open') {
        console.log(`✅ WhatsApp connected for session: ${sessionId}`);
        console.log(`✅ Connection established at: ${new Date().toISOString()}`);
        await this.updateSessionStatus(userId, sessionId, 'connected');
        
        // Sync session to cloud after successful connection
        await this.syncSessionToCloud(userId, sessionId, localSessionPath);
      } else if (connection === 'connecting') {
        console.log(`🔄 WhatsApp connecting for session: ${sessionId}`);
        await this.updateSessionStatus(userId, sessionId, 'connecting');
      }
    });

    sock.ev.on('creds.update', async () => {
      console.log(`🔐 Credentials updated for session: ${sessionId}`);
      await saveCreds();
      
      // Sync updated credentials to cloud
      await this.syncSessionToCloud(userId, sessionId, localSessionPath);
    });

    sock.ev.on('messages.upsert', async (m) => {
      console.log(`\n🚨 ===== MESSAGE RECEIVED =====`);
      console.log(`📨 Session: ${sessionId}`);
      console.log(`👤 User: ${userId}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log(`📨 Message event details:`, {
        messageCount: m.messages?.length || 0,
        hasMessages: !!m.messages,
        type: m.type,
        fullEvent: JSON.stringify(m, null, 2)
      });
      
      if (m.messages && m.messages.length > 0) {
        console.log(`📱 Processing ${m.messages.length} message(s):`);
        m.messages.forEach((msg, index) => {
          console.log(`📱 Message ${index + 1}:`, {
            from: msg.key?.remoteJid,
            fromMe: msg.key?.fromMe,
            timestamp: msg.messageTimestamp,
            messageTypes: Object.keys(msg.message || {}),
            hasLocation: !!msg.message?.locationMessage,
            hasExtendedText: !!msg.message?.extendedTextMessage,
            pushName: msg.pushName
          });
        });
      }
      
      await this.updateSessionActivity(userId, sessionId);
      
      // Process location messages
      console.log(`🔍 Starting location message processing...`);
      await this.handleLocationMessages(userId, sessionId, m);
      console.log(`🚨 ===== MESSAGE PROCESSING COMPLETE =====\n`);
    });

    // Add connection status monitoring
    sock.ev.on('connection.update', async (update) => {
      console.log(`\n🔌 ===== CONNECTION UPDATE =====`);
      console.log(`🔌 Session: ${sessionId}`);
      console.log(`🔌 User: ${userId}`);
      console.log(`🔌 Connection: ${update.connection}`);
      console.log(`🔌 Last Disconnect:`, update.lastDisconnect);
      console.log(`🔌 QR Code: ${update.qr ? 'Generated' : 'None'}`);
      console.log(`🔌 ===== CONNECTION UPDATE COMPLETE =====\n`);
    });

    // Add periodic heartbeat to verify connection is alive
    setInterval(() => {
      if (sock && !sock.destroyed) {
        console.log(`💓 Heartbeat: Session ${sessionId} is alive`);
      } else {
        console.log(`💀 Heartbeat: Session ${sessionId} is dead or destroyed`);
      }
    }, 30000); // Every 30 seconds

    // Add message polling mechanism as backup for event system
    let lastPollTime = Date.now();
    setInterval(async () => {
      try {
        if (sock && !sock.destroyed && sock.user?.id) {
          console.log(`🔍 Polling for new messages in session ${sessionId}...`);
          
          // Try to get recent messages using the correct Baileys API
          try {
            // Use the correct method - fetchMessageHistory
            const messages = await sock.fetchMessageHistory(sock.user.id, {
              limit: 10,
              before: lastPollTime
            });
            
            if (messages && messages.length > 0) {
              console.log(`📱 Found ${messages.length} messages via polling`);
              
              // Process each message
              for (const message of messages) {
                // Skip messages from self
                if (message.key.fromMe) continue;
                
                // Skip old messages (older than 10 minutes)
                const messageTime = message.messageTimestamp * 1000;
                if (messageTime < lastPollTime - 600000) continue;
                
                console.log(`📱 Processing polled message:`, {
                  from: message.key.remoteJid,
                  timestamp: message.messageTimestamp,
                  messageTypes: Object.keys(message.message || {}),
                  hasLocation: !!message.message?.locationMessage,
                  hasExtendedText: !!message.message?.extendedTextMessage
                });
                
                // Create a mock message event
                const mockEvent = {
                  messages: [message],
                  type: 'polling'
                };
                
                // Process the message
                await this.handleLocationMessages(userId, sessionId, mockEvent);
              }
            } else {
              console.log(`📭 No new messages found via polling`);
            }
          } catch (fetchError) {
            console.error(`❌ Error fetching messages:`, fetchError);
            console.error(`❌ Error details:`, {
              message: fetchError.message,
              name: fetchError.name,
              stack: fetchError.stack
            });
            
            // Log available methods for debugging
            const availableMethods = Object.getOwnPropertyNames(sock).filter(name => 
              name.includes('Message') || name.includes('Chat') || name.includes('get')
            );
            console.error(`❌ Available methods:`, availableMethods);
          }
          
          // Update last poll time
          lastPollTime = Date.now();
        }
      } catch (error) {
        console.error(`❌ Error in message polling for session ${sessionId}:`, error);
      }
    }, 30000); // Poll every 30 seconds
  }

  /**
   * Sync session to cloud storage
   */
  async syncSessionToCloud(userId, sessionId, localSessionPath) {
    try {
      console.log(`🔄 Syncing session to cloud: ${sessionId}`);
      
      const result = await this.storageService.syncSessionToCloud(userId, sessionId, localSessionPath);
      
      if (result.success) {
        console.log(`✅ Session synced to cloud: ${sessionId}`);
      } else {
        console.warn(`⚠️ Failed to sync session to cloud: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error syncing session to cloud:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session status in database
   */
  async updateSessionStatus(userId, sessionId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        last_activity: new Date().toISOString(),
        ...additionalData
      };

      const { error } = await supabase
        .from('whatsapp_sessions')
        .update(updateData)
        .eq('user_id', userId)
        .eq('session_id', sessionId);

      if (error) throw error;

      // Update in-memory metadata
      if (this.sessionMetadata.has(sessionId)) {
        const metadata = this.sessionMetadata.get(sessionId);
        metadata.status = status;
        metadata.lastActivity = new Date();
        this.sessionMetadata.set(sessionId, metadata);
      }

      console.log(`📊 Session status updated: ${sessionId} -> ${status}`);
    } catch (error) {
      console.error(`❌ Error updating session status:`, error);
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(userId, sessionId) {
    try {
      const { error } = await supabase
        .from('whatsapp_sessions')
        .update({
          last_activity: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('session_id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error(`❌ Error updating session activity:`, error);
    }
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(userId, sessionId) {
    try {
      console.log(`🔌 Disconnecting session: ${sessionId}`);
      
      // Close WhatsApp connection
      if (this.activeSessions.has(userId)) {
        const userSessions = this.activeSessions.get(userId);
        if (userSessions.has(sessionId)) {
          const sock = userSessions.get(sessionId);
          await sock.logout();
          userSessions.delete(sessionId);
        }
      }

      // Update status
      await this.updateSessionStatus(userId, sessionId, 'disconnected');

      console.log(`✅ Session disconnected: ${sessionId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error disconnecting session:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a session completely
   */
  async deleteSession(userId, sessionId) {
    try {
      console.log(`🗑️ Deleting session: ${sessionId}`);
      
      // Disconnect if active
      await this.disconnectSession(userId, sessionId);
      
      // Delete from cloud storage
      await this.storageService.deleteSessionFiles(userId, sessionId);
      
      // Delete from database
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('session_id', sessionId);

      if (error) throw error;
      
      // Delete local files
      const localSessionPath = path.join(__dirname, 'sessions', userId, sessionId);
      if (fs.existsSync(localSessionPath)) {
        fs.rmSync(localSessionPath, { recursive: true, force: true });
      }
      
      // Remove from memory
      this.sessionMetadata.delete(sessionId);
      
      console.log(`✅ Session deleted: ${sessionId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error deleting session:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId) {
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return { success: true, sessions: data || [] };
    } catch (error) {
      console.error(`❌ Error fetching user sessions:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get QR code for a session
   */
  getQRCode(userId, sessionId) {
    try {
      console.log(`🔍 Getting QR code for session: ${sessionId}`);
      console.log(`🔍 Session metadata exists: ${this.sessionMetadata.has(sessionId)}`);
      
      if (this.sessionMetadata.has(sessionId)) {
        const metadata = this.sessionMetadata.get(sessionId);
        console.log(`🔍 Session metadata:`, {
          status: metadata.status,
          hasQRCode: !!metadata.qrCode,
          qrCodeLength: metadata.qrCode ? metadata.qrCode.length : 0,
          lastActivity: metadata.lastActivity
        });
        
        const qrCode = metadata.qrCode || null;
        if (qrCode) {
          console.log(`✅ QR Code found: ${qrCode.substring(0, 50)}...`);
        } else {
          console.log(`❌ No QR Code in metadata for session: ${sessionId}`);
        }
        
        return { success: true, qrCode: qrCode };
      }
      
      console.log(`❌ Session metadata not found for: ${sessionId}`);
      return { success: true, qrCode: null };
    } catch (error) {
      console.error(`❌ Error getting QR code:`, error);
      return { success: false, error: error.message };
    }
  }

  getSessionStatus(userId, sessionId) {
    try {
      if (this.sessionMetadata.has(sessionId)) {
        const metadata = this.sessionMetadata.get(sessionId);
        const isConnected = this.activeSessions.has(userId) && 
                           this.activeSessions.get(userId).has(sessionId);
        
        return { 
          success: true, 
          status: metadata.status || 'unknown',
          connected: isConnected,
          sessionId: sessionId,
          userId: userId
        };
      }
      
      // Check if session exists in database
      return { 
        success: true, 
        status: 'not_found',
        connected: false,
        sessionId: sessionId,
        userId: userId
      };
    } catch (error) {
      console.error(`❌ Error getting session status:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if session is connected in memory
   */
  isSessionConnected(userId, sessionId) {
    try {
      if (!this.activeSessions.has(userId)) {
        return false;
      }
      
      const userSessions = this.activeSessions.get(userId);
      const session = userSessions.get(sessionId);
      
      if (!session) {
        return false;
      }
      
      // Check if the socket is still valid and connected
      return session && !session.destroyed;
    } catch (error) {
      console.error(`❌ Error checking session connection:`, error);
      return false;
    }
  }

  cleanSession(userId, sessionId) {
    try {
      console.log(`🧹 Cleaning session: ${sessionId} for user: ${userId}`);
      
      // Disconnect WhatsApp if connected
      if (this.activeSessions.has(userId) && this.activeSessions.get(userId).has(sessionId)) {
        const sock = this.activeSessions.get(userId).get(sessionId);
        if (sock && typeof sock.logout === 'function') {
          sock.logout();
        }
        this.activeSessions.get(userId).delete(sessionId);
        console.log(`✅ Disconnected WhatsApp session: ${sessionId}`);
      }
      
      // Remove from session metadata
      if (this.sessionMetadata.has(sessionId)) {
        this.sessionMetadata.delete(sessionId);
        console.log(`✅ Removed session metadata: ${sessionId}`);
      }
      
      // Update database status to 'cleaned'
      if (sessionId) {
        this.updateSessionStatus(userId, sessionId, 'cleaned').catch(error => {
          console.error(`❌ Error updating session status to cleaned:`, error);
        });
      }
      
      return { 
        success: true, 
        message: 'Session cleaned successfully',
        sessionId: sessionId,
        userId: userId
      };
    } catch (error) {
      console.error(`❌ Error cleaning session:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a short alias for the session
   */
  generateAlias(name) {
    if (!name) return 'S' + Math.random().toString(36).substr(2, 3).toUpperCase();
    return name.replace(/[^a-zA-Z0-9]/g, '').substr(0, 8).toUpperCase();
  }

  /**
   * Periodic sync to cloud storage
   */
  startPeriodicSync(intervalMs = 300000) { // 5 minutes
    setInterval(async () => {
      console.log(`🔄 Starting periodic sync to cloud storage...`);
      
      for (const [userId, userSessions] of this.activeSessions) {
        for (const [sessionId, sock] of userSessions) {
          const metadata = this.sessionMetadata.get(sessionId);
          if (metadata && metadata.localPath) {
            await this.syncSessionToCloud(userId, sessionId, metadata.localPath);
          }
        }
      }
      
      console.log(`✅ Periodic sync completed`);
    }, intervalMs);
  }

  /**
   * Handle location messages and update locations table
   */
  async handleLocationMessages(userId, sessionId, messageEvent) {
    try {
      console.log(`🔍 Starting location message processing for user ${userId}, session ${sessionId}`);
      console.log(`🔍 Message event structure:`, {
        hasMessages: !!messageEvent.messages,
        messageCount: messageEvent.messages?.length || 0,
        type: messageEvent.type
      });
      
      if (!messageEvent.messages || messageEvent.messages.length === 0) {
        console.log(`⚠️ No messages in event for user ${userId}`);
        return;
      }
      
      for (const message of messageEvent.messages) {
        // Skip if message is from self
        if (message.key.fromMe) {
          console.log(`⏭️ Skipping message from self for user ${userId}`);
          continue;
        }
        
        console.log(`📱 Processing message for user ${userId}:`, {
          type: message.message?.conversation ? 'text' : Object.keys(message.message || {}).join(', '),
          from: message.key.remoteJid,
          timestamp: message.messageTimestamp,
          hasLocationMessage: !!message.message?.locationMessage,
          hasExtendedTextMessage: !!message.message?.extendedTextMessage
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
          console.log(`📍 Location data found, processing for user ${userId}`);
          await this.processLocationMessage(userId, sessionId, message, locationData);
        } else {
          console.log(`❌ No location data found in message for user ${userId}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error handling location messages for user ${userId}:`, error);
    }
  }

  /**
   * Process individual location message and update locations table
   */
  async processLocationMessage(userId, sessionId, message, locationData) {
    try {
      console.log(`\n📍 ===== PROCESSING LOCATION MESSAGE =====`);
      console.log(`📍 User: ${userId}`);
      console.log(`📍 Session: ${sessionId}`);
      console.log(`📍 Location Data:`, {
        latitude: locationData.degreesLatitude,
        longitude: locationData.degreesLongitude,
        name: locationData.name,
        address: locationData.address
      });
      
      // Extract phone number from message sender
      const senderJid = message.key.remoteJid;
      let phoneNumber = null;
      let customerName = null;

      console.log(`📱 Message details:`, {
        senderJid: senderJid,
        pushName: message.pushName,
        timestamp: message.messageTimestamp
      });

      // Extract phone number from JID (format: 972526686285@s.whatsapp.net)
      if (senderJid && senderJid.includes('@s.whatsapp.net')) {
        phoneNumber = senderJid.split('@')[0];
        console.log(`📞 Extracted phone from JID: ${phoneNumber}`);
      } else {
        console.log(`❌ Invalid JID format: ${senderJid}`);
        return;
      }

      // Try to get contact name from WhatsApp
      if (message.pushName) {
        customerName = message.pushName;
        console.log(`👤 Contact name from WhatsApp: ${customerName}`);
      } else {
        console.log(`⚠️ No pushName available`);
      }

      if (!phoneNumber) {
        console.log(`❌ Could not extract phone number from message`);
        return;
      }

      // Convert WhatsApp phone format to local format
      const localPhoneNumber = this.convertWhatsAppPhoneToLocal(phoneNumber);
      console.log(`📞 Converted phone: ${phoneNumber} -> ${localPhoneNumber}`);

      // Check if location exists in locations table
      console.log(`🔍 Checking existing location for phone: ${localPhoneNumber}`);
      const { data: existingLocation, error: selectError } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .eq('phone', localPhoneNumber)
        .single();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error(`❌ Error checking existing location:`, selectError);
        return;
      }

      console.log(`🔍 Existing location result:`, {
        found: !!existingLocation,
        location: existingLocation ? {
          id: existingLocation.id,
          name: existingLocation.name,
          phone: existingLocation.phone,
          currentLat: existingLocation.latitude,
          currentLng: existingLocation.longitude
        } : null
      });

      const locationUpdateData = {
        longitude: locationData.degreesLongitude,
        latitude: locationData.degreesLatitude,
        location_received: true,
        updated_at: new Date().toISOString()
      };

      if (existingLocation) {
        // Update existing location
        console.log(`🔄 Updating existing location for phone: ${localPhoneNumber}`);
        console.log(`🔄 Update data:`, locationUpdateData);
        
        const { data: updatedLocation, error: updateError } = await supabase
          .from('locations')
          .update(locationUpdateData)
          .eq('id', existingLocation.id)
          .select()
          .single();

        if (updateError) {
          console.error(`❌ Error updating location:`, updateError);
          return;
        }

        console.log(`✅ Successfully updated location for: ${existingLocation.name || 'Unknown'} (${localPhoneNumber})`);
        console.log(`📍 New Location: ${locationData.degreesLatitude}, ${locationData.degreesLongitude}`);
        console.log(`📊 Updated location record:`, updatedLocation);
      } else {
        // Create new location entry
        console.log(`🆕 Creating new location entry for phone: ${localPhoneNumber}`);
        
        const newLocationData = {
          user_id: userId,
          name: customerName || 'Unknown Customer',
          phone: localPhoneNumber,
          longitude: locationData.degreesLongitude,
          latitude: locationData.degreesLatitude,
          location_received: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log(`🆕 New location data:`, newLocationData);

        const { data: newLocation, error: insertError } = await supabase
          .from('locations')
          .insert(newLocationData)
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Error creating new location:`, insertError);
          return;
        }

        console.log(`✅ Successfully created new location for: ${customerName || 'Unknown'} (${localPhoneNumber})`);
        console.log(`📍 Location: ${locationData.degreesLatitude}, ${locationData.degreesLongitude}`);
        console.log(`📊 New location record:`, newLocation);
      }

      // Log to message history
      console.log(`📝 Logging location message to history...`);
      await this.logLocationMessage(userId, sessionId, message, locationData, localPhoneNumber, customerName);
      console.log(`📍 ===== LOCATION MESSAGE PROCESSING COMPLETE =====\n`);

    } catch (error) {
      console.error(`❌ Error processing location message:`, error);
      console.error(`❌ Error stack:`, error.stack);
    }
  }

  /**
   * Log location message to message history
   */
  async logLocationMessage(userId, sessionId, message, locationData, phoneNumber, customerName) {
    try {
      console.log(`📝 ===== LOGGING LOCATION MESSAGE TO HISTORY =====`);
      
      const messageHistoryData = {
        user_id: userId,
        session_id: sessionId,
        message_type: 'location',
        sender_phone: phoneNumber,
        sender_name: customerName,
        content: `Location: ${locationData.name || 'Unknown'} (${locationData.degreesLatitude}, ${locationData.degreesLongitude})`,
        metadata: {
          latitude: locationData.degreesLatitude,
          longitude: locationData.degreesLongitude,
          location_name: locationData.name,
          address: locationData.address
        },
        created_at: new Date().toISOString()
      };

      console.log(`📝 Message history data:`, messageHistoryData);

      const { data: insertedMessage, error: insertError } = await supabase
        .from('message_history')
        .insert(messageHistoryData)
        .select()
        .single();

      if (insertError) {
        console.error(`❌ Error logging location message:`, insertError);
        console.error(`❌ Insert error details:`, {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
      } else {
        console.log(`✅ Location message logged to history successfully!`);
        console.log(`📝 Logged message ID: ${insertedMessage.id}`);
        console.log(`📝 For: ${customerName || 'Unknown'} (${phoneNumber})`);
        console.log(`📝 ===== MESSAGE HISTORY LOGGING COMPLETE =====`);
      }
    } catch (error) {
      console.error(`❌ Error logging location message:`, error);
      console.error(`❌ Error stack:`, error.stack);
    }
  }

  /**
   * Convert WhatsApp phone number to Israeli local format
   */
  convertWhatsAppPhoneToLocal(whatsappPhoneNumber) {
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
}

module.exports = EnhancedSessionStorageManager;

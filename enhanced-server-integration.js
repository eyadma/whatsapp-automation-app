const EnhancedSessionManager = require('./enhanced-session-manager');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Enhanced WhatsApp Server Integration
 * Integrates multi-session management with existing WhatsApp functionality
 */
class EnhancedWhatsAppServer {
  constructor() {
    this.sessionManager = new EnhancedSessionManager();
    this.whatsappConnections = new Map(); // sessionId -> WhatsApp connection
    this.connectionStatus = new Map(); // sessionId -> connection status
    this.messageQueues = new Map(); // sessionId -> message queue
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize a new WhatsApp session
   */
  async initializeSession(userId, sessionData) {
    try {
      console.log(`🚀 Initializing new WhatsApp session for user ${userId}`);
      
      // Create session in session manager
      const sessionResult = await this.sessionManager.createSession(userId, sessionData);
      if (!sessionResult.success) {
        throw new Error(`Failed to create session: ${sessionResult.error}`);
      }

      const { sessionId, session } = sessionResult;
      
      // Initialize WhatsApp connection
      const connectionResult = await this.initializeWhatsAppConnection(sessionId, session);
      if (!connectionResult.success) {
        // Clean up session if connection fails
        await this.sessionManager.deleteSession(userId, sessionId);
        throw new Error(`Failed to initialize WhatsApp connection: ${connectionResult.error}`);
      }

      console.log(`✅ Session ${sessionId} initialized successfully`);
      return { success: true, sessionId, session, qrCode: connectionResult.qrCode };
    } catch (error) {
      console.error('❌ Error initializing session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize WhatsApp connection for a session
   */
  async initializeWhatsAppConnection(sessionId, session) {
    try {
      console.log(`📱 Initializing WhatsApp connection for session ${sessionId}`);
      
      // Create session directory
      const sessionDir = path.join(__dirname, 'sessions', sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Initialize WhatsApp connection
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: console,
        browser: ['WhatsApp Multi-Session', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 1000,
        maxRetries: 3,
        defaultQueryTimeoutMs: 60000,
        emitOwnEvents: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          // Implement message retrieval logic
          return null;
        }
      });

      // Store connection
      this.whatsappConnections.set(sessionId, {
        sock,
        state,
        saveCreds,
        sessionDir,
        status: 'connecting'
      });

      // Set up event handlers
      this.setupWhatsAppEventHandlers(sessionId, sock);

      // Update session status
      await this.sessionManager.handleConnectionSuccess(sessionId, {
        phoneNumber: sock.user?.id,
        platform: sock.user?.platform,
        connectedAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error initializing WhatsApp connection:', error);
      await this.sessionManager.handleConnectionFailure(sessionId, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up WhatsApp event handlers for a session
   */
  setupWhatsAppEventHandlers(sessionId, sock) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    // Connection update handler
    sock.ev.on('connection.update', async (update) => {
      try {
        console.log(`📡 Connection update for session ${sessionId}:`, update.status);
        
        switch (update.status) {
          case 'connecting':
            await this.updateConnectionStatus(sessionId, 'connecting');
            break;
            
          case 'open':
            await this.updateConnectionStatus(sessionId, 'connected');
            await this.sessionManager.handleConnectionSuccess(sessionId, {
              phoneNumber: sock.user?.id,
              platform: sock.user?.platform,
              connectedAt: new Date()
            });
            break;
            
          case 'close':
            await this.handleConnectionClose(sessionId, update);
            break;
        }
      } catch (error) {
        console.error(`❌ Error handling connection update for session ${sessionId}:`, error);
      }
    });

    // QR code handler
    sock.ev.on('connection.update', async (update) => {
      if (update.qr) {
        try {
          console.log(`📱 QR code received for session ${sessionId}`);
          
          // Generate QR code image
          const qrCodeData = await qrcode.toDataURL(update.qr, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1
          });

          // Store QR code in session
          await this.sessionManager.updateSessionPreferences(sessionId, {
            qrCode: qrCodeData,
            qrCodeExpiry: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
          });

          // Update connection status
          await this.updateConnectionStatus(sessionId, 'qr_ready');
        } catch (error) {
          console.error(`❌ Error handling QR code for session ${sessionId}:`, error);
        }
      }
    });

    // Message handler
    sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type === 'notify') {
          for (const message of m.messages) {
            await this.handleIncomingMessage(sessionId, message);
          }
        }
      } catch (error) {
        console.error(`❌ Error handling incoming message for session ${sessionId}:`, error);
      }
    });

    // Message receipt handler
    sock.ev.on('messages.update', async (updates) => {
      try {
        for (const update of updates) {
          if (update.update.status) {
            await this.handleMessageStatusUpdate(sessionId, update);
          }
        }
      } catch (error) {
        console.error(`❌ Error handling message status update for session ${sessionId}:`, error);
      }
    });
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleIncomingMessage(sessionId, message) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) return;

      console.log(`📨 Incoming message for session ${sessionId}:`, message.key.id);

      // Update session metrics
      this.sessionManager.updateSessionMetrics(sessionId, 'message_received', {
        messageId: message.key.id,
        from: message.key.remoteJid,
        timestamp: new Date()
      });

      // Log message activity
      await this.sessionManager.logSessionActivity(sessionId, session.userId, 'message_received', {
        messageId: message.key.id,
        from: message.key.remoteJid,
        messageType: message.message?.conversation ? 'text' : 'media'
      });

      // Check for auto-reply
      await this.checkAndSendAutoReply(sessionId, message);

      // Process message based on session preferences
      await this.processIncomingMessage(sessionId, message);
    } catch (error) {
      console.error(`❌ Error handling incoming message for session ${sessionId}:`, error);
    }
  }

  /**
   * Check and send auto-reply if enabled
   */
  async checkAndSendAutoReply(sessionId, message) {
    try {
      const preferences = await this.sessionManager.getSessionPreferences(sessionId);
      if (!preferences.success || !preferences.preferences.auto_reply_enabled) {
        return;
      }

      const { auto_reply_message, business_hours } = preferences.preferences;
      if (!auto_reply_message) return;

      // Check business hours if configured
      if (business_hours && !this.isWithinBusinessHours(business_hours)) {
        console.log(`⏰ Auto-reply skipped for session ${sessionId} - outside business hours`);
        return;
      }

      // Send auto-reply
      const connection = this.whatsappConnections.get(sessionId);
      if (connection && connection.sock) {
        await connection.sock.sendMessage(message.key.remoteJid, {
          text: auto_reply_message
        });

        console.log(`🤖 Auto-reply sent for session ${sessionId}`);
        
        // Log auto-reply activity
        await this.sessionManager.logSessionActivity(sessionId, session.userId, 'auto_reply_sent', {
          messageId: message.key.id,
          to: message.key.remoteJid
        });
      }
    } catch (error) {
      console.error(`❌ Error sending auto-reply for session ${sessionId}:`, error);
    }
  }

  /**
   * Check if current time is within business hours
   */
  isWithinBusinessHours(businessHours) {
    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Time in minutes

      const todaySchedule = businessHours[currentDay];
      if (!todaySchedule || !todaySchedule.enabled) {
        return false;
      }

      const startTime = this.timeToMinutes(todaySchedule.start);
      const endTime = this.timeToMinutes(todaySchedule.end);

      return currentTime >= startTime && currentTime <= endTime;
    } catch (error) {
      console.error('❌ Error checking business hours:', error);
      return false;
    }
  }

  /**
   * Convert time string to minutes
   */
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Process incoming message based on session preferences
   */
  async processIncomingMessage(sessionId, message) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) return;

      // Get session preferences
      const preferences = await this.sessionManager.getSessionPreferences(sessionId);
      if (!preferences.success) return;

      const { language_preference } = preferences.preferences;

      // Process message based on language preference
      if (language_preference && language_preference !== 'en') {
        // Implement language-specific processing
        console.log(`🌐 Processing message in ${language_preference} for session ${sessionId}`);
      }

      // Store message in database (implement as needed)
      // await this.storeMessageInDatabase(sessionId, message);

    } catch (error) {
      console.error(`❌ Error processing incoming message for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle message status updates
   */
  async handleMessageStatusUpdate(sessionId, update) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) return;

      console.log(`📊 Message status update for session ${sessionId}:`, update.update.status);

      // Update session metrics
      this.sessionManager.updateSessionMetrics(sessionId, 'message_status_update', {
        messageId: update.key.id,
        status: update.update.status,
        timestamp: new Date()
      });

      // Log status update
      await this.sessionManager.logSessionActivity(sessionId, session.userId, 'message_status_update', {
        messageId: update.key.id,
        status: update.update.status
      });

    } catch (error) {
      console.error(`❌ Error handling message status update for session ${sessionId}:`, error);
    }
  }

  /**
   * Send message through a specific session
   */
  async sendMessage(sessionId, to, message, options = {}) {
    try {
      const connection = this.whatsappConnections.get(sessionId);
      if (!connection || connection.status !== 'connected') {
        throw new Error(`Session ${sessionId} is not connected`);
      }

      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Send message
      const result = await connection.sock.sendMessage(to, message, options);
      
      // Update session metrics
      this.sessionManager.updateSessionMetrics(sessionId, 'message_sent', {
        messageId: result.key.id,
        to,
        timestamp: new Date()
      });

      // Log message sent
      await this.sessionManager.logSessionActivity(sessionId, session.userId, 'message_sent', {
        messageId: result.key.id,
        to,
        messageType: message.text ? 'text' : 'media'
      });

      console.log(`✅ Message sent through session ${sessionId}:`, result.key.id);
      return { success: true, messageId: result.key.id };
    } catch (error) {
      console.error(`❌ Error sending message through session ${sessionId}:`, error);
      
      // Update session metrics
      this.sessionManager.updateSessionMetrics(sessionId, 'message_send_error', {
        error: error.message,
        timestamp: new Date()
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk messages through a session
   */
  async sendBulkMessages(sessionId, messages, options = {}) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const { delay = 1000, maxConcurrent = 3 } = options;
      const results = [];
      const errors = [];

      // Process messages in batches
      for (let i = 0; i < messages.length; i += maxConcurrent) {
        const batch = messages.slice(i, i + maxConcurrent);
        
        // Send batch concurrently
        const batchPromises = batch.map(async (msg) => {
          try {
            const result = await this.sendMessage(sessionId, msg.to, msg.message, msg.options);
            return { success: true, ...result, originalMessage: msg };
          } catch (error) {
            return { success: false, error: error.message, originalMessage: msg };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(r => r.success));
        errors.push(...batchResults.filter(r => !r.success));

        // Add delay between batches
        if (i + maxConcurrent < messages.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      console.log(`📤 Bulk messages completed for session ${sessionId}: ${results.length} sent, ${errors.length} failed`);
      
      return {
        success: true,
        totalMessages: messages.length,
        successfulMessages: results.length,
        failedMessages: errors.length,
        results,
        errors
      };
    } catch (error) {
      console.error(`❌ Error sending bulk messages through session ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update connection status for a session
   */
  async updateConnectionStatus(sessionId, status) {
    try {
      this.connectionStatus.set(sessionId, status);
      
        // Update session status in session manager
  await this.sessionManager.updateSession(sessionId, {
    status,
    last_activity: new Date()
  });

      console.log(`📡 Connection status updated for session ${sessionId}: ${status}`);
    } catch (error) {
      console.error(`❌ Error updating connection status for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle connection close
   */
  async handleConnectionClose(sessionId, update) {
    try {
      console.log(`🔌 Connection closed for session ${sessionId}:`, update.reason);
      
      // Update connection status
      await this.updateConnectionStatus(sessionId, 'disconnected');
      
      // Clean up connection
      const connection = this.whatsappConnections.get(sessionId);
      if (connection) {
        this.whatsappConnections.delete(sessionId);
      }

      // Log disconnection
      const session = this.sessionManager.getSession(sessionId);
      if (session) {
        await this.sessionManager.logSessionActivity(sessionId, session.userId, 'connection_closed', {
          reason: update.reason,
          timestamp: new Date()
        });
      }

      // Attempt reconnection if configured
      if (update.reason !== DisconnectReason.loggedOut) {
        await this.attemptReconnection(sessionId);
      }
    } catch (error) {
      console.error(`❌ Error handling connection close for session ${sessionId}:`, error);
    }
  }

  /**
   * Attempt to reconnect a session
   */
  async attemptReconnection(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) return;

      console.log(`🔄 Attempting reconnection for session ${sessionId}`);
      
      // Update status
      await this.updateConnectionStatus(sessionId, 'reconnecting');
      
      // Wait before reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Reinitialize connection
      const connectionResult = await this.initializeWhatsAppConnection(sessionId, session);
      if (!connectionResult.success) {
        console.log(`❌ Reconnection failed for session ${sessionId}:`, connectionResult.error);
        await this.updateConnectionStatus(sessionId, 'connection_failed');
      }
    } catch (error) {
      console.error(`❌ Error attempting reconnection for session ${sessionId}:`, error);
    }
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId) {
    const connection = this.whatsappConnections.get(sessionId);
    const status = this.connectionStatus.get(sessionId);
    
    return {
      sessionId,
      status: status || 'unknown',
      isConnected: connection && connection.status === 'connected',
      lastActivity: connection?.lastActivity,
      connectionInfo: connection ? {
        phoneNumber: connection.sock?.user?.id,
        platform: connection.sock?.user?.platform
      } : null
    };
  }

  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId) {
    try {
      const sessions = await this.sessionManager.getUserSessions(userId);
      const activeSessions = [];

      for (const session of sessions) {
        const status = this.getSessionStatus(session.id);
        activeSessions.push({
          ...session,
          connectionStatus: status
        });
      }

      return { success: true, sessions: activeSessions };
    } catch (error) {
      console.error('❌ Error getting user active sessions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(sessionId) {
    try {
      const connection = this.whatsappConnections.get(sessionId);
      if (connection && connection.sock) {
        await connection.sock.logout();
        console.log(`🔌 Session ${sessionId} logged out`);
      }

      // Clean up connection
      this.whatsappConnections.delete(sessionId);
      this.connectionStatus.delete(sessionId);

      // Update session manager
      await this.sessionManager.disconnectSession(sessionId);

      return { success: true };
    } catch (error) {
      console.error(`❌ Error disconnecting session ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute
  }

  /**
   * Perform health check on all sessions
   */
  async performHealthCheck() {
    try {
      console.log('🏥 Performing enhanced health check...');
      
      for (const [sessionId, connection] of this.whatsappConnections) {
        try {
          // Check connection health
          if (connection.sock && connection.sock.user) {
            // Connection is healthy
            await this.updateConnectionStatus(sessionId, 'connected');
          } else {
            // Connection lost
            await this.updateConnectionStatus(sessionId, 'disconnected');
            console.log(`⚠️ Unhealthy connection detected for session ${sessionId}`);
          }
        } catch (error) {
          console.error(`❌ Error checking health for session ${sessionId}:`, error);
          await this.updateConnectionStatus(sessionId, 'error');
        }
      }
    } catch (error) {
      console.error('❌ Error during enhanced health check:', error);
    }
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    const baseStatus = this.sessionManager.getSystemStatus();
    
    return {
      ...baseStatus,
      whatsappConnections: this.whatsappConnections.size,
      connectionStatuses: Object.fromEntries(this.connectionStatus),
      messageQueues: this.messageQueues.size,
      enhancedFeatures: {
        multiSession: true,
        autoReplies: true,
        businessHours: true,
        collaboration: true,
        metrics: true,
        healthMonitoring: true
      }
    };
  }
}

module.exports = EnhancedWhatsAppServer;

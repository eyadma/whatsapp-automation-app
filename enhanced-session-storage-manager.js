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

      // Set up event handlers
      this.setupEventHandlers(sock, userId, sessionId, localSessionPath, saveCreds);

      // Update session status
      await this.updateSessionStatus(userId, sessionId, 'connecting');

      console.log(`✅ WhatsApp connection initiated for session: ${sessionId}`);
      return { success: true, sessionId, qrCode: null };
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
        await this.updateSessionStatus(userId, sessionId, 'qr_generated', { qrCode: qr });
      }

      if (connection === 'close') {
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
        await this.updateSessionStatus(userId, sessionId, 'connected');
        
        // Sync session to cloud after successful connection
        await this.syncSessionToCloud(userId, sessionId, localSessionPath);
      }
    });

    sock.ev.on('creds.update', async () => {
      console.log(`🔐 Credentials updated for session: ${sessionId}`);
      await saveCreds();
      
      // Sync updated credentials to cloud
      await this.syncSessionToCloud(userId, sessionId, localSessionPath);
    });

    sock.ev.on('messages.upsert', async (m) => {
      console.log(`📨 Message received in session: ${sessionId}`);
      await this.updateSessionActivity(userId, sessionId);
    });
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
}

module.exports = EnhancedSessionStorageManager;

const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Enhanced WhatsApp Multi-Session Manager
 * Supports multiple sessions per user with advanced features
 */
class EnhancedSessionManager {
  constructor() {
    // User sessions: userId -> Map of sessionId -> sessionData
    this.userSessions = new Map();
    
    // Active connections: sessionId -> connection object
    this.activeConnections = new Map();
    
    // Session metrics and monitoring
    this.sessionMetrics = new Map();
    
    // Connection limits and rate limiting
    this.connectionLimits = new Map();
    
    // Session health monitoring
    this.healthCheckInterval = null;
    this.startHealthMonitoring();
  }

  /**
   * Create a new WhatsApp session for a user
   */
  async createSession(userId, sessionData) {
    try {
      const sessionId = uuidv4();
      const session = {
        id: sessionId,
        userId,
        name: sessionData.name || 'New Session',
        alias: sessionData.alias || this.generateAlias(sessionData.name),
        phoneNumber: sessionData.phoneNumber,
        connectionType: sessionData.connectionType || 'mobile',
        status: 'initializing',
        connection: null,
        qrCode: null,
        qrCodeExpiry: null,
        connectionAttempts: 0,
        maxConnections: sessionData.maxConnections || 5,
        isDefault: sessionData.isDefault || false,
        isVerified: false,
        createdAt: new Date(),
        lastActivity: new Date(),
        preferences: {
          autoReply: false,
          autoReplyMessage: '',
          businessHours: null,
          timezone: 'Asia/Jerusalem',
          language: 'en'
        },
        collaborators: [],
        metrics: {
          messagesSent: 0,
          messagesReceived: 0,
          connectionTime: 0,
          errors: 0
        }
      };

      // Store in memory
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Map());
      }
      this.userSessions.get(userId).set(sessionId, session);

      // Initialize metrics tracking
      this.sessionMetrics.set(sessionId, {
        startTime: Date.now(),
        dailyStats: new Map(),
        connectionHistory: []
      });

      // Log session creation
      await this.logSessionActivity(sessionId, userId, 'session_created', {
        sessionName: session.name,
        connectionType: session.connectionType
      });

      return { success: true, sessionId, session };
    } catch (error) {
      console.error('❌ Error creating session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a short alias for the session
   */
  generateAlias(name) {
    if (!name) return 'S' + Math.random().toString(36).substr(2, 3).toUpperCase();
    
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 3).toUpperCase();
    }
    
    return words.map(word => word.charAt(0)).join('').toUpperCase();
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId) {
    const userSessionMap = this.userSessions.get(userId);
    if (!userSessionMap) return [];
    
    return Array.from(userSessionMap.values()).map(session => ({
      id: session.id,
      name: session.name,
      alias: session.alias,
      phoneNumber: session.phoneNumber,
      status: session.status,
      connectionType: session.connectionType,
      isDefault: session.isDefault,
      isVerified: session.isVerified,
      lastActivity: session.lastActivity,
      metrics: session.metrics,
      preferences: session.preferences
    }));
  }

  /**
   * Get a specific session
   */
  getSession(sessionId) {
    for (const [userId, sessions] of this.userSessions) {
      if (sessions.has(sessionId)) {
        return sessions.get(sessionId);
      }
    }
    return null;
  }

  /**
   * Set a session as default for a user
   */
  async setDefaultSession(userId, sessionId) {
    try {
      const userSessionMap = this.userSessions.get(userId);
      if (!userSessionMap) {
        return { success: false, error: 'User not found' };
      }

      // Remove default from all other sessions
      for (const [id, session] of userSessionMap) {
        session.isDefault = (id === sessionId);
      }

      // Log the change
      await this.logSessionActivity(sessionId, userId, 'session_set_default', {
        sessionName: userSessionMap.get(sessionId)?.name
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error setting default session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Connect to WhatsApp for a specific session
   */
  async connectSession(sessionId, connectionOptions = {}) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Check connection limits
      if (this.connectionLimits.get(sessionId) >= session.maxConnections) {
        return { success: false, error: 'Connection limit reached' };
      }

      // Update session status
      session.status = 'connecting';
      session.connectionAttempts++;
      session.lastActivity = new Date();

      // Generate QR code for connection
      const qrCodeData = await this.generateQRCode(sessionId);
      session.qrCode = qrCodeData;
      session.qrCodeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Log connection attempt
      await this.logSessionActivity(sessionId, session.userId, 'connection_attempt', {
        attempt: session.connectionAttempts,
        connectionType: session.connectionType
      });

      return {
        success: true,
        qrCode: qrCodeData,
        qrCodeExpiry: session.qrCodeExpiry,
        status: session.status
      };
    } catch (error) {
      console.error('❌ Error connecting session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate QR code for WhatsApp connection
   */
  async generateQRCode(sessionId) {
    try {
      // Generate a unique connection string
      const connectionString = `whatsapp://connect?session=${sessionId}&timestamp=${Date.now()}`;
      
      // Generate QR code
      const qrCodeData = await qrcode.toDataURL(connectionString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1
      });

      return qrCodeData;
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      throw error;
    }
  }

  /**
   * Handle successful WhatsApp connection
   */
  async handleConnectionSuccess(sessionId, connectionData) {
    try {
      const session = this.getSession(sessionId);
      if (!session) return;

      // Update session status
      session.status = 'connected';
      session.isVerified = true;
      session.lastConnected = new Date();
      session.lastActivity = new Date();
      session.connection = connectionData;
      session.qrCode = null;
      session.qrCodeExpiry = null;

      // Store active connection
      this.activeConnections.set(sessionId, connectionData);

      // Update connection limits
      const currentConnections = this.connectionLimits.get(sessionId) || 0;
      this.connectionLimits.set(sessionId, currentConnections + 1);

      // Log successful connection
      await this.logSessionActivity(sessionId, session.userId, 'connection_success', {
        connectionType: session.connectionType,
        phoneNumber: connectionData.phoneNumber
      });

      // Update metrics
      this.updateSessionMetrics(sessionId, 'connection_success');

      console.log(`✅ Session ${sessionId} connected successfully`);
    } catch (error) {
      console.error('❌ Error handling connection success:', error);
    }
  }

  /**
   * Handle connection failure
   */
  async handleConnectionFailure(sessionId, error) {
    try {
      const session = this.getSession(sessionId);
      if (!session) return;

      // Update session status
      session.status = 'connection_failed';
      session.lastActivity = new Date();

      // Log connection failure
      await this.logSessionActivity(sessionId, session.userId, 'connection_failed', {
        error: error.message,
        attempt: session.connectionAttempts
      });

      // Update metrics
      this.updateSessionMetrics(sessionId, 'connection_failed');

      console.log(`❌ Session ${sessionId} connection failed:`, error.message);
    } catch (err) {
      console.error('❌ Error handling connection failure:', err);
    }
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(sessionId) {
    try {
      const session = this.getSession(sessionId);
      if (!session) return { success: false, error: 'Session not found' };

      // Update session status
      session.status = 'disconnected';
      session.lastActivity = new Date();
      session.connection = null;

      // Remove from active connections
      this.activeConnections.delete(sessionId);

      // Update connection limits
      const currentConnections = this.connectionLimits.get(sessionId) || 0;
      if (currentConnections > 0) {
        this.connectionLimits.set(sessionId, currentConnections - 1);
      }

      // Log disconnection
      await this.logSessionActivity(sessionId, session.userId, 'session_disconnected', {
        connectionType: session.connectionType
      });

      // Update metrics
      this.updateSessionMetrics(sessionId, 'disconnected');

      return { success: true };
    } catch (error) {
      console.error('❌ Error disconnecting session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(userId, sessionId) {
    try {
      const userSessionMap = this.userSessions.get(userId);
      if (!userSessionMap) {
        return { success: false, error: 'User not found' };
      }

      const session = userSessionMap.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Disconnect if connected
      if (session.status === 'connected') {
        await this.disconnectSession(sessionId);
      }

      // Remove from memory
      userSessionMap.delete(sessionId);
      this.activeConnections.delete(sessionId);
      this.sessionMetrics.delete(sessionId);
      this.connectionLimits.delete(sessionId);

      // Log deletion
      await this.logSessionActivity(sessionId, userId, 'session_deleted', {
        sessionName: session.name
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session details
   */
  async updateSession(sessionId, updates) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Update session data
      Object.assign(session, updates);
      session.lastActivity = new Date();

      // Log session update
      await this.logSessionActivity(sessionId, session.userId, 'session_updated', {
        updatedFields: Object.keys(updates)
      });

      return { success: true, session };
    } catch (error) {
      console.error('❌ Error updating session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session preferences
   */
  async updateSessionPreferences(sessionId, preferences) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Update preferences
      session.preferences = { ...session.preferences, ...preferences };
      session.lastActivity = new Date();

      // Log preference update
      await this.logSessionActivity(sessionId, session.userId, 'preferences_updated', {
        updatedFields: Object.keys(preferences)
      });

      return { success: true, preferences: session.preferences };
    } catch (error) {
      console.error('❌ Error updating session preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add collaborator to a session
   */
  async addCollaborator(sessionId, userId, collaboratorUserId, permissionLevel = 'view') {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Check if user owns the session
      if (session.userId !== userId) {
        return { success: false, error: 'Unauthorized' };
      }

      // Add collaborator
      const collaborator = {
        userId: collaboratorUserId,
        permissionLevel,
        addedAt: new Date(),
        isActive: true
      };

      session.collaborators.push(collaborator);

      // Log collaborator addition
      await this.logSessionActivity(sessionId, userId, 'collaborator_added', {
        collaboratorUserId,
        permissionLevel
      });

      return { success: true, collaborator };
    } catch (error) {
      console.error('❌ Error adding collaborator:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session metrics
   */
  updateSessionMetrics(sessionId, eventType, data = {}) {
    try {
      const metrics = this.sessionMetrics.get(sessionId);
      if (!metrics) return;

      const today = new Date().toISOString().split('T')[0];
      
      if (!metrics.dailyStats.has(today)) {
        metrics.dailyStats.set(today, {
          messagesSent: 0,
          messagesReceived: 0,
          connectionTime: 0,
          errors: 0,
          events: []
        });
      }

      const dailyStats = metrics.dailyStats.get(today);
      
      // Update metrics based on event type
      switch (eventType) {
        case 'message_sent':
          dailyStats.messagesSent++;
          break;
        case 'message_received':
          dailyStats.messagesReceived++;
          break;
        case 'connection_success':
          dailyStats.connectionTime += data.duration || 0;
          break;
        case 'connection_failed':
          dailyStats.errors++;
          break;
      }

      // Add event to history
      dailyStats.events.push({
        type: eventType,
        timestamp: new Date(),
        data
      });

      // Keep only last 100 events per day
      if (dailyStats.events.length > 100) {
        dailyStats.events = dailyStats.events.slice(-100);
      }
    } catch (error) {
      console.error('❌ Error updating session metrics:', error);
    }
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(userId) {
    try {
      const userSessionMap = this.userSessions.get(userId);
      if (!userSessionMap) return null;

      const stats = {
        totalSessions: userSessionMap.size,
        activeSessions: 0,
        connectedSessions: 0,
        totalMessagesToday: 0,
        totalConnectionTimeToday: 0,
        sessions: []
      };

      for (const [sessionId, session] of userSessionMap) {
        const metrics = this.sessionMetrics.get(sessionId);
        const today = new Date().toISOString().split('T')[0];
        const dailyStats = metrics?.dailyStats.get(today);

        if (session.isActive) stats.activeSessions++;
        if (session.status === 'connected') stats.connectedSessions++;
        
        if (dailyStats) {
          stats.totalMessagesToday += dailyStats.messagesSent + dailyStats.messagesReceived;
          stats.totalConnectionTimeToday += dailyStats.connectionTime;
        }

        stats.sessions.push({
          id: sessionId,
          name: session.name,
          alias: session.alias,
          status: session.status,
          connectionType: session.connectionType,
          isDefault: session.isDefault,
          lastActivity: session.lastActivity,
          metrics: dailyStats || { messagesSent: 0, messagesReceived: 0, connectionTime: 0, errors: 0 }
        });
      }

      return stats;
    } catch (error) {
      console.error('❌ Error getting session statistics:', error);
      return null;
    }
  }

  /**
   * Log session activity
   */
  async logSessionActivity(sessionId, userId, activityType, activityDetails) {
    try {
      // This would typically save to the database
      const logEntry = {
        sessionId,
        userId,
        activityType,
        activityDetails,
        timestamp: new Date(),
        ipAddress: null, // Would be set from request context
        userAgent: null  // Would be set from request context
      };

      console.log(`📝 Session Activity: ${activityType} for session ${sessionId}`, logEntry);
      
      // In a real implementation, save to database
      // await supabase.from('session_activity_logs').insert(logEntry);
    } catch (error) {
      console.error('❌ Error logging session activity:', error);
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health check on all sessions
   */
  performHealthCheck() {
    try {
      console.log('🏥 Performing session health check...');
      
      for (const [userId, sessions] of this.userSessions) {
        for (const [sessionId, session] of sessions) {
          // Check for stale QR codes
          if (session.qrCode && session.qrCodeExpiry && new Date() > session.qrCodeExpiry) {
            session.qrCode = null;
            session.qrCodeExpiry = null;
            session.status = 'qr_expired';
            console.log(`⚠️ QR code expired for session ${sessionId}`);
          }

          // Check for inactive sessions
          const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
          if (session.lastActivity && (Date.now() - session.lastActivity.getTime()) > inactiveThreshold) {
            if (session.status === 'connected') {
              console.log(`⚠️ Session ${sessionId} marked as inactive`);
              session.status = 'inactive';
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error during health check:', error);
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    return {
      totalUsers: this.userSessions.size,
      totalSessions: Array.from(this.userSessions.values()).reduce((sum, sessions) => sum + sessions.size, 0),
      activeConnections: this.activeConnections.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      healthCheckInterval: this.healthCheckInterval ? 'active' : 'inactive'
    };
  }
}

module.exports = EnhancedSessionManager;

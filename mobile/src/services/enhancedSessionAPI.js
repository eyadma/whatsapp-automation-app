import { supabase } from './supabase';

/**
 * Enhanced WhatsApp Session Management API
 * Provides comprehensive multi-session support with advanced features
 */
export const enhancedSessionAPI = {
  /**
   * Get all sessions for a user
   */
  getUserSessions: async (userId) => {
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
      console.error('❌ Error fetching user sessions:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get a specific session by ID
   */
  getSession: async (sessionId, userId) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return { success: true, session: data };
    } catch (error) {
      console.error('❌ Error fetching session:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Create a new session
   */
  createSession: async (userId, sessionData) => {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .insert([{
          session_id: sessionId,
          user_id: userId,
          session_name: sessionData.name,
          session_alias: sessionData.alias || enhancedSessionAPI.generateAlias(sessionData.name),
          phone_number: sessionData.phoneNumber,
          connection_type: sessionData.connectionType || 'mobile',
          max_connections: sessionData.maxConnections || 5,
          is_default: sessionData.isDefault || false,
          status: 'initializing',
        }])
        .select();

      if (error) throw error;

      // Log session creation
      await enhancedSessionAPI.logSessionActivity(sessionId, userId, 'session_created', {
        sessionName: sessionData.name,
        connectionType: sessionData.connectionType
      });

      return { success: true, session: data[0] };
    } catch (error) {
      console.error('❌ Error creating session:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update session details
   */
  updateSession: async (sessionId, userId, updates) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .update(updates)
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      // Log session update
      await enhancedSessionAPI.logSessionActivity(sessionId, userId, 'session_updated', {
        updatedFields: Object.keys(updates)
      });

      return { success: true, session: data[0] };
    } catch (error) {
      console.error('❌ Error updating session:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Set a session as default
   */
  setDefaultSession: async (sessionId, userId) => {
    try {
      // Remove default from all other sessions
      const { error: removeError } = await supabase
        .from('whatsapp_sessions')
        .update({ is_default: false })
        .eq('user_id', userId);

      if (removeError) throw removeError;

      // Set this session as default
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .update({ is_default: true })
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      // Log default session change
      await enhancedSessionAPI.logSessionActivity(sessionId, userId, 'session_set_default', {
        sessionName: data[0]?.session_name
      });

      return { success: true, session: data[0] };
    } catch (error) {
      console.error('❌ Error setting default session:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete a session
   */
  deleteSession: async (sessionId, userId) => {
    try {
      // Log session deletion before removing
      await enhancedSessionAPI.logSessionActivity(sessionId, userId, 'session_deleted', {
        sessionId
      });

      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting session:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get session statistics
   */
  getSessionStatistics: async (userId) => {
    try {
      // Get user's sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (sessionsError) throw sessionsError;

      // Get today's metrics
      const today = new Date().toISOString().split('T')[0];
      const { data: metrics, error: metricsError } = await supabase
        .from('session_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today);

      if (metricsError) throw metricsError;

      // Calculate statistics
      const stats = {
        totalSessions: sessions?.length || 0,
        activeSessions: sessions?.filter(s => s.is_active).length || 0,
        connectedSessions: sessions?.filter(s => s.status === 'connected').length || 0,
        totalMessagesToday: 0,
        totalConnectionTimeToday: 0,
        sessions: []
      };

      // Process sessions with metrics
      sessions?.forEach(session => {
        const sessionMetrics = metrics?.find(m => m.session_id === session.session_id);
        
        if (sessionMetrics) {
          stats.totalMessagesToday += (sessionMetrics.messages_sent || 0) + (sessionMetrics.messages_received || 0);
          stats.totalConnectionTimeToday += sessionMetrics.connection_time_minutes || 0;
        }

        stats.sessions.push({
          id: session.session_id,
          name: session.session_name,
          alias: session.session_alias,
          status: session.status,
          connectionType: session.connection_type,
          isDefault: session.is_default,
          lastActivity: session.last_activity,
          metrics: sessionMetrics || {
            messagesSent: 0,
            messagesReceived: 0,
            connectionTime: 0,
            errors: 0
          }
        });
      });

      return { success: true, statistics: stats };
    } catch (error) {
      console.error('❌ Error fetching session statistics:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get session metrics for a specific date range
   */
  getSessionMetrics: async (sessionId, userId, startDate, endDate) => {
    try {
      const { data, error } = await supabase
        .from('session_metrics')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      return { success: true, metrics: data || [] };
    } catch (error) {
      console.error('❌ Error fetching session metrics:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update session preferences
   */
  updateSessionPreferences: async (sessionId, userId, preferences) => {
    try {
      const { data, error } = await supabase
        .from('session_preferences')
        .upsert([{
          session_id: sessionId,
          user_id: userId,
          ...preferences
        }])
        .select();

      if (error) throw error;

      // Log preference update
      await enhancedSessionAPI.logSessionActivity(sessionId, userId, 'preferences_updated', {
        updatedFields: Object.keys(preferences)
      });

      return { success: true, preferences: data[0] };
    } catch (error) {
      console.error('❌ Error updating session preferences:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get session preferences
   */
  getSessionPreferences: async (sessionId, userId) => {
    try {
      const { data, error } = await supabase
        .from('session_preferences')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      
      return { 
        success: true, 
        preferences: data || {
          auto_reply_enabled: false,
          auto_reply_message: '',
          business_hours: null,
          timezone: 'Asia/Jerusalem',
          language_preference: 'en'
        }
      };
    } catch (error) {
      console.error('❌ Error fetching session preferences:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Add collaborator to a session
   */
  addCollaborator: async (sessionId, userId, collaboratorUserId, permissionLevel = 'view') => {
    try {
      const { data, error } = await supabase
        .from('session_collaborators')
        .insert([{
          session_id: sessionId,
          user_id: userId,
          collaborator_user_id: collaboratorUserId,
          permission_level: permissionLevel,
          is_active: true
        }])
        .select();

      if (error) throw error;

      // Log collaborator addition
      await enhancedSessionAPI.logSessionActivity(sessionId, userId, 'collaborator_added', {
        collaboratorUserId,
        permissionLevel
      });

      return { success: true, collaborator: data[0] };
    } catch (error) {
      console.error('❌ Error adding collaborator:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get session collaborators
   */
  getSessionCollaborators: async (sessionId, userId) => {
    try {
      const { data, error } = await supabase
        .from('session_collaborators')
        .select(`
          *,
          collaborator_profile:profiles!session_collaborators_collaborator_user_id_fkey(
            id,
            email,
            full_name
          )
        `)
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      return { success: true, collaborators: data || [] };
    } catch (error) {
      console.error('❌ Error fetching session collaborators:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Remove collaborator from session
   */
  removeCollaborator: async (sessionId, userId, collaboratorUserId) => {
    try {
      const { error } = await supabase
        .from('session_collaborators')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('collaborator_user_id', collaboratorUserId);

      if (error) throw error;

      // Log collaborator removal
      await enhancedSessionAPI.logSessionActivity(sessionId, userId, 'collaborator_removed', {
        collaboratorUserId
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error removing collaborator:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get session activity logs
   */
  getSessionActivityLogs: async (sessionId, userId, limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('session_activity_logs')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, logs: data || [] };
    } catch (error) {
      console.error('❌ Error fetching session activity logs:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Log session activity
   */
  logSessionActivity: async (sessionId, userId, activityType, activityDetails) => {
    try {
      const { error } = await supabase
        .from('session_activity_logs')
        .insert([{
          session_id: sessionId,
          user_id: userId,
          activity_type: activityType,
          activity_details: activityDetails,
          ip_address: null, // Would be set from request context
          user_agent: null  // Would be set from request context
        }]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('❌ Error logging session activity:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate session alias from name
   */
  generateAlias: (name) => {
    if (!name) return 'S' + Math.random().toString(36).substr(2, 3).toUpperCase();
    
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 3).toUpperCase();
    }
    
    return words.map(word => word.charAt(0)).join('').toUpperCase();
  },

  /**
   * Validate session data
   */
  validateSessionData: (sessionData) => {
    const errors = [];

    if (!sessionData.name || sessionData.name.trim().length < 2) {
      errors.push('Session name must be at least 2 characters long');
    }

    if (sessionData.name && sessionData.name.length > 100) {
      errors.push('Session name cannot exceed 100 characters');
    }

    if (sessionData.alias && sessionData.alias.length > 50) {
      errors.push('Session alias cannot exceed 50 characters');
    }

    if (sessionData.phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(sessionData.phoneNumber)) {
      errors.push('Invalid phone number format');
    }

    if (sessionData.maxConnections && (sessionData.maxConnections < 1 || sessionData.maxConnections > 10)) {
      errors.push('Max connections must be between 1 and 10');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Get connection type options
   */
  getConnectionTypeOptions: () => [
    { value: 'mobile', label: 'Mobile Device', icon: 'phone-portrait', description: 'Personal or business mobile device' },
    { value: 'business', label: 'Business Account', icon: 'business', description: 'Official business WhatsApp account' },
    { value: 'api', label: 'API Integration', icon: 'code', description: 'Programmatic access via API' },
    { value: 'web', label: 'Web Client', icon: 'globe', description: 'WhatsApp Web browser client' },
  ],

  /**
   * Get permission level options
   */
  getPermissionLevelOptions: () => [
    { value: 'view', label: 'View Only', description: 'Can view session information and messages' },
    { value: 'send', label: 'Send Messages', description: 'Can send messages through the session' },
    { value: 'manage', label: 'Manage', description: 'Can manage session settings and preferences' },
    { value: 'admin', label: 'Admin', description: 'Full control over the session' },
  ],

  /**
   * Get timezone options
   */
  getTimezoneOptions: () => [
    { value: 'Asia/Jerusalem', label: 'Jerusalem (UTC+2/+3)', description: 'Israel Standard Time' },
    { value: 'UTC', label: 'UTC (UTC+0)', description: 'Coordinated Universal Time' },
    { value: 'America/New_York', label: 'New York (UTC-5/-4)', description: 'Eastern Time' },
    { value: 'Europe/London', label: 'London (UTC+0/+1)', description: 'British Time' },
    { value: 'Asia/Dubai', label: 'Dubai (UTC+4)', description: 'Gulf Standard Time' },
  ],

  /**
   * Get language options
   */
  getLanguageOptions: () => [
    { value: 'en', label: 'English', description: 'English language' },
    { value: 'he', label: 'Hebrew', description: 'עברית' },
    { value: 'ar', label: 'Arabic', description: 'العربية' },
    { value: 'es', label: 'Spanish', description: 'Español' },
    { value: 'fr', label: 'French', description: 'Français' },
  ],

  /**
   * Export session data
   */
  exportSessionData: async (sessionId, userId) => {
    try {
      // Get session details
      const sessionResponse = await enhancedSessionAPI.getSession(sessionId, userId);
      if (!sessionResponse.success) throw new Error(sessionResponse.error);

      // Get session preferences
      const preferencesResponse = await enhancedSessionAPI.getSessionPreferences(sessionId, userId);
      if (!preferencesResponse.success) throw new Error(preferencesResponse.error);

      // Get session metrics for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const metricsResponse = await enhancedSessionAPI.getSessionMetrics(
        sessionId, 
        userId, 
        thirtyDaysAgo.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );

      // Get activity logs
      const logsResponse = await enhancedSessionAPI.getSessionActivityLogs(sessionId, userId, 100);

      const exportData = {
        session: sessionResponse.session,
        preferences: preferencesResponse.preferences,
        metrics: metricsResponse.success ? metricsResponse.metrics : [],
        activityLogs: logsResponse.success ? logsResponse.logs : [],
        exportDate: new Date().toISOString(),
        exportVersion: '1.0'
      };

      return { success: true, data: exportData };
    } catch (error) {
      console.error('❌ Error exporting session data:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Import session data
   */
  importSessionData: async (userId, importData) => {
    try {
      // Validate import data
      if (!importData.session || !importData.session.session_name) {
        throw new Error('Invalid session data format');
      }

      // Create new session with imported data
      const sessionResponse = await enhancedSessionAPI.createSession(userId, {
        name: importData.session.session_name,
        alias: importData.session.session_alias,
        phoneNumber: importData.session.phone_number,
        connectionType: importData.session.connection_type,
        maxConnections: importData.session.max_connections || 5,
      });

      if (!sessionResponse.success) throw new Error(sessionResponse.error);

      const newSessionId = sessionResponse.session.session_id;

      // Import preferences if available
      if (importData.preferences) {
        await enhancedSessionAPI.updateSessionPreferences(newSessionId, userId, importData.preferences);
      }

      // Log import activity
      await enhancedSessionAPI.logSessionActivity(newSessionId, userId, 'session_imported', {
        originalSessionName: importData.session.session_name,
        importDate: importData.exportDate
      });

      return { success: true, sessionId: newSessionId };
    } catch (error) {
      console.error('❌ Error importing session data:', error);
      return { success: false, error: error.message };
    }
  }
};

export default enhancedSessionAPI;

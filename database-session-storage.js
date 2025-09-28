/**
 * Database-based WhatsApp Session Storage
 * Stores session data in Supabase instead of local files
 */

const { supabase } = require('./config/supabase');

class DatabaseSessionStorage {
  constructor() {
    this.tableName = 'whatsapp_session_storage';
  }

  /**
   * Save session data to database
   */
  async saveSessionData(userId, sessionId, sessionData) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .upsert([{
          user_id: userId,
          session_id: sessionId,
          session_data: sessionData,
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error saving session data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load session data from database
   */
  async loadSessionData(userId, sessionId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('session_data')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Session not found' };
        }
        throw error;
      }

      return { success: true, sessionData: data.session_data };
    } catch (error) {
      console.error('Error loading session data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete session data from database
   */
  async deleteSessionData(userId, sessionId) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', userId)
        .eq('session_id', sessionId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting session data:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Custom auth state provider that uses database instead of files
 */
async function useDatabaseAuthState(userId, sessionId) {
  const storage = new DatabaseSessionStorage();
  
  // Load existing session data
  const result = await storage.loadSessionData(userId, sessionId);
  
  let state;
  if (result.success && result.sessionData) {
    // Restore from database
    state = result.sessionData;
  } else {
    // Create new state
    const { AuthenticationState } = require('@whiskeysockets/baileys');
    state = AuthenticationState.create();
  }

  // Save credentials function
  const saveCreds = async () => {
    try {
      await storage.saveSessionData(userId, sessionId, state);
      console.log('✅ Session data saved to database');
    } catch (error) {
      console.error('❌ Error saving session data:', error);
    }
  };

  return { state, saveCreds };
}

module.exports = {
  DatabaseSessionStorage,
  useDatabaseAuthState
};

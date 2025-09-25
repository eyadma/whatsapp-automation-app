import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace these with your actual Supabase credentials
const supabaseUrl = 'https://jfqsmfhsssfhqkoiytrb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXNtZmhzc3NmaHFrb2l5dHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTY0NzksImV4cCI6MjA3MTczMjQ3OX0.0Q3pERUd_fGtEmzySrHAQxd98WTL_CRzTc_t5-ghrdE';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Extend session duration to 30 days (default is 1 hour)
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Set session duration to 30 days (in seconds)
    // 30 days * 24 hours * 60 minutes * 60 seconds = 2,592,000 seconds
    sessionDuration: 30 * 24 * 60 * 60, // 30 days
  },
});

// Customer API functions
export const customersAPI = {
  // Get customers for a user
  getCustomers: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, customers: data || [], totalCustomers: data?.length || 0 };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  },

  // Add a new customer
  addCustomer: async (customerData) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select();

      if (error) throw error;
      return { success: true, customer: data[0] };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  },

  // Update a customer
  updateCustomer: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      return { success: true, customer: data[0] };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete a customer
  deleteCustomer: async (id) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  }
};

// WhatsApp API functions
export const whatsappAPI = {
  // Get connection status
  getStatus: async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .limit(1);

      if (error) throw error;
      return { 
        success: true, 
        connected: data && data.length > 0,
        session: data?.[0] || null
      };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  },

  // Save session
  saveSession: async (sessionId, sessionData) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .upsert([{
          session_id: sessionId,
          session_data: sessionData
        }])
        .select();

      if (error) throw error;
      return { success: true, session: data[0] };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete session
  deleteSession: async (sessionId) => {
    try {
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', sessionId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  }
};

// Message templates API functions
export const templatesAPI = {
  // Get templates for a user
  getTemplates: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, templates: data || [] };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  },

  // Add a new template
  addTemplate: async (templateData) => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .insert([templateData])
        .select();

      if (error) throw error;
      return { success: true, template: data[0] };
    } catch (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }
  }
};

// Real-time subscriptions
export const subscribeToCustomers = (userId, callback) => {
  return supabase
    .channel('customers')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'customers',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('Customer change:', payload);
        callback(payload);
      }
    )
    .subscribe();
};

// Session Management API functions
export const sessionAPI = {
  // Get current session info
  getCurrentSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { success: true, session };
    } catch (error) {
      console.error('Session error:', error);
      return { success: false, error: error.message };
    }
  },

  // Refresh session
  refreshSession: async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return { success: true, session: data.session };
    } catch (error) {
      console.error('Session refresh error:', error);
      return { success: false, error: error.message };
    }
  },

  // Set session duration preference
  setSessionDuration: async (userId, duration) => {
    try {
      // Store user preference in AsyncStorage
      await AsyncStorage.setItem(`sessionDuration_${userId}`, duration.toString());
      return { success: true };
    } catch (error) {
      console.error('Error saving session duration:', error);
      return { success: false, error: error.message };
    }
  },

  // Get session duration preference
  getSessionDuration: async (userId) => {
    try {
      const duration = await AsyncStorage.getItem(`sessionDuration_${userId}`);
      return { success: true, duration: duration ? parseInt(duration) : 30 }; // Default 30 days
    } catch (error) {
      console.error('Error getting session duration:', error);
      return { success: false, error: error.message, duration: 30 };
    }
  },

  // Check if session is about to expire
  isSessionExpiringSoon: (session, thresholdHours = 24) => {
    if (!session?.expires_at) return false;
    
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
    
    return hoursUntilExpiry <= thresholdHours;
  },

  // Get session expiry info
  getSessionExpiryInfo: (session) => {
    if (!session?.expires_at) return null;
    
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry <= 0) {
      return { expired: true, message: 'Session expired' };
    }
    
    const days = Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeUntilExpiry % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return {
      expired: false,
      days,
      hours,
      message: days > 0 ? `${days} days, ${hours} hours` : `${hours} hours`
    };
  }
};

export default supabase; 
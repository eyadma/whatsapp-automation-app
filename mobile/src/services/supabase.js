import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase credentials
const supabaseUrl = 'https://jfqsmfhsssfhqkoiytrb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXNtZmhzc3NmaHFrb2l5dHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTY0NzksImV4cCI6MjA3MTczMjQ3OX0.0Q3pERUd_fGtEmzySrHAQxd98WTL_CRzTc_t5-ghrdE';

export const supabase = createClient(supabaseUrl, supabaseKey);

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

export default supabase; 
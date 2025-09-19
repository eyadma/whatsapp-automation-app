import { supabase } from './supabase';
import { resolveApiBaseUrl } from './apiBase';

export const customersAPI = {
  // Get all customers for a user
  getAll: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId) // Use user_id column name
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: { customers: data } };
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },

  // Get customer by ID
  getById: async (customerId) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      return { data: { customer: data } };
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  },

  // Create new customer
  create: async (customerData) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (error) throw error;
      return { data: { customer: data } };
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  },

  // Update customer
  update: async (customerId, customerData) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw error;
      return { data: { customer: data } };
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  // Delete customer
  delete: async (customerId) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  // Search customers
  search: async (userId, searchTerm) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId) // Use user_id column name
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,area.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: { customers: data } };
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }
};

export const messageTemplatesAPI = {
  // Get all message templates for a user (including global templates)
  getAll: async (userId) => {
    try {
      // Try RPC function first
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_user_templates_with_preferences', { user_uuid: userId });

      if (!rpcError && rpcData) {
        return { data: { templates: rpcData } };
      }

      // Fallback: Get templates directly
      console.log('RPC function not available, using direct query');
      
      // Get global templates and user's own templates
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .or('is_global.eq.true,user_id.eq.' + userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user preferences
      const { data: prefs } = await supabase
        .from('user_template_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Add preference flags to templates
      const templates = (data || []).map(template => ({
        ...template,
        is_default: prefs?.default_template_id === template.id,
        is_favorite: prefs?.favorite_template_ids?.includes(template.id) || false
      }));

      return { data: { templates } };
    } catch (error) {
      console.error('Error fetching message templates:', error);
      throw error;
    }
  },

  // Get template by ID
  getById: async (templateId) => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;
      return { data: { template: data } };
    } catch (error) {
      console.error('Error fetching template:', error);
      throw error;
    }
  },

  // Create new template
  create: async (templateData) => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;
      return { data: { template: data } };
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  },

  // Update template
  update: async (templateId, templateData) => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .update(templateData)
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;
      return { data: { template: data } };
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  },

  // Delete template
  delete: async (templateId) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  },

  // Set default template for user
  setDefaultTemplate: async (userId, templateId) => {
    try {
      // First, ensure user preferences record exists
      const { data: existingPrefs, error: checkError } = await supabase
        .from('user_template_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (existingPrefs) {
        // Update existing preferences
        const { data, error } = await supabase
          .from('user_template_preferences')
          .update({ default_template_id: templateId })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;
        return { data: { preferences: data } };
      } else {
        // Create new preferences
        const { data, error } = await supabase
          .from('user_template_preferences')
          .insert({ 
            user_id: userId, 
            default_template_id: templateId 
          })
          .select()
          .single();

        if (error) throw error;
        return { data: { preferences: data } };
      }
    } catch (error) {
      console.error('Error setting default template:', error);
      throw error;
    }
  },

  // Add/remove favorite template
  toggleFavoriteTemplate: async (userId, templateId) => {
    try {
      // Get current preferences
      const { data: prefs, error: getError } = await supabase
        .from('user_template_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      let favoriteIds = [];
      if (prefs) {
        favoriteIds = prefs.favorite_template_ids || [];
      }

      // Toggle favorite status
      const isFavorite = favoriteIds.includes(templateId);
      if (isFavorite) {
        favoriteIds = favoriteIds.filter(id => id !== templateId);
      } else {
        favoriteIds.push(templateId);
      }

      if (prefs) {
        // Update existing preferences
        const { data, error } = await supabase
          .from('user_template_preferences')
          .update({ favorite_template_ids: favoriteIds })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;
        return { data: { preferences: data } };
      } else {
        // Create new preferences
        const { data, error } = await supabase
          .from('user_template_preferences')
          .insert({ 
            user_id: userId, 
            favorite_template_ids: favoriteIds 
          })
          .select()
          .single();

        if (error) throw error;
        return { data: { preferences: data } };
      }
    } catch (error) {
      console.error('Error toggling favorite template:', error);
      throw error;
    }
  },

  // Get user template preferences
  getUserPreferences: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_template_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { data: { preferences: data } };
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  },

  // Get default template for user
  getDefaultTemplate: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_template_preferences')
        .select(`
          default_template_id,
          message_templates!default_template_id(*)
        `)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { data: { defaultTemplate: data?.message_templates } };
    } catch (error) {
      console.error('Error fetching default template:', error);
      throw error;
    }
  }
};

export const messageHistoryAPI = {
  // Get message history for a user
  getAll: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('message_history')
        .select(`
          *,
          customers(name, phone),
          message_templates(name, template)
        `)
        .eq('user_id', userId) // Use user_id column name
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return { data: { messages: data } };
    } catch (error) {
      console.error('Error fetching message history:', error);
      throw error;
    }
  },

  // Create message history entry
  create: async (messageData) => {
    try {
      const { data, error } = await supabase
        .from('message_history')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      return { data: { message: data } };
    } catch (error) {
      console.error('Error creating message history:', error);
      throw error;
    }
  },

  // Update message status
  updateStatus: async (messageId, status) => {
    try {
      const { data, error } = await supabase
        .from('message_history')
        .update({ status })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return { data: { message: data } };
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  }
};

export const whatsappAPI = {
  // Get WhatsApp connection status for a specific session
  getStatus: async (userId, sessionId = null) => {
    try {
      const baseUrl = await resolveApiBaseUrl();
      console.log('🔍 Getting WhatsApp status from URL:', baseUrl);
      
      // If sessionId is provided, use session-specific endpoint
      const endpoint = sessionId 
        ? `${baseUrl}/api/whatsapp/status/${userId}/${sessionId}`
        : `${baseUrl}/api/whatsapp/status/${userId}`;
        
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📱 WhatsApp status result:', result);
      return { 
        data: { 
          connected: result.connected || false,
          isConnecting: result.connecting || false,
          qrCode: result.qrCode || null,
          connectionType: result.connectionType || 'unknown',
          session: result.session || null
        } 
      };
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      // Fallback to Supabase if backend fails
      try {
        let query = supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true);
          
        if (sessionId) {
          query = query.eq('session_id', sessionId);
        }
        
        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') throw error;
        return { 
          data: { 
            connected: data?.status === 'connected',
            isConnecting: data?.status === 'connecting',
            qrCode: null,
            session: data 
          } 
        };
      } catch (supabaseError) {
        console.error('Supabase fallback also failed:', supabaseError);
        return { 
          data: { 
            connected: false,
            isConnecting: false,
            qrCode: null,
            session: null
          } 
        };
      }
    }
  },

  // Connect WhatsApp for a specific session
  connect: async (userId, sessionId = null) => {
    try {
      const baseUrl = await resolveApiBaseUrl();
      console.log('🔗 Connecting WhatsApp to URL:', baseUrl);
      
      // If sessionId is provided, use session-specific endpoint
      const endpoint = sessionId 
        ? `${baseUrl}/api/whatsapp/connect/${userId}/${sessionId}`
        : `${baseUrl}/api/whatsapp/connect/${userId}`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🔗 Connect result:', result);
      return { 
        data: { 
          success: result.success,
          message: result.message
        } 
      };
    } catch (error) {
      console.error('Error connecting WhatsApp:', error);
      throw error;
    }
  },

  // Disconnect WhatsApp for a specific session
  disconnect: async (userId, sessionId = null) => {
    try {
      const baseUrl = await resolveApiBaseUrl();
      console.log('🔌 Disconnecting WhatsApp from URL:', baseUrl);
      
      // If sessionId is provided, use session-specific endpoint
      const endpoint = sessionId 
        ? `${baseUrl}/api/whatsapp/disconnect/${userId}/${sessionId}`
        : `${baseUrl}/api/whatsapp/disconnect/${userId}`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (backupError) {
      console.error('Error disconnecting WhatsApp:', backupError);
      throw backupError;
    }
  },

  // Generate QR code for a specific session
  generateQR: async (userId, sessionId = null) => {
    try {
      const baseUrl = await resolveApiBaseUrl();
      console.log('📱 Generating QR code from URL:', baseUrl);
      
      // If sessionId is provided, use session-specific endpoint
      const endpoint = sessionId 
        ? `${baseUrl}/api/whatsapp/generate-qr/${userId}/${sessionId}`
        : `${baseUrl}/api/whatsapp/generate-qr/${userId}`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📱 Generate QR result:', result);
      
      // Return the QR code in the expected format
      return { 
        data: { 
          qrCode: result.qrCode,
          message: result.message
        } 
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  },

  // Clean session
  cleanSession: async (userId) => {
    try {
      const baseUrl = await resolveApiBaseUrl();
      console.log('🧹 Cleaning session from URL:', baseUrl);
      const response = await fetch(`${baseUrl}/api/whatsapp/clean-session/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error cleaning session:', error);
      throw error;
    }
  },

  // Create or update WhatsApp session
  updateSession: async (userId, sessionData) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .upsert({
          user_id: userId, // Use user_id column name
          session_id: sessionData.sessionId,
          session_data: sessionData.sessionData,
          is_active: sessionData.isActive
        })
        .select()
        .single();

      if (error) throw error;
      return { data: { session: data } };
    } catch (error) {
      console.error('Error updating WhatsApp session:', error);
      throw error;
    }
  },

  // Delete WhatsApp session
  deleteSession: async (userId) => {
    try {
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('user_id', userId); // Use user_id column name

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting WhatsApp session:', error);
      throw error;
    }
  }
};

export const messagesAPI = {
  // Send messages to customers
  sendMessages: async (userId, messageTemplate, customerIds, speedDelay = 35, sessionId = null) => {
    try {
      // Track message usage for time restrictions
      try {
        const { timeRestrictionsAPI } = await import('./timeRestrictionsAPI');
        await timeRestrictionsAPI.trackMessageUsage(userId);
        console.log('✅ Message usage tracked for sendMessages');
      } catch (error) {
        console.warn('⚠️ Failed to track message usage in sendMessages:', error);
      }

      const baseUrl = await resolveApiBaseUrl();
      console.log('📤 Sending messages to URL:', baseUrl);
      console.log('📤 Speed delay:', speedDelay, 'seconds');
      console.log('📤 Customer IDs:', customerIds);
      console.log('📤 Session ID:', sessionId || 'default');
      
      const response = await fetch(`${baseUrl}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          messageTemplate,
          customerIds,
          speedDelay,
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📤 Send messages result:', result);
      return result;
    } catch (error) {
      console.error('Error sending messages:', error);
      throw error;
    }
  },

  // Send single message
  sendSingleMessage: async (userId, phoneNumber, message, sessionId = null) => {
    try {
      // Track message usage for time restrictions
      try {
        const { timeRestrictionsAPI } = await import('./timeRestrictionsAPI');
        await timeRestrictionsAPI.trackMessageUsage(userId);
        console.log('✅ Message usage tracked for sendSingleMessage');
      } catch (error) {
        console.warn('⚠️ Failed to track message usage in sendSingleMessage:', error);
      }

      const baseUrl = await resolveApiBaseUrl();
      console.log('📤 Sending single message to URL:', baseUrl);
      const response = await fetch(`${baseUrl}/api/messages/send-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          phoneNumber,
          message,
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📤 Send single message result:', result);
      return result;
    } catch (error) {
      console.error('Error sending single message:', error);
      throw error;
    }
  },

  // Send messages in background
  sendMessagesBackground: async (userId, processedMessages, customerIds, speedDelay = 35, sessionId = null) => {
    try {
      // Track message usage for time restrictions
      try {
        const { timeRestrictionsAPI } = await import('./timeRestrictionsAPI');
        await timeRestrictionsAPI.trackMessageUsage(userId);
        console.log('✅ Message usage tracked for sendMessagesBackground');
      } catch (error) {
        console.warn('⚠️ Failed to track message usage in sendMessagesBackground:', error);
      }

      const baseUrl = await resolveApiBaseUrl();
      console.log('📤 Starting background message sending to URL:', baseUrl);
      console.log('📤 Speed delay:', speedDelay, 'seconds');
      console.log('📤 Customer IDs:', customerIds);
      console.log('📤 Session ID:', sessionId || 'default');
      console.log('📤 Processed messages count:', processedMessages.length);
      console.log('📤 Sample message:', processedMessages[0]?.message?.substring(0, 100) + '...');
      
      const response = await fetch(`${baseUrl}/api/messages/send-background`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          processedMessages,
          customerIds,
          speedDelay,
          sessionId
        }),
      });

      console.log('📤 Response status:', response.status);
      console.log('📤 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('📤 Error response text:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const result = await response.json();
      console.log('📤 Background message sending result:', result);
      console.log('📤 Result type:', typeof result);
      console.log('📤 Result keys:', result ? Object.keys(result) : 'null/undefined');
      return result;
    } catch (error) {
      console.error('Error starting background message sending:', error);
      throw error;
    }
  },

  // Check background process status
  checkBackgroundStatus: async (processId) => {
    try {
      const baseUrl = await resolveApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/messages/background-status/${processId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking background process status:', error);
      throw error;
    }
  },

  // Cancel background process
  cancelBackgroundProcess: async (processId) => {
    try {
      const baseUrl = await resolveApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/messages/background-cancel/${processId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error cancelling background process:', error);
      throw error;
    }
  }
};

export const profilesAPI = {
  // Get user profile
  getProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { data: { profile: data } };
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (userId, profileData) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return { data: { profile: data } };
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
}; 
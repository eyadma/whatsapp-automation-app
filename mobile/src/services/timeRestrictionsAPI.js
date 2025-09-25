import { supabase } from './supabase';

export const timeRestrictionsAPI = {
  /**
   * Check if user can send messages based on time restrictions
   */
  canSendMessages: async (userId) => {
    try {
      const { data, error } = await supabase
        .rpc('can_send_messages', { user_id: userId });

      if (error) {
        console.error('Error checking time restrictions:', error);
        return { canSend: true, error: error.message }; // Default to allowing if error
      }

      return { canSend: data, error: null };
    } catch (error) {
      console.error('Error in canSendMessages:', error);
      return { canSend: true, error: error.message }; // Default to allowing if error
    }
  },

  /**
   * Get user's time restriction settings
   */
  getUserTimeRestrictions: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('time_restriction_enabled, time_restriction_start, time_restriction_end, time_restriction_timezone, last_message_sent_during_window, daily_usage_tracked')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching time restrictions:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error in getUserTimeRestrictions:', error);
      return { data: null, error: error.message };
    }
  },

  /**
   * Check if current time is within allowed hours
   */
  isWithinAllowedHours: async (userId) => {
    try {
      const { data, error } = await supabase
        .rpc('is_within_allowed_hours', { user_id: userId });

      if (error) {
        console.error('Error checking allowed hours:', error);
        return { withinAllowed: true, error: error.message }; // Default to allowing if error
      }

      return { withinAllowed: data, error: null };
    } catch (error) {
      console.error('Error in isWithinAllowedHours:', error);
      return { withinAllowed: true, error: error.message }; // Default to allowing if error
    }
  },

  /**
   * Check if user has used messaging today during allowed hours
   */
  hasUsedMessagingToday: async (userId) => {
    try {
      const { data, error } = await supabase
        .rpc('has_used_messaging_today', { user_id: userId });

      if (error) {
        console.error('Error checking messaging usage:', error);
        return { hasUsed: true, error: error.message }; // Default to allowing if error
      }

      return { hasUsed: data, error: null };
    } catch (error) {
      console.error('Error in hasUsedMessagingToday:', error);
      return { hasUsed: true, error: error.message }; // Default to allowing if error
    }
  },

  /**
   * Get current time in Israel timezone
   */
  getCurrentIsraelTime: () => {
    try {
      const now = new Date();
      
      // Get time in Israel timezone using Intl.DateTimeFormat
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const fullFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const time = timeFormatter.format(now);
      const date = dateFormatter.format(now);
      const fullDateTime = fullFormatter.format(now);
      
      return {
        time: time,
        date: date,
        fullDateTime: fullDateTime
      };
    } catch (error) {
      console.error('Error getting Israel time:', error);
      // Fallback to local time if timezone conversion fails
      const now = new Date();
      return {
        time: now.toLocaleTimeString('en-US', { hour12: false }),
        date: now.toLocaleDateString('en-US'),
        fullDateTime: now.toLocaleString('en-US')
      };
    }
  },

  /**
   * Track message usage for time restrictions
   * This should be called when user starts sending messages
   */
  trackMessageUsage: async (userId) => {
    try {
      const { data, error } = await supabase
        .rpc('track_message_usage', { user_id: userId });

      if (error) {
        console.error('Error tracking message usage:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Message usage tracked successfully for user:', userId);
      return { success: true, data, error: null };
    } catch (error) {
      console.error('Error in trackMessageUsage:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get time restriction status with detailed information
   */
  getTimeRestrictionStatus: async (userId) => {
    try {
      const [restrictionsResult, canSendResult, withinAllowedResult, hasUsedResult] = await Promise.all([
        timeRestrictionsAPI.getUserTimeRestrictions(userId),
        timeRestrictionsAPI.canSendMessages(userId),
        timeRestrictionsAPI.isWithinAllowedHours(userId),
        timeRestrictionsAPI.hasUsedMessagingToday(userId)
      ]);

      const israelTime = timeRestrictionsAPI.getCurrentIsraelTime();

      return {
        success: true,
        data: {
          ...restrictionsResult.data,
          canSendMessages: canSendResult.canSend,
          withinAllowedHours: withinAllowedResult.withinAllowed,
          hasUsedMessagingToday: hasUsedResult.hasUsed,
          currentIsraelTime: israelTime.time,
          currentIsraelDate: israelTime.date,
          currentIsraelDateTime: israelTime.fullDateTime
        },
        errors: {
          restrictions: restrictionsResult.error,
          canSend: canSendResult.error,
          withinAllowed: withinAllowedResult.error,
          hasUsed: hasUsedResult.error
        }
      };
    } catch (error) {
      console.error('Error in getTimeRestrictionStatus:', error);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
};

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for server-side logging
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

class DatabaseLogger {
  constructor() {
    this.logBuffer = [];
    this.bufferSize = 50; // Buffer logs before batch insert
    this.flushInterval = 5000; // Flush every 5 seconds
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.isSupabaseAvailable = true; // Track Supabase availability
    this.consecutiveFailures = 0; // Track consecutive failures
    this.maxConsecutiveFailures = 5; // Disable logging after 5 consecutive failures
    
    // Start periodic flush
    this.startPeriodicFlush();
  }

  // Log levels
  static LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
    TRACE: 'trace'
  };

  // Log categories
  static LOG_CATEGORIES = {
    CONNECTION: 'connection',
    MESSAGE: 'message',
    DATABASE: 'database',
    AUTH: 'auth',
    SOCKET: 'socket',
    LOCATION: 'location',
    SYSTEM: 'system'
  };

  /**
   * Add log entry to buffer
   */
  addLog(level, category, message, data = null, userId = null, sessionId = null) {
    // Always log to console for immediate visibility
    const consoleMessage = `[${level.toUpperCase()}] [${category}] ${message}`;
    const consoleData = data ? ` | Data: ${JSON.stringify(data)}` : '';
    const consoleContext = userId ? ` | User: ${userId}` : '';
    const consoleSession = sessionId ? ` | Session: ${sessionId}` : '';
    
    console.log(`${consoleMessage}${consoleData}${consoleContext}${consoleSession}`);

    // Only add to buffer if Supabase is available
    if (!this.isSupabaseAvailable) {
      console.log('⚠️ Database logging disabled due to Supabase unavailability');
      return;
    }

    const logEntry = {
      level,
      category,
      message,
      data: data ? JSON.stringify(data) : null,
      user_id: userId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    this.logBuffer.push(logEntry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Flush logs to database
   */
  async flush() {
    if (this.logBuffer.length === 0) return;

    const logsToInsert = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Check if Supabase is accessible before attempting to insert
      const { error: healthError } = await supabase
        .from('logs')
        .select('id')
        .limit(1);

      if (healthError) {
        console.error('❌ Supabase health check failed:', healthError.message);
        this.consecutiveFailures++;
        this.checkSupabaseAvailability();
        // Re-add logs to buffer for retry
        if (this.logBuffer.length < this.bufferSize * 2) {
          this.logBuffer.unshift(...logsToInsert);
        }
        return;
      }

      const { error } = await supabase
        .from('logs')
        .insert(logsToInsert);

      if (error) {
        console.error('❌ Database logging error:', error);
        this.consecutiveFailures++;
        this.checkSupabaseAvailability();
        // Re-add logs to buffer for retry (but limit to prevent infinite growth)
        if (this.logBuffer.length < this.bufferSize * 2) {
          this.logBuffer.unshift(...logsToInsert);
        }
      } else {
        console.log(`✅ Flushed ${logsToInsert.length} logs to database`);
        this.consecutiveFailures = 0; // Reset failure count on success
        this.isSupabaseAvailable = true; // Re-enable logging
      }
    } catch (error) {
      console.error('❌ Database logging exception:', error);
      
      // Check if it's a connection timeout or network error
      if (error.message && (
        error.message.includes('522') || 
        error.message.includes('Connection timed out') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED')
      )) {
        console.log('🔄 Supabase connection issue detected, will retry later');
        this.consecutiveFailures++;
        this.checkSupabaseAvailability();
        // Re-add logs to buffer for retry
        if (this.logBuffer.length < this.bufferSize * 2) {
          this.logBuffer.unshift(...logsToInsert);
        }
      } else {
        // For other errors, don't retry to prevent infinite loops
        console.log('⚠️ Non-retryable error, dropping logs to prevent buffer overflow');
        this.consecutiveFailures++;
        this.checkSupabaseAvailability();
      }
    }
  }

  /**
   * Check Supabase availability and disable logging if needed
   */
  checkSupabaseAvailability() {
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      if (this.isSupabaseAvailable) {
        console.log('🚫 Disabling database logging due to consecutive failures');
        this.isSupabaseAvailable = false;
      }
    }
  }

  /**
   * Test Supabase connection and re-enable logging if successful
   */
  async testSupabaseConnection() {
    try {
      const { error } = await supabase
        .from('logs')
        .select('id')
        .limit(1);

      if (!error) {
        if (!this.isSupabaseAvailable) {
          console.log('✅ Supabase connection restored, re-enabling database logging');
          this.isSupabaseAvailable = true;
          this.consecutiveFailures = 0;
        }
        return true;
      } else {
        console.log('❌ Supabase connection test failed:', error.message);
        return false;
      }
    } catch (error) {
      console.log('❌ Supabase connection test exception:', error.message);
      return false;
    }
  }

  /**
   * Start periodic flush
   */
  startPeriodicFlush() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);

    // Test Supabase connection every 30 seconds when logging is disabled
    setInterval(async () => {
      if (!this.isSupabaseAvailable) {
        await this.testSupabaseConnection();
      }
    }, 30000);
  }

  /**
   * Convenience methods for different log levels
   */
  error(category, message, data = null, userId = null, sessionId = null) {
    this.addLog(DatabaseLogger.LOG_LEVELS.ERROR, category, message, data, userId, sessionId);
  }

  warn(category, message, data = null, userId = null, sessionId = null) {
    this.addLog(DatabaseLogger.LOG_LEVELS.WARN, category, message, data, userId, sessionId);
  }

  info(category, message, data = null, userId = null, sessionId = null) {
    this.addLog(DatabaseLogger.LOG_LEVELS.INFO, category, message, data, userId, sessionId);
  }

  debug(category, message, data = null, userId = null, sessionId = null) {
    this.addLog(DatabaseLogger.LOG_LEVELS.DEBUG, category, message, data, userId, sessionId);
  }

  trace(category, message, data = null, userId = null, sessionId = null) {
    this.addLog(DatabaseLogger.LOG_LEVELS.TRACE, category, message, data, userId, sessionId);
  }

  /**
   * Get logs from database
   */
  async getLogs(filters = {}) {
    try {
      let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.level) {
        query = query.eq('level', filters.level);
      }
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.sessionId) {
        query = query.eq('session_id', filters.sessionId);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Exception fetching logs:', error);
      return [];
    }
  }

  /**
   * Clean up old logs (retention policy)
   */
  async cleanupOldLogs(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { error } = await supabase
        .from('logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        console.error('❌ Error cleaning up old logs:', error);
        return false;
      }

      console.log(`✅ Cleaned up logs older than ${retentionDays} days`);
      return true;
    } catch (error) {
      console.error('❌ Exception cleaning up old logs:', error);
      return false;
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats() {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('level, category, created_at');

      if (error) {
        console.error('❌ Error fetching log stats:', error);
        return null;
      }

      const stats = {
        total: data.length,
        byLevel: {},
        byCategory: {},
        recent: data.filter(log => {
          const logDate = new Date(log.created_at);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return logDate > oneHourAgo;
        }).length
      };

      // Count by level
      data.forEach(log => {
        stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      });

      // Count by category
      data.forEach(log => {
        stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('❌ Exception fetching log stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const dbLogger = new DatabaseLogger();

module.exports = {
  DatabaseLogger,
  dbLogger
};

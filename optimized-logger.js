// Optimized Logger for Railway - Reduces log rate to stay within 500 logs/sec limit

class OptimizedLogger {
  constructor() {
    this.logBuffer = [];
    this.bufferSize = 50; // Buffer logs before flushing
    this.flushInterval = 5000; // Flush every 5 seconds
    this.maxLogsPerSecond = 100; // Stay well below 500 limit
    this.logCount = 0;
    this.lastReset = Date.now();
    
    // Start the flush timer
    this.startFlushTimer();
  }

  startFlushTimer() {
    setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }

  canLog() {
    const now = Date.now();
    
    // Reset counter every second
    if (now - this.lastReset >= 1000) {
      this.logCount = 0;
      this.lastReset = now;
    }
    
    return this.logCount < this.maxLogsPerSecond;
  }

  log(level, message, data = null) {
    if (!this.canLog()) {
      // Buffer the log instead of dropping it
      this.logBuffer.push({
        timestamp: new Date().toISOString(),
        level,
        message,
        data
      });
      return;
    }

    this.logCount++;
    this.outputLog(level, message, data);
  }

  outputLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logEntry, data || '');
        break;
      case 'warn':
        console.warn(logEntry, data || '');
        break;
      case 'info':
        console.log(logEntry, data || '');
        break;
      default:
        console.log(logEntry, data || '');
    }
  }

  flushBuffer() {
    if (this.logBuffer.length === 0) return;
    
    // Log buffer summary instead of individual logs
    const summary = {
      bufferedLogs: this.logBuffer.length,
      timeRange: {
        start: this.logBuffer[0]?.timestamp,
        end: this.logBuffer[this.logBuffer.length - 1]?.timestamp
      },
      levels: this.logBuffer.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {})
    };
    
    console.log(`[${new Date().toISOString()}] BUFFER_FLUSH: ${summary.bufferedLogs} logs buffered`, summary);
    this.logBuffer = [];
  }

  // Convenience methods
  info(message, data) {
    this.log('info', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  // Batch logging for high-frequency events
  batchLog(level, messages) {
    if (messages.length === 0) return;
    
    const summary = {
      count: messages.length,
      level,
      sample: messages.slice(0, 3), // Show first 3 as sample
      truncated: messages.length > 3
    };
    
    this.log(level, `BATCH: ${messages.length} messages`, summary);
  }
}

// Create singleton instance
const logger = new OptimizedLogger();

// Export both the class and instance
module.exports = {
  OptimizedLogger,
  logger
};

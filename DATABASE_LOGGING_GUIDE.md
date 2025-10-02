# Database Logging System

This system replaces console logging with database logging to bypass the 500 lines per minute limit imposed by the backend.

## 🚀 Setup

### 1. Create the Logs Table

Run the SQL script to create the logs table and related functions:

```bash
# Option 1: Run the setup script
node setup-database-logging.js

# Option 2: Execute SQL directly in Supabase dashboard
# Copy and paste the contents of create-logs-table.sql
```

### 2. Environment Variables

Ensure these environment variables are set:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📊 Database Schema

### Logs Table Structure

```sql
CREATE TABLE logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,           -- error, warn, info, debug, trace
    category VARCHAR(50) NOT NULL,        -- connection, message, database, auth, socket, location, system
    message TEXT NOT NULL,                -- Log message
    data JSONB,                          -- Additional structured data
    user_id UUID,                        -- User ID (if applicable)
    session_id VARCHAR(255),             -- Session ID (if applicable)
    timestamp TIMESTAMPTZ NOT NULL,      -- Log timestamp
    created_at TIMESTAMPTZ NOT NULL      -- Record creation time
);
```

### Indexes

- Performance indexes on level, category, user_id, session_id, timestamp
- Composite indexes for common query patterns
- Partial indexes for error logs (most important)

## 🔧 Usage

### Basic Logging

```javascript
const { dbLogger } = require('./database-logger');

// Different log levels
dbLogger.error('connection', 'Connection failed', { error: 'timeout' }, userId, sessionId);
dbLogger.warn('socket', 'Socket health warning', { readyState: 2 }, userId, sessionId);
dbLogger.info('message', 'Message received', { count: 5 }, userId, sessionId);
dbLogger.debug('database', 'Query executed', { duration: 150 }, userId, sessionId);
dbLogger.trace('system', 'Function called', { function: 'processMessage' }, userId, sessionId);
```

### Log Categories

- **connection**: WhatsApp connection events
- **message**: Message processing events
- **database**: Database operations
- **auth**: Authentication events
- **socket**: WebSocket events
- **location**: Location processing
- **system**: System events

### Log Levels

- **error**: Critical errors that need immediate attention
- **warn**: Warnings that should be monitored
- **info**: General information about system operation
- **debug**: Detailed debugging information
- **trace**: Very detailed tracing information

## 📈 API Endpoints

### Get Logs

```bash
GET /api/logs?level=error&category=connection&userId=123&limit=50
```

Query Parameters:
- `level`: Filter by log level
- `category`: Filter by category
- `userId`: Filter by user ID
- `sessionId`: Filter by session ID
- `limit`: Maximum number of logs (default: 100)
- `startDate`: Start date filter (ISO format)
- `endDate`: End date filter (ISO format)

### Get Log Statistics

```bash
GET /api/logs/stats
```

Returns:
```json
{
  "success": true,
  "stats": {
    "total": 1500,
    "byLevel": {
      "error": 25,
      "warn": 100,
      "info": 1200,
      "debug": 150,
      "trace": 25
    },
    "byCategory": {
      "connection": 300,
      "message": 800,
      "database": 200,
      "auth": 100,
      "socket": 100
    },
    "recentErrors": 5,
    "recentLogs": 200
  }
}
```

### Clean Up Old Logs

```bash
POST /api/logs/cleanup
Content-Type: application/json

{
  "retentionDays": 30
}
```

## 🔍 Monitoring and Analysis

### View Recent Logs

```sql
-- View recent logs (last 24 hours)
SELECT * FROM recent_logs LIMIT 100;

-- View error logs only
SELECT * FROM logs WHERE level = 'error' ORDER BY created_at DESC LIMIT 50;

-- View logs for specific user
SELECT * FROM logs WHERE user_id = 'user-uuid' ORDER BY created_at DESC LIMIT 100;
```

### Log Statistics

```sql
-- Get log statistics
SELECT get_log_stats();

-- Clean up old logs
SELECT cleanup_old_logs(30);
```

## ⚡ Performance Features

### Buffering

- Logs are buffered in memory (50 logs by default)
- Automatic flush every 5 seconds
- Immediate flush when buffer is full

### Batch Insertion

- Multiple logs inserted in single database transaction
- Reduces database load and improves performance

### Retry Logic

- Failed log insertions are retried
- Prevents log loss during temporary database issues

## 🔒 Security

### Row Level Security (RLS)

- Users can only see their own logs
- Service role has full access for server-side logging
- Proper authentication and authorization

### Data Privacy

- Sensitive data should be excluded from logs
- Use structured data field for additional context
- Logs are automatically cleaned up after retention period

## 🛠️ Maintenance

### Log Retention

- Default retention: 30 days
- Configurable retention period
- Automatic cleanup function available

### Performance Monitoring

- Monitor log table size
- Check index usage
- Optimize queries as needed

### Backup

- Include logs table in regular database backups
- Consider log archival for long-term storage

## 🚨 Troubleshooting

### Common Issues

1. **Logs not appearing**: Check database connection and permissions
2. **Performance issues**: Monitor buffer size and flush frequency
3. **Storage growth**: Implement proper retention policy
4. **Permission errors**: Verify RLS policies and user roles

### Debug Mode

Enable debug logging to troubleshoot the logging system itself:

```javascript
// Add to your environment
DEBUG_LOGGING=true
```

## 📝 Best Practices

1. **Use appropriate log levels**: Don't log everything as error
2. **Include context**: Always include userId and sessionId when available
3. **Structured data**: Use the data field for additional context
4. **Avoid sensitive data**: Don't log passwords, tokens, or personal information
5. **Monitor log volume**: Adjust buffer size and flush frequency as needed
6. **Regular cleanup**: Implement automated log cleanup
7. **Performance monitoring**: Monitor database performance and log table size

## 🔄 Migration from Console Logging

The system automatically includes console logging alongside database logging for immediate visibility. To fully migrate:

1. Replace all `console.log` with `dbLogger.info`
2. Replace all `console.error` with `dbLogger.error`
3. Replace all `console.warn` with `dbLogger.warn`
4. Add appropriate categories and context data
5. Remove console logging once database logging is verified

## 📊 Example Queries

```sql
-- Find all connection errors in the last hour
SELECT * FROM logs 
WHERE level = 'error' 
  AND category = 'connection' 
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Get message processing statistics
SELECT 
  COUNT(*) as total_messages,
  COUNT(CASE WHEN level = 'error' THEN 1 END) as errors,
  COUNT(CASE WHEN level = 'warn' THEN 1 END) as warnings
FROM logs 
WHERE category = 'message' 
  AND created_at > NOW() - INTERVAL '24 hours';

-- Find slow database operations
SELECT * FROM logs 
WHERE category = 'database' 
  AND data->>'duration' IS NOT NULL
  AND (data->>'duration')::int > 1000
ORDER BY created_at DESC;
```

This database logging system provides comprehensive logging capabilities while bypassing the console log limitations and providing better performance, security, and analysis capabilities.
